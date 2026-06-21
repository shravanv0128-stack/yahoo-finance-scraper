// POST /api/rooms/set-game-mode - lets the dealer/room leader choose the
// game mode (pips or holdem) for the NEXT hand when rooms.rotation_mode is
// 'dealer_choice'. Persists onto game_state.pending_game_mode, which is
// sticky (not cleared once consumed by startNewHand) so the dealer can
// change their mind right up until the next hand actually starts. Only
// allowed between hands (waiting_room/hand_complete), and restricted to the
// current room leader, matching the auth/leader-check pattern used by
// src/app/api/rooms/ledger/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { syncRoomLeader } from "@/lib/roomLeader";
import { GameMode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; gameMode?: GameMode };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }
    if (body.gameMode !== "pips" && body.gameMode !== "holdem") {
      return NextResponse.json({ error: "gameMode must be 'pips' or 'holdem'" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", body.roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { leaderId } = await syncRoomLeader(supabase, body.roomId);
    if (leaderId !== user.id) {
      return NextResponse.json({ error: "Only the room leader can set the game mode" }, { status: 403 });
    }

    const { data: gameState, error: gsError } = await supabase
      .from("game_state")
      .select("phase")
      .eq("room_id", body.roomId)
      .maybeSingle();
    if (gsError) throw gsError;
    if (gameState && !["waiting_room", "hand_complete"].includes(gameState.phase)) {
      return NextResponse.json({ error: "Cannot change the game mode while a hand is in progress" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("game_state")
      .update({ pending_game_mode: body.gameMode })
      .eq("room_id", body.roomId)
      .select()
      .maybeSingle();
    if (updateError) throw updateError;

    if (!updated) {
      // No game_state row yet (room never had a hand) - create one with the
      // pending choice set, mirroring the defaults startNewHand expects.
      const { error: insertError } = await supabase
        .from("game_state")
        .insert({ room_id: body.roomId, pending_game_mode: body.gameMode });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ pendingGameMode: body.gameMode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

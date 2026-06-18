// POST /api/rooms/ledger - adjust a seated player's chip_stack by a delta
// (positive to add, negative to subtract). Restricted to the current room
// leader (rooms.leader_id, which normally tracks the creator but can fail
// over/transfer - see src/lib/roomLeader.ts), since this directly mints/burns
// chips outside normal gameplay. Cannot be used while that player is mid-hand
// (hand_players snapshots a separate chip_stack that would otherwise drift
// out of sync).
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { syncRoomLeader } from "@/lib/roomLeader";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; playerId?: string; delta?: number };
    if (!body.roomId || !body.playerId || typeof body.delta !== "number" || body.delta === 0) {
      return NextResponse.json({ error: "roomId, playerId, and a non-zero delta are required" }, { status: 400 });
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
      return NextResponse.json({ error: "Only the room leader can adjust stacks" }, { status: 403 });
    }

    const { data: gameState } = await supabase
      .from("game_state")
      .select("hand_id, phase")
      .eq("room_id", body.roomId)
      .maybeSingle();
    if (gameState?.hand_id && gameState.phase !== "hand_complete") {
      return NextResponse.json({ error: "Cannot adjust stacks while a hand is in progress" }, { status: 409 });
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", body.playerId)
      .eq("room_id", body.roomId)
      .single();
    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found in this room" }, { status: 404 });
    }

    const newStack = Math.max(0, player.chip_stack + body.delta);
    // Adding chips is a rebuy (more cash put into play, so the buy-in total
    // grows with it); subtracting is treated as a stack correction/cash-out
    // and does not change how much the player has bought in for, so their
    // up/down net stays accurate.
    const newBuyIn = body.delta > 0 ? player.buy_in + body.delta : player.buy_in;
    const { data: updated, error: updateError } = await supabase
      .from("players")
      .update({ chip_stack: newStack, buy_in: newBuyIn })
      .eq("id", player.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ player: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

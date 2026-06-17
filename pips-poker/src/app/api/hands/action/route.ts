// POST /api/hands/action - apply a betting action (check/call/bet/raise/
// fold/all_in) for the calling user's hand_player in the room's current
// hand. Advances the phase automatically when the betting round closes
// (including running showdown if the new phase is "showdown").
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { applyBettingAction } from "@/lib/gameEngine";
import { BettingAction } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; action?: BettingAction; amount?: number };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }
    if (!body.action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const roomId = body.roomId;

    const { data: gameState, error: gsError } = await supabase
      .from("game_state")
      .select("hand_id")
      .eq("room_id", roomId)
      .single();
    if (gsError || !gameState?.hand_id) {
      return NextResponse.json({ error: "No hand in progress for this room" }, { status: 409 });
    }

    const { data: handPlayer, error: hpError } = await supabase
      .from("hand_players")
      .select("id")
      .eq("hand_id", gameState.hand_id)
      .eq("user_id", user.id)
      .single();
    if (hpError || !handPlayer) {
      return NextResponse.json({ error: "You are not seated in this hand" }, { status: 403 });
    }

    const result = await applyBettingAction(
      supabase,
      roomId,
      gameState.hand_id,
      handPlayer.id,
      body.action,
      body.amount ?? 0
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

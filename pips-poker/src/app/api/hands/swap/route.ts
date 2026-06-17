// POST /api/hands/swap - apply a draw_swap action for the calling user's
// hand_player: discard 0-3 hole cards and draw replacements. Advances to
// turn once every non-folded player has used (or skipped) their swap.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { applySwap } from "@/lib/gameEngine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; discardIndices?: number[] };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }
    const discardIndices = body.discardIndices ?? [];

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

    const result = await applySwap(supabase, roomId, gameState.hand_id, handPlayer.id, discardIndices);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

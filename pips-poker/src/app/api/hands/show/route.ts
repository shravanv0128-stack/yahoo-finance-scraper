// POST /api/hands/show - optionally reveal or muck the calling user's hole
// cards once the hand is already complete. Purely cosmetic: the winner and
// payout are finalized automatically by runShowdown and never change here.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { applyShowDecision } from "@/lib/gameEngine";
import { ShowDecision } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; decision?: ShowDecision };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }
    if (body.decision !== "show" && body.decision !== "muck") {
      return NextResponse.json({ error: "decision must be 'show' or 'muck'" }, { status: 400 });
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

    const result = await applyShowDecision(supabase, roomId, gameState.hand_id, handPlayer.id, body.decision);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

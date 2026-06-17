// POST /api/hands/showdown - manually trigger showdown evaluation for a
// room's current hand. In normal play this is invoked automatically by
// applyBettingAction (see src/lib/gameEngine.ts) the instant river_betting
// closes or all-but-one player folds, but this endpoint is exposed too in
// case a client needs to force/replay the evaluation (e.g. recovering from
// a dropped request).
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { runShowdown } from "@/lib/gameEngine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = (await req.json()) as { roomId?: string };
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: gameState, error: gsError } = await supabase
      .from("game_state")
      .select("hand_id, phase")
      .eq("room_id", roomId)
      .single();
    if (gsError || !gameState?.hand_id) {
      return NextResponse.json({ error: "No hand in progress for this room" }, { status: 409 });
    }
    if (gameState.phase !== "showdown" && gameState.phase !== "river_betting") {
      return NextResponse.json(
        { error: `Cannot run showdown during phase ${gameState.phase}` },
        { status: 409 }
      );
    }

    const result = await runShowdown(supabase, roomId, gameState.hand_id);
    return NextResponse.json({ results: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/hands/run-twice - resolve an "all_in_runout" pause once every
// remaining contender is all-in. Any seated player in the hand can submit
// the table's decision (in practice the UI should only let players still in
// the hand choose); the deck is dealt once (runTwice=false) or twice
// (runTwice=true, the standard 50/50 split rule) and showdown runs against
// the resulting board(s).
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { resolveRunItTwice } from "@/lib/gameEngine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; runTwice?: boolean };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const roomId = body.roomId;

    const { data: gameState, error: gsError } = await supabase
      .from("game_state")
      .select("hand_id, phase")
      .eq("room_id", roomId)
      .single();
    if (gsError || !gameState?.hand_id) {
      return NextResponse.json({ error: "No hand in progress for this room" }, { status: 409 });
    }
    if (gameState.phase !== "all_in_runout") {
      return NextResponse.json({ error: "No run-it-twice decision is pending for this room" }, { status: 409 });
    }

    const { data: handPlayer, error: hpError } = await supabase
      .from("hand_players")
      .select("id")
      .eq("hand_id", gameState.hand_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (hpError || !handPlayer) {
      return NextResponse.json({ error: "You are not seated in this hand" }, { status: 403 });
    }

    const result = await resolveRunItTwice(supabase, roomId, gameState.hand_id, !!body.runTwice);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

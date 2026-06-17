// POST /api/hands/start - deals a new hand for a room: ante, hole cards,
// flop, and sets phase to flop_betting. No preflop betting occurs.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { startNewHand } from "@/lib/gameEngine";

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
    const result = await startNewHand(supabase, roomId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/hands/abort - emergency escape hatch for a hand stuck in a
// non-actionable phase. Refunds everyone's committed chips for the current
// hand and marks it complete so a fresh hand can be started. Restricted to
// the room creator, since it's a disruptive override of normal gameplay.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { forceEndHand } from "@/lib/gameEngine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const roomId = body.roomId;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("created_by")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.created_by !== user.id) {
      return NextResponse.json({ error: "Only the room creator can force-end a stuck hand" }, { status: 403 });
    }

    const { data: gameState, error: gsError } = await supabase
      .from("game_state")
      .select("hand_id, phase")
      .eq("room_id", roomId)
      .single();
    if (gsError || !gameState?.hand_id) {
      return NextResponse.json({ error: "No hand in progress for this room" }, { status: 409 });
    }
    if (gameState.phase === "hand_complete" || gameState.phase === "waiting_room") {
      return NextResponse.json({ error: "No stuck hand to end" }, { status: 409 });
    }

    await forceEndHand(supabase, roomId, gameState.hand_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

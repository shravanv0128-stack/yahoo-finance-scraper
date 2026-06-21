// POST /api/rooms/pause - lets the current room leader pause/resume the
// action clock for the whole table (e.g. someone's AFK and about to get
// auto-folded). See gameEngine.setRoomPaused for what pausing/resuming
// actually does to game_state.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { syncRoomLeader } from "@/lib/roomLeader";
import { setRoomPaused } from "@/lib/gameEngine";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; paused?: boolean };
    if (!body.roomId || typeof body.paused !== "boolean") {
      return NextResponse.json({ error: "roomId and paused are required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { leaderId } = await syncRoomLeader(supabase, body.roomId);
    if (leaderId !== user.id) {
      return NextResponse.json({ error: "Only the room leader can pause the game" }, { status: 403 });
    }

    await setRoomPaused(supabase, body.roomId, body.paused);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

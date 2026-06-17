// POST /api/players/away - toggle the calling user's own "away" status for a
// room (e.g. stepping away from the table). Away players keep their seat and
// chip_stack but are skipped when dealing new hands (see startNewHand's
// is_away filter), and can toggle back at any time to resume play from the
// same account with the same stack.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; away?: boolean };
    if (!body.roomId || typeof body.away !== "boolean") {
      return NextResponse.json({ error: "roomId and away (boolean) are required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: player, error: playerError } = await supabase
      .from("players")
      .update({ is_away: body.away })
      .eq("room_id", body.roomId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (playerError || !player) {
      return NextResponse.json({ error: "You are not seated in this room" }, { status: 404 });
    }

    return NextResponse.json({ player });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

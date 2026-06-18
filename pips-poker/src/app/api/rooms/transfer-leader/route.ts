// POST /api/rooms/transfer-leader - lets the current room leader hand host
// powers (ledger edits, force-end-stuck-hand, future transfers) to another
// seated player. See src/lib/roomLeader.ts for how this interacts with the
// automatic creator-busts/rebuys failover.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { transferLeadership } from "@/lib/roomLeader";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; toUserId?: string };
    if (!body.roomId || !body.toUserId) {
      return NextResponse.json({ error: "roomId and toUserId are required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    await transferLeadership(supabase, body.roomId, user.id, body.toUserId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/rooms/rebuy - self-service buy-back-in for a busted player
// (chip_stack <= 0). Adds the room's configured starting stack to both
// chip_stack and buy_in so the player can be dealt into the next hand
// without needing the room leader to do it for them via the ledger.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; amount?: number };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }
    if (body.amount !== undefined && (!Number.isFinite(body.amount) || body.amount <= 0)) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("starting_stack")
      .eq("id", body.roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", body.roomId)
      .eq("user_id", user.id)
      .single();
    if (playerError || !player) {
      return NextResponse.json({ error: "You're not seated in this room" }, { status: 404 });
    }
    if (player.chip_stack > 0) {
      return NextResponse.json({ error: "You still have chips - no rebuy needed" }, { status: 409 });
    }

    const rebuyAmount = body.amount ?? room.starting_stack ?? 1000;
    const { data: updated, error: updateError } = await supabase
      .from("players")
      .update({
        chip_stack: player.chip_stack + rebuyAmount,
        buy_in: player.buy_in + rebuyAmount,
      })
      .eq("id", player.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ player: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

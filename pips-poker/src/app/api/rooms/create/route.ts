// POST /api/rooms - create a new room and seat the creator as the first player.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, displayName } = body as { name?: string; displayName?: string };
    if (!displayName) {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code: generateRoomCode(),
        name: name ?? "Pips Poker Table",
        created_by: user.id,
        ante_amount: 5,
        small_bet: 10,
      })
      .select()
      .single();
    if (roomError) throw roomError;

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        user_id: user.id,
        room_id: room.id,
        display_name: displayName,
        seat: 0,
        chip_stack: 1000,
        is_active: true,
      })
      .select()
      .single();
    if (playerError) throw playerError;

    return NextResponse.json({ room, player }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

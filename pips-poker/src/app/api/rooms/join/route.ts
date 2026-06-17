// POST /api/rooms/join - seat the calling user at a room identified by its
// shareable join code (or returns their existing seat if already joined).
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

const MAX_SEATS = 8;

export async function POST(req: NextRequest) {
  try {
    const { code, displayName } = (await req.json()) as { code?: string; displayName?: string };
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
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
      .select("*")
      .eq("code", code.toUpperCase())
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ room, player: existing });
    }

    const { data: seated, error: seatedError } = await supabase
      .from("players")
      .select("seat")
      .eq("room_id", room.id);
    if (seatedError) throw seatedError;

    const takenSeats = new Set((seated ?? []).map((p) => p.seat));
    let seat = 0;
    while (takenSeats.has(seat)) seat++;
    if (seat >= MAX_SEATS) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        user_id: user.id,
        room_id: room.id,
        display_name: displayName,
        seat,
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

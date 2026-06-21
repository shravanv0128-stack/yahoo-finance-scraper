// POST /api/rooms/settings - lets the room leader configure rotation/blind
// settings: small_blind, big_blind, rotation_mode, pips_interval. Restricted
// to the current room leader, same auth/leader-check pattern as
// src/app/api/rooms/ledger/route.ts. No existing settings route covers these
// fields (room creation only sets ante_amount/small_bet/starting_stack/etc),
// so this is a new route rather than an extension of an existing one.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { syncRoomLeader } from "@/lib/roomLeader";
import { RotationMode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      roomId?: string;
      smallBlind?: number;
      bigBlind?: number;
      rotationMode?: RotationMode;
      pipsInterval?: number;
    };
    if (!body.roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", body.roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { leaderId } = await syncRoomLeader(supabase, body.roomId);
    if (leaderId !== user.id) {
      return NextResponse.json({ error: "Only the room leader can change room settings" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (body.smallBlind !== undefined) {
      if (!Number.isFinite(body.smallBlind) || body.smallBlind <= 0) {
        return NextResponse.json({ error: "smallBlind must be a positive number" }, { status: 400 });
      }
      updates.small_blind = body.smallBlind;
    }
    if (body.bigBlind !== undefined) {
      if (!Number.isFinite(body.bigBlind) || body.bigBlind <= 0) {
        return NextResponse.json({ error: "bigBlind must be a positive number" }, { status: 400 });
      }
      updates.big_blind = body.bigBlind;
    }
    if (body.rotationMode !== undefined) {
      if (body.rotationMode !== "dealer_choice" && body.rotationMode !== "every_x") {
        return NextResponse.json({ error: "rotationMode must be 'dealer_choice' or 'every_x'" }, { status: 400 });
      }
      updates.rotation_mode = body.rotationMode;
    }
    if (body.pipsInterval !== undefined) {
      if (!Number.isInteger(body.pipsInterval) || body.pipsInterval < 2) {
        return NextResponse.json({ error: "Enter a valid hand interval." }, { status: 400 });
      }
      updates.pips_interval = body.pipsInterval;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No settings provided to update" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("rooms")
      .update(updates)
      .eq("id", body.roomId)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ room: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/rooms/chat - send a chat message to a room. Restricted to
// players actually seated in the room (not just signed-in users), mirroring
// the gameplay routes. Messages are fetched as part of /api/rooms/:roomId/state
// and pushed live via the chat_messages Realtime subscription (see
// src/hooks/useRoomRealtime.ts).
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

const MAX_MESSAGE_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; message?: string };
    const message = body.message?.trim();
    if (!body.roomId || !message) {
      return NextResponse.json({ error: "roomId and message are required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("display_name")
      .eq("room_id", body.roomId)
      .eq("user_id", user.id)
      .single();
    if (playerError || !player) {
      return NextResponse.json({ error: "You're not seated in this room" }, { status: 403 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        room_id: body.roomId,
        user_id: user.id,
        display_name: player.display_name,
        message,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ message: inserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

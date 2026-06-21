// POST /api/rooms/kick - lets the current room leader remove a seated player
// from the table. Marks the target player is_active=false (same flag the
// rest of the app already treats as "not seated" - excluded from new hands
// in gameEngine.startNewHand, and from leader-eligibility in roomLeader.ts),
// then re-syncs the room leader in case the kicked player was the leader.
// Cannot kick a player who is mid-hand, to avoid corrupting an in-progress
// pot/side-pot computation.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { syncRoomLeader } from "@/lib/roomLeader";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string; playerId?: string };
    if (!body.roomId || !body.playerId) {
      return NextResponse.json({ error: "roomId and playerId are required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { leaderId } = await syncRoomLeader(supabase, body.roomId);
    if (leaderId !== user.id) {
      return NextResponse.json({ error: "Only the room leader can remove a player" }, { status: 403 });
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", body.playerId)
      .eq("room_id", body.roomId)
      .single();
    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found in this room" }, { status: 404 });
    }
    if (player.user_id === user.id) {
      return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
    }

    const { data: gameState } = await supabase
      .from("game_state")
      .select("hand_id, phase")
      .eq("room_id", body.roomId)
      .maybeSingle();
    if (gameState?.hand_id && gameState.phase !== "hand_complete" && gameState.phase !== "waiting_room") {
      const { data: handPlayer } = await supabase
        .from("hand_players")
        .select("status")
        .eq("hand_id", gameState.hand_id)
        .eq("player_id", player.id)
        .maybeSingle();
      if (handPlayer && handPlayer.status !== "folded") {
        return NextResponse.json({ error: "Cannot remove a player who is mid-hand" }, { status: 409 });
      }
    }

    const { error: updateError } = await supabase
      .from("players")
      .update({ is_active: false })
      .eq("id", player.id);
    if (updateError) throw updateError;

    await syncRoomLeader(supabase, body.roomId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

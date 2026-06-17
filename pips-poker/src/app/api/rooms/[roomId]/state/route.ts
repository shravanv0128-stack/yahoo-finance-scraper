// GET /api/rooms/:roomId/state - fetch the room's players, current game
// state, and (if a hand is in progress) the calling user's own hole cards.
// Other players' hole cards are never returned here; the client otherwise
// relies on Supabase Realtime (see src/hooks/useRoomRealtime.ts) for live
// updates to public tables, which RLS already restricts appropriately.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const roomId = params.roomId;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat", { ascending: true });
    if (playersError) throw playersError;

    const { data: gameState } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", roomId)
      .maybeSingle();

    let handPlayers: unknown[] = [];
    let myHoleCards: unknown = null;

    if (gameState?.hand_id) {
      const { data: hp, error: hpError } = await supabase
        .from("hand_players")
        .select(
          "id, seat, display_name, status, chip_stack, current_bet, total_committed, has_acted_this_round, has_swapped, revealed_cards, revealed_pip_total"
        )
        .eq("hand_id", gameState.hand_id)
        .order("seat", { ascending: true });
      if (hpError) throw hpError;
      handPlayers = hp ?? [];

      const { data: mine } = await supabase
        .from("hand_players")
        .select("id")
        .eq("hand_id", gameState.hand_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (mine) {
        const { data: holeRow } = await supabase
          .from("hole_cards")
          .select("cards")
          .eq("hand_player_id", mine.id)
          .maybeSingle();
        myHoleCards = holeRow?.cards ?? null;
      }
    }

    // Strip server-only fields (deck) before returning game state to the client.
    const publicGameState = gameState
      ? {
          phase: gameState.phase,
          community_cards: gameState.community_cards,
          pot: gameState.pot,
          current_bet: gameState.current_bet,
          min_raise: gameState.min_raise,
          dealer_seat: gameState.dealer_seat,
          active_seat: gameState.active_seat,
          hand_id: gameState.hand_id,
        }
      : null;

    return NextResponse.json({
      room,
      players,
      gameState: publicGameState,
      handPlayers,
      myHoleCards,
      myUserId: user.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

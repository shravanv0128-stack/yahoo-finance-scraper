// GET /api/rooms/:roomId/state - fetch the room's players, current game
// state, and (if a hand is in progress) the calling user's own hole cards.
// Other players' hole cards are never returned here; the client otherwise
// relies on Supabase Realtime (see src/hooks/useRoomRealtime.ts) for live
// updates to public tables, which RLS already restricts appropriately.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { enforceActTimeout, startNewHand } from "@/lib/gameEngine";

// How long the completed-hand summary stays on screen before the next hand
// is dealt automatically. Long enough to read who won (and to watch both
// boards when the hand was run twice).
const AUTO_NEXT_HAND_MS = 6000;

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const roomId = params.roomId;

    // Auto-fold/check anyone whose 1-minute action clock has expired before
    // reading state back out, since there's no background timer elsewhere.
    try {
      await enforceActTimeout(supabase, roomId);
    } catch {
      // Best-effort; if this races with a real action it's safe to ignore.
    }

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

    let { data: gameState } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", roomId)
      .maybeSingle();

    // Auto-deal the next hand a few seconds after a hand completes, so the
    // table advances on its own without anyone clicking "Start hand". Only
    // the room creator's poll triggers it (matching "only the room owner can
    // start the hand"), and only after the summary has been on screen for
    // AUTO_NEXT_HAND_MS. Driven from the poll (not a client setTimeout) so it
    // still fires even if the creator's tab was backgrounded. Best-effort: if
    // it races or there aren't enough active players, it's safely ignored and
    // the creator can still start manually.
    if (
      gameState?.phase === "hand_complete" &&
      room.created_by === user.id &&
      gameState.updated_at &&
      Date.now() - new Date(gameState.updated_at).getTime() >= AUTO_NEXT_HAND_MS
    ) {
      // Atomically "claim" the right to deal the next hand by flipping the
      // phase off "hand_complete" with a conditional update. Postgres
      // serializes the row update, so if two of the creator's polls race,
      // exactly one claim returns a row and proceeds; the other sees no row
      // and skips, preventing a double-deal.
      const { data: claimed } = await supabase
        .from("game_state")
        .update({ phase: "ante" })
        .eq("room_id", roomId)
        .eq("phase", "hand_complete")
        .eq("updated_at", gameState.updated_at)
        .select("id")
        .maybeSingle();

      if (claimed) {
        try {
          await startNewHand(supabase, roomId);
        } catch {
          // Not enough active players (e.g. someone went away); roll the
          // phase back so the creator can start manually.
          await supabase
            .from("game_state")
            .update({ phase: "hand_complete" })
            .eq("room_id", roomId)
            .eq("phase", "ante");
        }
        const { data: refreshed } = await supabase
          .from("game_state")
          .select("*")
          .eq("room_id", roomId)
          .maybeSingle();
        gameState = refreshed;
      }
    }

    let handPlayers: unknown[] = [];
    let myHoleCards: unknown = null;

    if (gameState?.hand_id) {
      const { data: hp, error: hpError } = await supabase
        .from("hand_players")
        .select(
          "id, seat, display_name, status, chip_stack, current_bet, total_committed, has_acted_this_round, has_swapped, revealed_cards, revealed_pip_total, amount_won, mucked, has_decided_show"
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
          act_deadline: gameState.act_deadline,
          awaiting_run_it_twice: gameState.awaiting_run_it_twice,
          run_it_twice_votes: gameState.run_it_twice_votes ?? {},
          community_cards_2: gameState.community_cards_2,
          showdown_result: gameState.showdown_result ?? null,
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

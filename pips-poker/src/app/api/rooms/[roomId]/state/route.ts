// GET /api/rooms/:roomId/state - fetch the room's players, current game
// state, and (if a hand is in progress) the calling user's own hole cards.
// Other players' hole cards are never returned here; the client otherwise
// relies on Supabase Realtime (see src/hooks/useRoomRealtime.ts) for live
// updates to public tables, which RLS already restricts appropriately.
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { enforceActTimeout, startNewHand } from "@/lib/gameEngine";
import { buildSidePots } from "@/lib/bettingEngine";
import { syncRoomLeader } from "@/lib/roomLeader";

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

    // Keep host powers (ledger, force-end-stuck-hand, transfer leadership)
    // pointed at someone with chips: hands off from a busted leader, and
    // reclaims for the creator once they rebuy. Best-effort; failures here
    // shouldn't break loading the room.
    try {
      const synced = await syncRoomLeader(supabase, roomId);
      room.leader_id = synced.leaderId;
      room.leader_auto_assigned = synced.leaderAutoAssigned;
    } catch {
      // ignore
    }

    const eligiblePlayerCount = (players ?? []).filter(
      (p) => p.is_active && !p.is_away && p.chip_stack > 0
    ).length;

    let { data: gameState } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", roomId)
      .maybeSingle();

    // Auto-deal the next hand a few seconds after a hand completes, so the
    // table advances on its own without anyone clicking "Start hand". Any
    // seated player's poll can trigger it (not just the creator's) so the
    // table never stalls just because the owner's tab is closed or asleep -
    // the atomic claim below still guarantees exactly one deal. Driven from
    // the poll (not a client setTimeout) so it fires even on backgrounded
    // tabs. Best-effort: if it races or there aren't enough active players,
    // it's safely ignored and the owner can still start manually.
    if (
      gameState?.phase === "hand_complete" &&
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
          if (eligiblePlayerCount < 2) {
            // Fewer than two players still have chips (someone busted out
            // and didn't rebuy in time) - there's nothing to deal, so drop
            // the table back to the waiting room instead of stalling on the
            // last showdown summary. Whoever's left can rebuy/take a seat and
            // the leader (or anyone, once 2+ have chips again) can start hand.
            throw new Error("Not enough players with chips to deal a new hand");
          }
          await startNewHand(supabase, roomId);
        } catch {
          // Not enough active/funded players; reset fully to the waiting
          // room rather than getting stuck showing the last hand_complete
          // summary forever.
          await supabase
            .from("game_state")
            .update({
              phase: "waiting_room",
              hand_id: null,
              community_cards: [],
              community_cards_2: null,
              pot: 0,
              current_bet: 0,
              min_raise: 0,
              active_seat: null,
              act_deadline: null,
              awaiting_run_it_twice: false,
              run_it_twice_votes: {},
              showdown_result: null,
            })
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
          "id, seat, display_name, status, chip_stack, current_bet, total_committed, has_acted_this_round, has_swapped, swapped_count, revealed_cards, revealed_pip_total, amount_won, mucked, has_decided_show"
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

    // Break the pot into main pot + side pots for display, computed live from
    // what each player has committed this hand. Side pots only arise when one
    // or more players are all-in for less than the others, so a single-element
    // result (the common case) just renders as one "Pot" figure on the client.
    const potBreakdown =
      handPlayers.length > 0
        ? buildSidePots(
            (handPlayers as { id: string; total_committed: number; status: string }[]).map((hp) => ({
              hand_player_id: hp.id,
              total_committed: hp.total_committed,
              status: hp.status as never,
            }))
          ).map((p, i, all) => ({
            amount: p.amount,
            label: all.length === 1 ? "Pot" : i === 0 ? "Main pot" : `Side pot ${i}`,
          }))
        : [];

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
          pots: potBreakdown,
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

// gameEngine.ts orchestrates an entire hand of Pips Poker, end to end:
// ante -> deal hole cards -> flop -> flop_betting -> draw_swap -> turn ->
// turn_betting -> river -> river_betting -> showdown -> hand_complete.
//
// This module contains no Supabase-specific code paths beyond accepting a
// SupabaseClient (service-role) instance - it reads/writes the relevant
// tables directly so that all API routes (start/action/swap/showdown) share
// one implementation of "what happens at each phase transition," instead of
// duplicating logic and risking the rules drifting apart between routes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { freshShuffledDeck, drawCards, drawReplacements } from "./deck";
import {
  Card,
  GamePhase,
  BettingAction,
  ShowdownPlayerResult,
  ShowDecision,
  ShowdownResult,
  ShowdownBoardResult,
} from "./types";
import { nextPhase } from "./gamePhases";
import {
  BettingPlayerState,
  BettingRoundState,
  applyAction,
  isBettingRoundComplete,
  resetForNewRound,
  buildSidePots,
} from "./bettingEngine";
import { evaluateBestHand, findHandWinners, handCategoryLabel } from "./handEvaluator";
import { computePipTotal, findPipWinners } from "./pipEvaluator";

const DEFAULT_ACT_TIMEOUT_SECONDS = 60;

function newActDeadline(timeoutSeconds: number = DEFAULT_ACT_TIMEOUT_SECONDS): string {
  return new Date(Date.now() + timeoutSeconds * 1000).toISOString();
}

interface HandPlayerRow {
  id: string;
  hand_id: string;
  player_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  status: string;
  chip_stack: number;
  current_bet: number;
  total_committed: number;
  has_acted_this_round: boolean;
  has_swapped: boolean;
  revealed_cards: Card[] | null;
  revealed_pip_total: number | null;
  mucked: boolean;
  has_decided_show: boolean;
}

/**
 * Starts a new hand for a room: creates the `hands` row, antes every seated
 * player into the pot, deals 3 hole cards each (private, in hole_cards),
 * deals the flop (3 community cards, public), and sets phase=flop_betting.
 * No preflop betting occurs at all per the bomb-pot rule.
 */
export async function startNewHand(supabase: SupabaseClient, roomId: string) {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("ante_amount, small_bet, act_timeout_seconds")
    .eq("id", roomId)
    .single();
  if (roomError) throw roomError;
  const anteAmount = room.ante_amount ?? 0.5;
  const minBet = room.small_bet ?? 1;
  const actTimeout = room.act_timeout_seconds ?? DEFAULT_ACT_TIMEOUT_SECONDS;

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .eq("is_active", true)
    .eq("is_away", false)
    .order("seat", { ascending: true });

  if (playersError) throw playersError;
  if (!players || players.length < 2) {
    throw new Error("Need at least 2 active players to start a hand");
  }

  const { data: existingHands } = await supabase
    .from("hands")
    .select("hand_number")
    .eq("room_id", roomId)
    .order("hand_number", { ascending: false })
    .limit(1);

  const handNumber = (existingHands?.[0]?.hand_number ?? 0) + 1;

  const { data: hand, error: handError } = await supabase
    .from("hands")
    .insert({ room_id: roomId, hand_number: handNumber, phase: "ante" })
    .select()
    .single();
  if (handError) throw handError;

  let deck = freshShuffledDeck();

  // Ante: every seated player contributes ANTE_AMOUNT into the pot.
  let pot = 0;
  const handPlayers: HandPlayerRow[] = [];
  for (const player of players) {
    const ante = Math.min(anteAmount, player.chip_stack);
    pot += ante;
    const { data: hp, error: hpError } = await supabase
      .from("hand_players")
      .insert({
        hand_id: hand.id,
        player_id: player.id,
        user_id: player.user_id,
        seat: player.seat,
        display_name: player.display_name,
        status: "active",
        chip_stack: player.chip_stack - ante,
        current_bet: 0,
        total_committed: ante,
        has_acted_this_round: false,
        has_swapped: false,
        revealed_cards: null,
        revealed_pip_total: null,
      })
      .select()
      .single();
    if (hpError) throw hpError;
    handPlayers.push(hp as HandPlayerRow);

    // Reflect the ante deduction on the persistent players table immediately.
    await supabase.from("players").update({ chip_stack: player.chip_stack - ante }).eq("id", player.id);
  }

  // Deal 3 private hole cards to each player.
  for (const hp of handPlayers) {
    const { drawn, remaining } = drawCards(deck, 3);
    deck = remaining;
    const { error: holeError } = await supabase.from("hole_cards").insert({
      hand_id: hand.id,
      hand_player_id: hp.id,
      user_id: hp.user_id,
      cards: drawn,
    });
    if (holeError) throw holeError;
  }

  // Deal the flop (3 community cards).
  const { drawn: flopCards, remaining: deckAfterFlop } = drawCards(deck, 3);
  deck = deckAfterFlop;

  await supabase.from("hands").update({ phase: "flop_betting", pot }).eq("id", hand.id);

  const firstToAct = handPlayers[0];

  await supabase.from("game_state").upsert(
    {
      room_id: roomId,
      hand_id: hand.id,
      phase: "flop_betting" as GamePhase,
      community_cards: flopCards,
      deck,
      pot,
      current_bet: 0,
      min_raise: minBet,
      dealer_seat: players[0].seat,
      active_seat: firstToAct.seat,
      act_deadline: newActDeadline(actTimeout),
      awaiting_run_it_twice: false,
      run_it_twice_votes: {},
      community_cards_2: null,
      showdown_result: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" }
  );

  return { hand, handPlayers, communityCards: flopCards, pot };
}

/** Build a BettingRoundState snapshot from the DB rows for a hand. */
function toBettingState(handPlayers: HandPlayerRow[], pot: number, currentBet: number, minRaise: number): BettingRoundState {
  return {
    players: handPlayers.map((hp): BettingPlayerState => ({
      hand_player_id: hp.id,
      seat: hp.seat,
      chip_stack: hp.chip_stack,
      current_bet: hp.current_bet,
      total_committed: hp.total_committed,
      status: hp.status as BettingPlayerState["status"],
      has_acted_this_round: hp.has_acted_this_round,
    })),
    currentBet,
    minRaise,
    pot,
  };
}

/**
 * Apply a single betting action (check/call/bet/raise/fold/all_in) for a
 * player during a betting phase. Persists the new state, logs the action,
 * and advances the phase automatically if the betting round has closed.
 */
export async function applyBettingAction(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  handPlayerId: string,
  action: BettingAction,
  amount: number
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;
  if (!["flop_betting", "turn_betting", "river_betting"].includes(gameState.phase)) {
    throw new Error(`Cannot take a betting action during phase ${gameState.phase}`);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("small_bet, act_timeout_seconds, allow_run_it_twice")
    .eq("id", roomId)
    .single();
  if (roomError) throw roomError;
  const minBet = room.small_bet ?? 1;
  const actTimeout = room.act_timeout_seconds ?? DEFAULT_ACT_TIMEOUT_SECONDS;
  const allowRunItTwice = room.allow_run_it_twice !== false;

  const { data: handPlayers, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("hand_id", handId)
    .order("seat", { ascending: true });
  if (hpError) throw hpError;

  const bettingState = toBettingState(
    handPlayers as HandPlayerRow[],
    gameState.pot,
    gameState.current_bet,
    gameState.min_raise
  );

  const result = applyAction(bettingState, handPlayerId, action, amount);
  if (result.error) {
    throw new Error(result.error);
  }

  // Persist each player's updated betting fields.
  for (const p of result.state.players) {
    await supabase
      .from("hand_players")
      .update({
        chip_stack: p.chip_stack,
        current_bet: p.current_bet,
        total_committed: p.total_committed,
        status: p.status,
        has_acted_this_round: p.has_acted_this_round,
      })
      .eq("id", p.hand_player_id);
  }

  await supabase.from("actions").insert({
    hand_id: handId,
    hand_player_id: handPlayerId,
    user_id: (handPlayers as HandPlayerRow[]).find((p) => p.id === handPlayerId)?.user_id,
    action,
    amount,
    phase: gameState.phase,
  });

  const roundComplete = isBettingRoundComplete(result.state);
  const contenders = result.state.players.filter((p) => p.status !== "folded");

  let newPhase: GamePhase = gameState.phase;
  let newCommunityCards: Card[] = gameState.community_cards;
  let newDeck: Card[] = gameState.deck;
  let nextActiveSeat: number | null = gameState.active_seat;
  let awaitingRunItTwice = false;

  if (roundComplete) {
    const activePlayers = result.state.players.filter((p) => p.status === "active");

    if (contenders.length <= 1) {
      // Everyone else folded - skip straight to showdown logic (single winner).
      newPhase = "showdown";
    } else if (activePlayers.length <= 1 && gameState.phase !== "river_betting") {
      // Every remaining contender (other than at most one) is all-in with at
      // least one more street still to come - pause and let the table decide
      // whether to run the board once or twice instead of auto-dealing.
      newPhase = "all_in_runout";
      awaitingRunItTwice = true;
    } else if (gameState.phase === "river_betting") {
      // River betting just finished with multiple contenders still able to
      // act - go straight to showdown (winner is determined and the pot is
      // paid out automatically; players can optionally reveal their cards
      // afterwards for show, but that never blocks or changes the payout).
      newPhase = "showdown";
    } else {
      newPhase = nextPhase(gameState.phase); // e.g. flop_betting -> draw_swap
      if (newPhase === "turn") {
        const { drawn, remaining } = drawCards(newDeck, 1);
        newCommunityCards = [...newCommunityCards, ...drawn];
        newDeck = remaining;
        newPhase = nextPhase(newPhase); // turn -> turn_betting
      } else if (newPhase === "river") {
        const { drawn, remaining } = drawCards(newDeck, 1);
        newCommunityCards = [...newCommunityCards, ...drawn];
        newDeck = remaining;
        newPhase = nextPhase(newPhase); // river -> river_betting
      }
      // Reset per-round betting fields for the next round (skip if heading into draw_swap,
      // since draw_swap has its own has_swapped tracking, not has_acted_this_round).
      const resetPlayers = resetForNewRound(result.state.players);
      for (const p of resetPlayers) {
        await supabase
          .from("hand_players")
          .update({ current_bet: 0, has_acted_this_round: p.has_acted_this_round })
          .eq("id", p.hand_player_id);
      }
    }
    nextActiveSeat = newPhase === "all_in_runout" || newPhase === "showdown"
      ? null
      : activePlayers.length > 0
        ? activePlayers[0].seat
        : null;
  } else {
    // Advance active_seat to the next contender in seat order who can still act.
    const ordered = result.state.players.slice().sort((a, b) => a.seat - b.seat);
    const currentIdx = ordered.findIndex((p) => p.hand_player_id === handPlayerId);
    for (let i = 1; i <= ordered.length; i++) {
      const candidate = ordered[(currentIdx + i) % ordered.length];
      if (candidate.status === "active") {
        nextActiveSeat = candidate.seat;
        break;
      }
    }
  }

  await supabase
    .from("game_state")
    .update({
      phase: newPhase,
      community_cards: newCommunityCards,
      deck: newDeck,
      pot: result.state.pot,
      current_bet: roundComplete ? 0 : result.state.currentBet,
      min_raise: roundComplete ? minBet : result.state.minRaise,
      active_seat: nextActiveSeat,
      act_deadline: nextActiveSeat !== null ? newActDeadline(actTimeout) : null,
      awaiting_run_it_twice: awaitingRunItTwice && allowRunItTwice,
      run_it_twice_votes: {},
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);

  await supabase.from("hands").update({ phase: newPhase, pot: result.state.pot }).eq("id", handId);

  if (newPhase === "showdown") {
    await runShowdown(supabase, roomId, handId);
  } else if (newPhase === "all_in_runout" && !allowRunItTwice) {
    // The host disabled run-it-twice, so there's no decision to wait on -
    // deal the single remaining board and resolve the showdown immediately.
    await resolveRunItTwice(supabase, roomId, handId, false);
  }

  return { phase: newPhase, pot: result.state.pot };
}

/**
 * Lazily enforces the 1-minute action clock: if the room's game_state has a
 * past-due act_deadline for the current active_seat during a betting phase,
 * auto-acts on that player's behalf (fold if facing a bet, check otherwise)
 * and advances the game exactly as if they'd clicked the button themselves.
 * There's no background scheduler in this app, so this is called from the
 * polled GET /api/rooms/:roomId/state route on every request - timeouts are
 * enforced within ~one poll interval of expiring, which is fine for a
 * friends game.
 */
export async function enforceActTimeout(supabase: SupabaseClient, roomId: string) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (gsError) throw gsError;
  if (!gameState || !gameState.hand_id) return;
  if (!["flop_betting", "turn_betting", "river_betting"].includes(gameState.phase)) return;
  if (gameState.active_seat === null || !gameState.act_deadline) return;
  if (new Date(gameState.act_deadline).getTime() > Date.now()) return;

  const { data: handPlayer, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("hand_id", gameState.hand_id)
    .eq("seat", gameState.active_seat)
    .maybeSingle();
  if (hpError) throw hpError;
  if (!handPlayer) return;

  const toCall = Math.max(0, gameState.current_bet - handPlayer.current_bet);
  const action: BettingAction = toCall > 0 ? "fold" : "check";

  await applyBettingAction(supabase, roomId, gameState.hand_id, handPlayer.id, action, 0);
}

/**
 * Records one contender's run-it-twice vote and resolves the table's
 * decision once everyone eligible has weighed in: unanimous "run it twice"
 * votes resolve to two boards, but a single "run it once" vote (or anyone
 * declining) resolves immediately to one board - matching the real-room
 * convention that running it twice requires everyone at the table to agree.
 */
export async function castRunItTwiceVote(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  handPlayerId: string,
  vote: boolean
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("phase, run_it_twice_votes")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;
  if (gameState.phase !== "all_in_runout") {
    throw new Error("No run-it-twice decision is pending for this room");
  }

  if (!vote) {
    // A single decline is enough to settle it - run the board once.
    await resolveRunItTwice(supabase, roomId, handId, false);
    return { resolved: true, runTwice: false };
  }

  const votes: Record<string, boolean> = { ...(gameState.run_it_twice_votes ?? {}), [handPlayerId]: true };

  const { data: handPlayers, error: hpError } = await supabase
    .from("hand_players")
    .select("id, status")
    .eq("hand_id", handId);
  if (hpError) throw hpError;
  const contenderIds = (handPlayers as { id: string; status: string }[])
    .filter((p) => p.status !== "folded")
    .map((p) => p.id);

  const allVotedYes = contenderIds.every((id) => votes[id] === true);

  if (allVotedYes) {
    await resolveRunItTwice(supabase, roomId, handId, true);
    return { resolved: true, runTwice: true };
  }

  await supabase.from("game_state").update({ run_it_twice_votes: votes }).eq("room_id", roomId);
  return { resolved: false, votes };
}

/**
 * Resolves an "all_in_runout" pause: deals the remaining community cards
 * either once (runTwice=false) or twice as two independent boards
 * (runTwice=true, the standard "run it twice" rule - each board gets dealt
 * from the same remaining deck in sequence and the pot is split 50/50
 * between the two board outcomes). Then runs showdown against the
 * resulting board(s).
 */
async function resolveRunItTwice(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  runTwice: boolean
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;
  if (gameState.phase !== "all_in_runout") {
    throw new Error(`Cannot resolve run-it-twice during phase ${gameState.phase}`);
  }

  const cardsNeeded = 5 - (gameState.community_cards as Card[]).length;
  let deck: Card[] = gameState.deck;

  const { drawn: board1Extra, remaining: afterBoard1 } = drawCards(deck, cardsNeeded);
  const board1: Card[] = [...(gameState.community_cards as Card[]), ...board1Extra];
  deck = afterBoard1;

  let board2: Card[] | null = null;
  if (runTwice && cardsNeeded > 0) {
    const { drawn: board2Extra, remaining: afterBoard2 } = drawCards(deck, cardsNeeded);
    board2 = [...(gameState.community_cards as Card[]), ...board2Extra];
    deck = afterBoard2;
  }

  await supabase
    .from("game_state")
    .update({
      community_cards: board1,
      community_cards_2: board2,
      deck,
      awaiting_run_it_twice: false,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);

  await runShowdown(supabase, roomId, handId, board2 ? [board1, board2] : [board1]);

  return { boards: board2 ? [board1, board2] : [board1] };
}

/**
 * Apply a draw_swap action: a player discards 1-3 of their hole cards and
 * draws replacements. Each active player gets exactly one chance to do this
 * (tracked via hand_players.has_swapped). Once every non-folded player has
 * either swapped or explicitly stood pat, the phase advances to "turn".
 */
export async function applySwap(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  handPlayerId: string,
  discardIndices: number[] // indices (0-2) into the player's current 3 hole cards
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;
  if (gameState.phase !== "draw_swap") {
    throw new Error(`Cannot swap cards during phase ${gameState.phase}`);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("small_bet, act_timeout_seconds")
    .eq("id", roomId)
    .single();
  if (roomError) throw roomError;
  const minBet = room.small_bet ?? 1;
  const actTimeout = room.act_timeout_seconds ?? DEFAULT_ACT_TIMEOUT_SECONDS;

  const { data: handPlayer, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("id", handPlayerId)
    .single();
  if (hpError) throw hpError;
  if (handPlayer.status === "folded") throw new Error("Folded players cannot swap cards");
  if (handPlayer.has_swapped) throw new Error("Player has already used their swap for this hand");
  if (discardIndices.length < 0 || discardIndices.length > 3) {
    throw new Error("Can discard 0 to 3 cards");
  }

  const { data: holeRow, error: holeError } = await supabase
    .from("hole_cards")
    .select("*")
    .eq("hand_player_id", handPlayerId)
    .single();
  if (holeError) throw holeError;

  const currentCards: Card[] = holeRow.cards;
  const discardSet = new Set(discardIndices);
  const keptCards = currentCards.filter((_, i) => !discardSet.has(i));
  const discardCount = currentCards.length - keptCards.length;

  let deck: Card[] = gameState.deck;
  let newHand = keptCards;
  if (discardCount > 0) {
    const result = drawReplacements(deck, keptCards, discardCount);
    newHand = result.newHand;
    deck = result.remaining;
  }

  await supabase.from("hole_cards").update({ cards: newHand }).eq("id", holeRow.id);
  await supabase.from("hand_players").update({ has_swapped: true }).eq("id", handPlayerId);
  await supabase.from("game_state").update({ deck, updated_at: new Date().toISOString() }).eq("room_id", roomId);

  // Check whether every non-folded player has now swapped (or stood pat = also has_swapped=true).
  const { data: allHandPlayers, error: allError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("hand_id", handId);
  if (allError) throw allError;

  const contenders = (allHandPlayers as HandPlayerRow[]).filter((p) => p.status !== "folded");
  const allSwapped = contenders.every((p) => (p.id === handPlayerId ? true : p.has_swapped));

  if (allSwapped) {
    const { drawn, remaining } = drawCards(deck, 1); // deal the turn card
    const newCommunity = [...gameState.community_cards, ...drawn];

    const resetPlayers = resetForNewRound(
      contenders.map((p) => ({
        hand_player_id: p.id,
        seat: p.seat,
        chip_stack: p.chip_stack,
        current_bet: p.current_bet,
        total_committed: p.total_committed,
        status: p.status as BettingPlayerState["status"],
        has_acted_this_round: p.has_acted_this_round,
      }))
    );
    for (const p of resetPlayers) {
      await supabase
        .from("hand_players")
        .update({ current_bet: 0, has_acted_this_round: p.has_acted_this_round })
        .eq("id", p.hand_player_id);
    }

    const firstActive = resetPlayers.find((p) => p.status === "active");

    await supabase
      .from("game_state")
      .update({
        phase: "turn_betting" as GamePhase,
        community_cards: newCommunity,
        deck: remaining,
        current_bet: 0,
        min_raise: minBet,
        active_seat: firstActive ? firstActive.seat : null,
        act_deadline: firstActive ? newActDeadline(actTimeout) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);
    await supabase.from("hands").update({ phase: "turn_betting" }).eq("id", handId);
    return { phase: "turn_betting", advanced: true };
  }

  return { phase: "draw_swap", advanced: false };
}

/**
 * Runs the showdown: for every non-folded player, evaluates their best
 * 2-hole+3-board poker hand and their 3-card pip total, splits the pot
 * 50/50 between the two halves, splits each half evenly among ties
 * (odd cents go to the first tied player by seat order), updates chip
 * stacks, copies hole cards into the public revealed_cards column, and
 * sets phase=hand_complete.
 */
export async function runShowdown(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  boards?: Card[][]
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;

  const { data: handPlayers, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("hand_id", handId)
    .order("seat", { ascending: true });
  if (hpError) throw hpError;

  // The winner is always determined and the pot always paid out based on
  // every non-folded player's actual hand - mucking is purely cosmetic
  // (hides a losing hand from the table) and never affects who wins.
  const contenders = (handPlayers as HandPlayerRow[]).filter((p) => p.status !== "folded");
  // boards.length === 2 means "run it twice" was chosen; otherwise a single
  // board (either the normal showdown, or a single confirmed run-out).
  const resolvedBoards: Card[][] = boards && boards.length > 0 ? boards : [gameState.community_cards as Card[]];

  const sidePots = buildSidePots(
    (handPlayers as HandPlayerRow[]).map((p) => ({
      hand_player_id: p.id,
      total_committed: p.total_committed,
      status: p.status as any,
    }))
  );

  const entries: {
    hand_player_id: string;
    seat: number;
    display_name: string;
    bestHand: ReturnType<typeof evaluateBestHand>;
    pipResult: ReturnType<typeof computePipTotal>;
    holeCards: Card[];
  }[] = [];

  for (const cp of contenders) {
    const { data: holeRow, error: holeError } = await supabase
      .from("hole_cards")
      .select("*")
      .eq("hand_player_id", cp.id)
      .single();
    if (holeError) throw holeError;
    const holeCards: Card[] = holeRow.cards;

    const bestHand =
      contenders.length === 1 ? null : evaluateBestHand(holeCards, resolvedBoards[0]);
    const pipResult = computePipTotal(holeCards);

    entries.push({
      hand_player_id: cp.id,
      seat: cp.seat,
      display_name: cp.display_name,
      bestHand: bestHand as any,
      pipResult,
      holeCards,
    });
  }

  const winnings = new Map<string, number>();
  for (const e of entries) winnings.set(e.hand_player_id, 0);

  // Build a display-ready, per-board breakdown alongside the raw chip math
  // so the client can show exactly who won which pot and with what hand.
  const boardResults: ShowdownBoardResult[] = [];
  const ranItTwice = resolvedBoards.length === 2;

  if (contenders.length === 1) {
    // Everyone else folded; sole remaining player takes the entire pot
    // (both halves), no hand evaluation needed.
    winnings.set(entries[0].hand_player_id, gameState.pot);
    boardResults.push({
      label: "",
      communityCards: resolvedBoards[0],
      pokerWinners: [
        { displayName: entries[0].display_name, amount: gameState.pot, handLabel: "Everyone else folded" },
      ],
      pipWinners: [],
    });
  } else {
    // Each side pot is split evenly across the run-out boards (1 or 2 for
    // "run it twice"), and within each board's share, split 50/50 between
    // the poker half and the pip half. Each sub-pot is restricted to that
    // side pot's eligible players, mirroring how side pots normally
    // distribute betting chips.
    resolvedBoards.forEach((board, boardIdx) => {
      // Per-board aggregation of who won the poker half and the pip half
      // (summed across all side pots for this board).
      const pokerAgg = new Map<string, { amount: number; handLabel: string }>();
      const pipAgg = new Map<string, { amount: number; pipTotal: number }>();

      for (const sidePot of sidePots) {
        const eligibleHandPlayerIds = sidePot.eligibleHandPlayerIds;
        const perBoardAmount = sidePot.amount / resolvedBoards.length;

        const eligibleEntries = entries
          .filter((e) => eligibleHandPlayerIds.includes(e.hand_player_id))
          .map((e) => ({ ...e, bestHand: evaluateBestHand(e.holeCards, board) }));
        if (eligibleEntries.length === 0) continue;

        const pokerHalf = perBoardAmount / 2;
        const pipHalf = perBoardAmount - pokerHalf; // ensures halves sum exactly to perBoardAmount

        const pokerWinners = findHandWinners(eligibleEntries);
        const pipWinners = findPipWinners(eligibleEntries);
        distributeShare(pokerHalf, pokerWinners, winnings);
        distributeShare(pipHalf, pipWinners, winnings);

        const pokerEach = pokerHalf / pokerWinners.length;
        for (const w of pokerWinners) {
          const prev = pokerAgg.get(w.display_name);
          pokerAgg.set(w.display_name, {
            amount: (prev?.amount ?? 0) + pokerEach,
            handLabel: handCategoryLabel(w.bestHand),
          });
        }
        const pipEach = pipHalf / pipWinners.length;
        for (const w of pipWinners) {
          const prev = pipAgg.get(w.display_name);
          pipAgg.set(w.display_name, {
            amount: (prev?.amount ?? 0) + pipEach,
            pipTotal: w.pipResult.total,
          });
        }
      }

      boardResults.push({
        label: ranItTwice ? `Board ${boardIdx + 1}` : "",
        communityCards: board,
        pokerWinners: Array.from(pokerAgg.entries()).map(([displayName, v]) => ({
          displayName,
          amount: Math.round(v.amount * 100) / 100,
          handLabel: v.handLabel,
        })),
        pipWinners: Array.from(pipAgg.entries()).map(([displayName, v]) => ({
          displayName,
          amount: Math.round(v.amount * 100) / 100,
          pipTotal: v.pipTotal,
        })),
      });
    });
  }

  const showdownResult: ShowdownResult = {
    ranItTwice,
    uncontested: contenders.length === 1,
    boards: boardResults,
  };

  const showdownResults: ShowdownPlayerResult[] = entries.map((e) => ({
    hand_player_id: e.hand_player_id,
    seat: e.seat,
    display_name: e.display_name,
    bestHand: e.bestHand,
    pipResult: e.pipResult,
    pokerWinShare: 0,
    pipWinShare: 0,
    totalWin: winnings.get(e.hand_player_id) ?? 0,
  }));

  // Persist: update chip stacks (hand_players + players table). When the pot
  // was contested (multiple players saw the river), everyone's cards are
  // revealed so the table can see exactly what each player held and why the
  // pot split the way it did. When it was uncontested (everyone folded), the
  // sole winner's cards stay hidden - they never had to show.
  const uncontested = contenders.length === 1;
  for (const e of entries) {
    const win = winnings.get(e.hand_player_id) ?? 0;
    const hp = (handPlayers as HandPlayerRow[]).find((p) => p.id === e.hand_player_id)!;
    const newStack = hp.chip_stack + win;
    const reveal = !uncontested;

    await supabase
      .from("hand_players")
      .update({
        revealed_cards: reveal ? e.holeCards : null,
        revealed_pip_total: reveal ? e.pipResult.total : null,
        mucked: !reveal,
        chip_stack: newStack,
        amount_won: win,
      })
      .eq("id", e.hand_player_id);

    await supabase.from("players").update({ chip_stack: newStack }).eq("id", hp.player_id);
  }

  await supabase
    .from("game_state")
    .update({
      phase: "hand_complete" as GamePhase,
      pot: 0,
      active_seat: null,
      act_deadline: null,
      awaiting_run_it_twice: false,
      showdown_result: showdownResult,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);
  await supabase
    .from("hands")
    .update({ phase: "hand_complete", pot: 0, completed_at: new Date().toISOString() })
    .eq("id", handId);

  return showdownResults;
}

/**
 * Emergency recovery for a hand stuck in a non-actionable phase (e.g. left
 * over from a since-fixed bug, or any other unexpected dead end where no
 * player has a button to press). Refunds every hand_player's total_committed
 * chips back to their stack - nobody wins or loses anything, it's simply as
 * if the hand never happened - and marks the hand complete so the room
 * creator can start a fresh one. Restricted to the room creator (enforced by
 * the API route, not here).
 */
export async function forceEndHand(supabase: SupabaseClient, roomId: string, handId: string) {
  const { data: handPlayers, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("hand_id", handId);
  if (hpError) throw hpError;

  for (const hp of handPlayers as HandPlayerRow[]) {
    const refund = (hp as any).total_committed as number;
    const newStack = hp.chip_stack + refund;
    await supabase
      .from("hand_players")
      .update({ chip_stack: newStack, current_bet: 0, total_committed: 0, amount_won: 0, status: "active" })
      .eq("id", hp.id);
    await supabase.from("players").update({ chip_stack: newStack }).eq("id", (hp as any).player_id);
  }

  await supabase
    .from("game_state")
    .update({
      phase: "hand_complete" as GamePhase,
      pot: 0,
      active_seat: null,
      act_deadline: null,
      awaiting_run_it_twice: false,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);
  await supabase
    .from("hands")
    .update({ phase: "hand_complete", pot: 0, completed_at: new Date().toISOString() })
    .eq("id", handId);
}

/**
 * Apply one player's show/muck decision during a contested showdown.
 * Lets a non-winning, non-folded player optionally reveal their hole cards
 * after the hand is already complete (purely cosmetic - the winner and the
 * payout were already finalized by runShowdown, so this never reopens or
 * changes the result; it just toggles what the table can see).
 */
export async function applyShowDecision(
  supabase: SupabaseClient,
  roomId: string,
  handId: string,
  handPlayerId: string,
  decision: ShowDecision
) {
  const { data: gameState, error: gsError } = await supabase
    .from("game_state")
    .select("phase")
    .eq("room_id", roomId)
    .single();
  if (gsError) throw gsError;
  if (gameState.phase !== "hand_complete") {
    throw new Error("Cards can only be shown or mucked once the hand is complete");
  }

  const { data: handPlayer, error: hpError } = await supabase
    .from("hand_players")
    .select("*")
    .eq("id", handPlayerId)
    .eq("hand_id", handId)
    .single();
  if (hpError || !handPlayer) throw new Error("Player not found in this hand");
  const actor = handPlayer as HandPlayerRow;
  if (actor.status === "folded") {
    throw new Error("Folded players have no cards to show");
  }

  if (decision === "show") {
    const { data: holeRow, error: holeError } = await supabase
      .from("hole_cards")
      .select("cards")
      .eq("hand_player_id", handPlayerId)
      .single();
    if (holeError) throw holeError;
    const holeCards: Card[] = holeRow.cards;
    await supabase
      .from("hand_players")
      .update({
        has_decided_show: true,
        mucked: false,
        revealed_cards: holeCards,
        revealed_pip_total: computePipTotal(holeCards).total,
      })
      .eq("id", handPlayerId);
  } else {
    await supabase
      .from("hand_players")
      .update({ has_decided_show: true, mucked: true, revealed_cards: null, revealed_pip_total: null })
      .eq("id", handPlayerId);
  }

  return { phase: "hand_complete" as GamePhase };
}

/**
 * Split `amount` evenly among `winners` (by hand_player_id), crediting any
 * leftover odd cents to the first tied winner in seat order. Mutates the
 * provided `winnings` map in place.
 */
function distributeShare<T extends { hand_player_id: string; seat: number }>(
  amount: number,
  winners: T[],
  winnings: Map<string, number>
) {
  if (winners.length === 0 || amount === 0) return;
  const sorted = winners.slice().sort((a, b) => a.seat - b.seat);
  const n = sorted.length;

  // Work in integer cents to avoid floating point remainder issues, then
  // convert back to dollars. Odd cents go to the first player by seat order.
  const totalCents = Math.round(amount * 100);
  const baseShareCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseShareCents * n;

  sorted.forEach((w, i) => {
    const shareCents = baseShareCents + (i < remainderCents ? 1 : 0);
    const current = winnings.get(w.hand_player_id) ?? 0;
    winnings.set(w.hand_player_id, current + shareCents / 100);
  });
}

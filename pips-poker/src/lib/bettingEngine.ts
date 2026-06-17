// Betting engine: tracks pot/current-bet/call-amount state for a single
// betting round and validates/applies player actions. Also computes a
// simplified-but-correct side-pot split for the betting half of the pot
// when one or more players are all-in for less than the full bet.
//
// SIMPLIFYING ASSUMPTION (documented per task spec): we build side pots by
// the classic "layers" algorithm - sort distinct contribution levels, and
// each layer is shared by every player who contributed at least that much
// and hasn't folded. This is fully correct for any number of all-ins, not
// just one or two, but we keep the implementation single-pass/simple rather
// than optimizing. The bomb-pot ante and any draw_swap step never touch this
// engine - only the three betting rounds (flop/turn/river_betting) do, so
// the "pot" tracked here accumulates across those three rounds on top of
// the ante pot that gameEngine.ts seeds in separately.

import { BettingAction, PlayerStatus } from "./types";

export interface BettingPlayerState {
  hand_player_id: string;
  seat: number;
  chip_stack: number; // chips NOT yet committed this hand
  current_bet: number; // committed during the CURRENT betting round only
  total_committed: number; // committed across the whole hand (all rounds + ante)
  status: PlayerStatus;
  has_acted_this_round: boolean;
}

export interface BettingRoundState {
  players: BettingPlayerState[];
  currentBet: number; // highest current_bet among active players this round
  minRaise: number; // minimum size of the next raise increment
  pot: number; // chips already committed to the pot before this round started
}

export interface ApplyActionResult {
  state: BettingRoundState;
  error?: string;
}

/** Amount a player must add to call up to the current bet. */
export function callAmount(state: BettingRoundState, player: BettingPlayerState): number {
  return Math.max(0, state.currentBet - player.current_bet);
}

/**
 * Validate and apply a single betting action for one player. Returns a new
 * state (does not mutate input) plus an error string if the action was
 * illegal (callers should reject the request and not advance phases).
 */
export function applyAction(
  state: BettingRoundState,
  handPlayerId: string,
  action: BettingAction,
  amount: number = 0
): ApplyActionResult {
  const players = state.players.map((p) => ({ ...p }));
  const player = players.find((p) => p.hand_player_id === handPlayerId);

  if (!player) {
    return { state, error: "Player not found in this betting round" };
  }
  if (player.status === "folded") {
    return { state, error: "Player has already folded" };
  }
  if (player.status === "all_in") {
    return { state, error: "Player is already all-in and cannot act again" };
  }

  const toCall = callAmount(state, player);
  let newCurrentBet = state.currentBet;
  let newMinRaise = state.minRaise;
  let potDelta = 0;

  switch (action) {
    case "fold": {
      player.status = "folded";
      break;
    }
    case "check": {
      if (toCall !== 0) {
        return { state, error: "Cannot check when facing a bet; must call, raise, or fold" };
      }
      break;
    }
    case "call": {
      if (toCall === 0) {
        return { state, error: "Nothing to call; use check instead" };
      }
      const callChips = Math.min(toCall, player.chip_stack);
      player.chip_stack -= callChips;
      player.current_bet += callChips;
      player.total_committed += callChips;
      potDelta = callChips;
      if (player.chip_stack === 0) player.status = "all_in";
      break;
    }
    case "bet":
    case "raise": {
      if (amount <= 0) {
        return { state, error: "Bet/raise amount must be positive" };
      }
      const targetBet = player.current_bet + amount; // amount = chips added this action
      const raiseIncrement = targetBet - state.currentBet;
      if (action === "bet" && state.currentBet !== 0) {
        return { state, error: "Cannot bet when there is already a bet; use raise" };
      }
      if (action === "raise" && state.currentBet === 0) {
        return { state, error: "Cannot raise when there is no bet yet; use bet" };
      }
      if (amount > player.chip_stack) {
        return { state, error: "Not enough chips for that bet/raise" };
      }
      if (amount > state.pot) {
        return { state, error: `Max bet is the size of the pot ($${state.pot})` };
      }
      player.chip_stack -= amount;
      player.current_bet += amount;
      player.total_committed += amount;
      potDelta = amount;
      newMinRaise = Math.max(state.minRaise, raiseIncrement);
      newCurrentBet = player.current_bet;
      if (player.chip_stack === 0) player.status = "all_in";
      // A bet/raise reopens action: every other non-folded, non-all-in player
      // must act again.
      for (const p of players) {
        if (p.hand_player_id !== player.hand_player_id && p.status === "active") {
          p.has_acted_this_round = false;
        }
      }
      break;
    }
    case "all_in": {
      const allInAmount = player.chip_stack;
      if (allInAmount <= 0) {
        return { state, error: "Player has no chips left to go all-in with" };
      }
      player.chip_stack = 0;
      player.current_bet += allInAmount;
      player.total_committed += allInAmount;
      potDelta = allInAmount;
      player.status = "all_in";
      if (player.current_bet > state.currentBet) {
        const raiseIncrement = player.current_bet - state.currentBet;
        newMinRaise = Math.max(state.minRaise, raiseIncrement);
        newCurrentBet = player.current_bet;
        for (const p of players) {
          if (p.hand_player_id !== player.hand_player_id && p.status === "active") {
            p.has_acted_this_round = false;
          }
        }
      }
      break;
    }
  }

  player.has_acted_this_round = true;

  return {
    state: {
      players,
      currentBet: newCurrentBet,
      minRaise: newMinRaise,
      pot: state.pot + potDelta,
    },
  };
}

/**
 * A betting round is closed when every player who is still "active"
 * (not folded, not all-in) has acted AND has matched the current bet
 * (or there's at most one player left who can still act).
 */
export function isBettingRoundComplete(state: BettingRoundState): boolean {
  const contenders = state.players.filter((p) => p.status !== "folded");
  if (contenders.length <= 1) return true;

  const stillToAct = contenders.filter((p) => p.status === "active");
  if (stillToAct.length === 0) return true; // everyone left is all-in

  return stillToAct.every((p) => p.has_acted_this_round && p.current_bet === state.currentBet);
}

/** Reset per-round fields (current_bet, has_acted_this_round) for a new betting round. */
export function resetForNewRound(players: BettingPlayerState[]): BettingPlayerState[] {
  return players.map((p) => ({
    ...p,
    current_bet: 0,
    has_acted_this_round: p.status === "folded" || p.status === "all_in",
  }));
}

export interface SidePot {
  amount: number;
  eligibleHandPlayerIds: string[];
}

/**
 * Build side pots from each player's total_committed chips this hand.
 * Layers algorithm: sort unique non-zero contribution levels ascending;
 * each layer's pot size is (level - previousLevel) * (number of players who
 * contributed at least `level`), and is only eligible to be won by
 * non-folded players who contributed at least that level.
 */
export function buildSidePots(
  players: { hand_player_id: string; total_committed: number; status: PlayerStatus }[]
): SidePot[] {
  const contributors = players.filter((p) => p.total_committed > 0);
  const levels = Array.from(new Set(contributors.map((p) => p.total_committed))).sort((a, b) => a - b);

  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const layerSize = level - previousLevel;
    const contributingThisLayer = contributors.filter((p) => p.total_committed >= level);
    const potAmount = layerSize * contributingThisLayer.length;
    if (potAmount > 0) {
      const eligible = contributingThisLayer.filter((p) => p.status !== "folded").map((p) => p.hand_player_id);
      sidePots.push({ amount: potAmount, eligibleHandPlayerIds: eligible });
    }
    previousLevel = level;
  }

  return sidePots;
}

// Canonical ordering of game phases and a helper to advance through them.
// Keeping this as a single source of truth avoids subtle bugs where one API
// route thinks "after flop_betting comes turn" while another thinks
// "after flop_betting comes draw_swap" (it does - see PHASE_ORDER below).

import { GamePhase } from "./types";

export const PHASE_ORDER: GamePhase[] = [
  "waiting_room",
  "ante",
  "deal_hole_cards",
  "flop",
  "flop_betting",
  "draw_swap",
  "turn",
  "turn_betting",
  "river",
  "river_betting",
  "all_in_runout",
  "showdown",
  "hand_complete",
];

export function nextPhase(current: GamePhase): GamePhase {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) {
    throw new Error(`No next phase after "${current}"`);
  }
  return PHASE_ORDER[idx + 1];
}

export const BETTING_PHASES: GamePhase[] = ["flop_betting", "turn_betting", "river_betting"];

export function isBettingPhase(phase: GamePhase): boolean {
  return BETTING_PHASES.includes(phase);
}

// Texas Hold'em's own phase order, kept entirely separate from PHASE_ORDER
// above so Pips' nextPhase()/PHASE_ORDER behavior is byte-for-byte unaffected
// by Hold'em's existence. Hold'em never visits "ante" or "draw_swap".
export const HOLDEM_PHASE_ORDER: GamePhase[] = [
  "waiting_room",
  "deal_hole_cards",
  "preflop_betting",
  "flop",
  "flop_betting",
  "turn",
  "turn_betting",
  "river",
  "river_betting",
  "all_in_runout",
  "showdown",
  "hand_complete",
];

export function nextHoldemPhase(current: GamePhase): GamePhase {
  const idx = HOLDEM_PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === HOLDEM_PHASE_ORDER.length - 1) {
    throw new Error(`No next Hold'em phase after "${current}"`);
  }
  return HOLDEM_PHASE_ORDER[idx + 1];
}

// Betting phases shared by both modes (Hold'em adds preflop_betting on top
// of Pips' three). Used by applyBettingAction/enforceActTimeout's allow-list
// instead of BETTING_PHASES so Hold'em's preflop round is recognized too -
// this is purely additive and does not change Pips' BETTING_PHASES/isBettingPhase above.
export const ALL_BETTING_PHASES: GamePhase[] = ["preflop_betting", "flop_betting", "turn_betting", "river_betting"];

export function isAnyBettingPhase(phase: GamePhase): boolean {
  return ALL_BETTING_PHASES.includes(phase);
}

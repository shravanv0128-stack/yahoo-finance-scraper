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

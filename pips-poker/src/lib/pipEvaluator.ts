// Pip scoring: the "other half" of the showdown pot, computed ONLY from each
// player's 3 hole cards (after any draw_swap), independent of the community
// board and independent of the 5-card poker hand ranking in handEvaluator.ts.
//
// Pip values: Ace = 1, 2-10 = face value, J/Q/K = 0. Highest total wins.
// This rewards a totally different skill (collecting low cards) from the
// poker half, which is the point of the split-pot "pips" mechanic.

import { Card, PipResult, Rank } from "./types";

const PIP_VALUES: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 0,
  Q: 0,
  K: 0,
};

export function pipValue(card: Card): number {
  return PIP_VALUES[card.rank];
}

/** Sum the pip values of a player's 3 hole cards. */
export function computePipTotal(holeCards: Card[]): PipResult {
  if (holeCards.length !== 3) {
    throw new Error(`Pip total requires exactly 3 hole cards, got ${holeCards.length}`);
  }
  const total = holeCards.reduce((sum, c) => sum + pipValue(c), 0);
  return { cards: holeCards, total };
}

/**
 * Compare two pip results for the purpose of ranking who wins the pip half.
 * Returns positive if `a` wins (higher total), negative if `b` wins, 0 if tied.
 * Higher pip total wins (per the game spec: "highest pip total").
 */
export function comparePipResults(a: PipResult, b: PipResult): number {
  return a.total - b.total;
}

/**
 * Given a list of (id, PipResult) pairs, return the ids that have the
 * maximum pip total (handles ties - all tied players are returned).
 */
export function findPipWinners<T extends { pipResult: PipResult }>(entries: T[]): T[] {
  if (entries.length === 0) return [];
  const maxTotal = Math.max(...entries.map((e) => e.pipResult.total));
  return entries.filter((e) => e.pipResult.total === maxTotal);
}

// Texas Hold'em hand evaluation: standard "best 5 of N" rule (no 2+3
// constraint like Pips). A player's hole cards (up to 2) and the board
// (0-5 cards) are pooled and every possible 5-card subset of the combined
// set is evaluated; the best one wins. Reuses the generic 5-card primitive
// from handEvaluator.ts so hand ranking logic isn't duplicated - this file
// adds NOTHING to handEvaluator.ts and never touches evaluateBestHand
// (which is Pips' 2-hole+3-board-only evaluator and must stay untouched).

import { Card, HandRankResult } from "./types";
import { evaluateFiveCardHandForHoldem } from "./handEvaluator";

function combinationsOf<T>(items: T[], k: number): T[][] {
  const result: T[][] = [];
  const n = items.length;
  if (k > n || k < 0) return result;
  if (k === 0) return [[]];
  const indices = Array.from({ length: k }, (_, i) => i);
  while (true) {
    result.push(indices.map((i) => items[i]));
    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) i--;
    if (i < 0) break;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
  return result;
}

/**
 * Find the best 5-card poker hand from holeCards ∪ boardCards, choosing any
 * 5 of the combined cards (the standard Hold'em rule - unlike Pips, there's
 * no requirement to use a fixed number of hole vs. board cards). Works for
 * a partial board (0-5 community cards), as long as at least 5 cards total
 * are available between hole + board.
 */
export function evaluateBestHandHoldem(holeCards: Card[], boardCards: Card[]): HandRankResult {
  const pool = [...holeCards, ...boardCards];
  if (pool.length < 5) {
    throw new Error(`evaluateBestHandHoldem requires at least 5 cards total, got ${pool.length}`);
  }

  const combos = combinationsOf(pool, 5);
  let best: { category: HandRankResult["category"]; categoryRank: number; tiebreakers: number[]; cards: Card[] } | null = null;

  for (const five of combos) {
    const { category, categoryRank, tiebreakers } = evaluateFiveCardHandForHoldem(five);
    if (
      best === null ||
      categoryRank > best.categoryRank ||
      (categoryRank === best.categoryRank && compareTiebreakers(tiebreakers, best.tiebreakers) > 0)
    ) {
      best = { category, categoryRank, tiebreakers, cards: five };
    }
  }

  const result = best as NonNullable<typeof best>;

  // holeCardsUsed/boardCardsUsed don't have the same fixed-arity meaning in
  // Hold'em (a player can use 0-2 hole cards), but the HandRankResult shape
  // is shared with Pips for display purposes - fill them with whatever
  // overlap actually exists in the winning 5, padding is unnecessary since
  // these fields aren't read for Hold'em hands (ShowdownSummary is told to
  // hide pip-specific UI but still reads category/tiebreakers/cards/label).
  const holeUsed = result.cards.filter((c) => holeCards.includes(c));
  const boardUsed = result.cards.filter((c) => boardCards.includes(c));

  return {
    category: result.category,
    categoryRank: result.categoryRank,
    tiebreakers: result.tiebreakers,
    cards: result.cards,
    holeCardsUsed: holeUsed as unknown as [Card, Card],
    boardCardsUsed: boardUsed as unknown as [Card, Card, Card],
  };
}

function compareTiebreakers(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

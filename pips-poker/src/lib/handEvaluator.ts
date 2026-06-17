// Poker hand evaluation under the Omaha-style "2 + 3" constraint:
// each player MUST use exactly 2 of their 3 hole cards and exactly 3 of the
// 5 community cards to form their best 5-card poker hand. This is the half
// of the showdown pot that rewards traditional poker hand strength.
//
// WHY enumerate combos instead of just taking the best 5 of 8 cards: a naive
// "best 5 of all 8 available cards" approach (standard 7-card evaluator logic)
// would let a player use 1 hole + 4 board, or 3 hole + 2 board, or even all 5
// board cards and ignore their hole cards entirely. That violates the game's
// core constraint and would let a player effectively "borrow" too much (or
// too little) of the shared board, materially changing equities. So we must
// restrict the search space to exactly C(3,2) * C(5,3) = 3 * 10 = 30 combos
// (not 100 - there are only 3 ways to choose 2 of 3 hole cards) and pick the
// best resulting 5-card hand among those 30.

import { Card, HandRankCategory, HandRankResult, Rank } from "./types";

// Numeric rank order for straights/comparisons. Ace is high here for typical
// 5-high-card comparisons but we special-case the wheel (A-2-3-4-5) straight.
const RANK_ORDER: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const CATEGORY_RANK: Record<HandRankCategory, number> = {
  high_card: 0,
  pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_of_a_kind: 7,
  straight_flush: 8,
};

function combinations<T>(items: T[], k: number): T[][] {
  const result: T[][] = [];
  const n = items.length;
  if (k > n) return result;
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
 * Evaluate exactly 5 cards (no choosing involved) into a category + tiebreakers.
 * Tiebreakers are listed in descending priority, each comparable numerically.
 */
function evaluateFiveCardHand(cards: Card[]): { category: HandRankCategory; tiebreakers: number[] } {
  const values = cards.map((c) => RANK_ORDER[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  // Count occurrences of each rank value.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  // Straight detection, including the wheel (A-2-3-4-5 => treat Ace as 1).
  const uniqueDesc = Array.from(new Set(values)).sort((a, b) => b - a);
  let straightHigh: number | null = null;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) {
      straightHigh = uniqueDesc[0];
    } else if (uniqueDesc.join(",") === "14,5,4,3,2") {
      straightHigh = 5; // wheel: 5-high straight
    }
  }

  if (straightHigh !== null && isFlush) {
    return { category: "straight_flush", tiebreakers: [straightHigh] };
  }

  // Group counts: sort by (count desc, rank value desc) to build tiebreaker list.
  const grouped = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.value - a.value));

  const countsShape = grouped.map((g) => g.count).join(",");

  if (countsShape === "4,1") {
    return { category: "four_of_a_kind", tiebreakers: grouped.map((g) => g.value) };
  }
  if (countsShape === "3,2") {
    return { category: "full_house", tiebreakers: grouped.map((g) => g.value) };
  }
  if (isFlush) {
    return { category: "flush", tiebreakers: values };
  }
  if (straightHigh !== null) {
    return { category: "straight", tiebreakers: [straightHigh] };
  }
  if (countsShape === "3,1,1") {
    return { category: "three_of_a_kind", tiebreakers: grouped.map((g) => g.value) };
  }
  if (countsShape === "2,2,1") {
    return { category: "two_pair", tiebreakers: grouped.map((g) => g.value) };
  }
  if (countsShape === "2,1,1,1") {
    return { category: "pair", tiebreakers: grouped.map((g) => g.value) };
  }
  return { category: "high_card", tiebreakers: values };
}

/**
 * Find the best 5-card poker hand for a player given their 3 hole cards and
 * the 5 community cards, enforcing the exact-2-hole + exact-3-board rule.
 */
export function evaluateBestHand(holeCards: Card[], boardCards: Card[]): HandRankResult {
  if (holeCards.length !== 3) {
    throw new Error(`evaluateBestHand requires exactly 3 hole cards, got ${holeCards.length}`);
  }
  if (boardCards.length !== 5) {
    throw new Error(`evaluateBestHand requires exactly 5 board cards, got ${boardCards.length}`);
  }

  const holeCombos = combinations(holeCards, 2); // C(3,2) = 3 combos
  const boardCombos = combinations(boardCards, 3); // C(5,3) = 10 combos

  let best: HandRankResult | null = null;

  for (const holeCombo of holeCombos) {
    for (const boardCombo of boardCombos) {
      const five = [...holeCombo, ...boardCombo];
      const { category, tiebreakers } = evaluateFiveCardHand(five);
      const categoryRank = CATEGORY_RANK[category];
      const candidate: HandRankResult = {
        category,
        categoryRank,
        tiebreakers,
        cards: five,
        holeCardsUsed: holeCombo as [Card, Card],
        boardCardsUsed: boardCombo as [Card, Card, Card],
      };
      if (best === null || compareHandRanks(candidate, best) > 0) {
        best = candidate;
      }
    }
  }

  // holeCombos and boardCombos are always non-empty (3 and 10 respectively),
  // so `best` is guaranteed to be set.
  return best as HandRankResult;
}

/**
 * Compare two HandRankResults. Returns positive if `a` beats `b`, negative
 * if `b` beats `a`, 0 if exactly tied (same category and tiebreakers).
 */
export function compareHandRanks(a: HandRankResult, b: HandRankResult): number {
  if (a.categoryRank !== b.categoryRank) return a.categoryRank - b.categoryRank;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Given a list of (id, HandRankResult) pairs, return all entries tied for
 * the best hand (so the caller can split that half of the pot among them).
 */
export function findHandWinners<T extends { bestHand: HandRankResult }>(entries: T[]): T[] {
  if (entries.length === 0) return [];
  let winners = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    const cmp = compareHandRanks(entries[i].bestHand, winners[0].bestHand);
    if (cmp > 0) {
      winners = [entries[i]];
    } else if (cmp === 0) {
      winners.push(entries[i]);
    }
  }
  return winners;
}

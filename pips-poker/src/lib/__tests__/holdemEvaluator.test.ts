import { describe, it, expect } from "vitest";
import { evaluateBestHandHoldem } from "../holdemEvaluator";
import { compareHandRanks } from "../handEvaluator";
import { Card } from "../types";

describe("evaluateBestHandHoldem (standard best-5-of-N rule)", () => {
  it("uses both hole cards to make the best hand (pocket pair -> trips with board pair)", () => {
    const hole: Card[] = [
      { rank: "9", suit: "hearts" },
      { rank: "9", suit: "clubs" },
    ];
    const board: Card[] = [
      { rank: "9", suit: "spades" },
      { rank: "2", suit: "diamonds" },
      { rank: "5", suit: "hearts" },
      { rank: "J", suit: "clubs" },
      { rank: "3", suit: "spades" },
    ];
    const result = evaluateBestHandHoldem(hole, board);
    expect(result.category).toBe("three_of_a_kind");
    // Both hole 9s must be part of the winning 5, since trips needs all 3 nines.
    const usedHoleCount = result.cards.filter((c) => hole.some((h) => h.rank === c.rank && h.suit === c.suit)).length;
    expect(usedHoleCount).toBe(2);
  });

  it("uses exactly one hole card to make the best hand (top pair)", () => {
    const hole: Card[] = [
      { rank: "A", suit: "spades" },
      { rank: "7", suit: "clubs" },
    ];
    const board: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "4", suit: "diamonds" },
      { rank: "9", suit: "spades" },
      { rank: "J", suit: "clubs" },
      { rank: "2", suit: "hearts" },
    ];
    const result = evaluateBestHandHoldem(hole, board);
    expect(result.category).toBe("pair");
    expect(result.tiebreakers[0]).toBe(14); // pair of aces
  });

  it("plays the board when neither hole card improves the hand (zero hole cards used)", () => {
    // Board itself is a straight; player's hole cards are useless low cards
    // that can't beat or extend it.
    const hole: Card[] = [
      { rank: "2", suit: "clubs" },
      { rank: "3", suit: "diamonds" },
    ];
    const board: Card[] = [
      { rank: "9", suit: "hearts" },
      { rank: "10", suit: "spades" },
      { rank: "J", suit: "clubs" },
      { rank: "Q", suit: "diamonds" },
      { rank: "K", suit: "hearts" },
    ];
    const result = evaluateBestHandHoldem(hole, board);
    expect(result.category).toBe("straight");
    expect(result.tiebreakers[0]).toBe(13); // king-high straight, all from board
    const usedHoleCount = result.cards.filter((c) => hole.some((h) => h.rank === c.rank && h.suit === c.suit)).length;
    expect(usedHoleCount).toBe(0);
  });

  it("produces a tie/kicker scenario identical to comparing two players' best hands", () => {
    // Board already has two pair (9s and Js); both players' hole cards are
    // irrelevant low cards that can't improve on the board's own two pair,
    // so both end up playing the identical best-5 from the board - a tie.
    const board: Card[] = [
      { rank: "9", suit: "clubs" },
      { rank: "9", suit: "diamonds" },
      { rank: "J", suit: "spades" },
      { rank: "J", suit: "hearts" },
      { rank: "Q", suit: "clubs" },
    ];
    const holeA: Card[] = [
      { rank: "2", suit: "hearts" },
      { rank: "3", suit: "hearts" },
    ];
    const holeB: Card[] = [
      { rank: "4", suit: "spades" },
      { rank: "5", suit: "spades" },
    ];
    const resultA = evaluateBestHandHoldem(holeA, board);
    const resultB = evaluateBestHandHoldem(holeB, board);
    // Both play the board: two pair (Js and 9s) with a Queen kicker - tied.
    expect(resultA.category).toBe("two_pair");
    expect(compareHandRanks(resultA, resultB)).toBe(0);
  });

  it("supports a partial board (e.g. flop only, 3 community cards)", () => {
    const hole: Card[] = [
      { rank: "A", suit: "spades" },
      { rank: "A", suit: "hearts" },
    ];
    const board: Card[] = [
      { rank: "A", suit: "clubs" },
      { rank: "4", suit: "diamonds" },
      { rank: "9", suit: "spades" },
    ];
    const result = evaluateBestHandHoldem(hole, board);
    expect(result.category).toBe("three_of_a_kind");
  });
});

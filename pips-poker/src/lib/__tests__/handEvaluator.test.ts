import { describe, it, expect } from "vitest";
import { evaluateBestHand, compareHandRanks } from "../handEvaluator";
import { Card } from "../types";

describe("handEvaluator (2 hole + 3 board constraint)", () => {
  it("finds a flush using exactly 2 matching-suit hole cards + 3 matching-suit board cards", () => {
    // Hole: two hearts + one off-suit card. Board: three hearts + two off-suit.
    const hole: Card[] = [
      { rank: "2", suit: "hearts" },
      { rank: "9", suit: "hearts" },
      { rank: "K", suit: "clubs" }, // dead card, irrelevant to the flush
    ];
    const board: Card[] = [
      { rank: "4", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "3", suit: "spades" },
      { rank: "5", suit: "diamonds" },
    ];
    const result = evaluateBestHand(hole, board);
    expect(result.category).toBe("flush");
    // Must use exactly 2 hole cards and exactly 3 board cards.
    expect(result.holeCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
    // The 2 hole cards used must both be hearts (the off-suit K can't be used
    // in a flush since only 2 hole cards are allowed and both must match).
    const holeSuits = result.holeCardsUsed.map((c) => c.suit);
    expect(holeSuits).toEqual(["hearts", "hearts"]);
  });

  it("rejects a 'better hand' that would require 1 hole + 4 board or 3 hole + 2 board cards", () => {
    // Board has 4 cards of the same suit (a 4-flush) plus one hole card of
    // that suit could make a flush via 1+4, which is ILLEGAL. With only 2
    // hole cards allowed, and only 1 of the hole cards being that suit, no
    // flush is achievable here - the evaluator must NOT report a flush.
    const hole: Card[] = [
      { rank: "2", suit: "hearts" }, // only one heart in the hole cards
      { rank: "9", suit: "clubs" },
      { rank: "K", suit: "diamonds" },
    ];
    const board: Card[] = [
      { rank: "4", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "3", suit: "hearts" }, // 4 hearts on board - a 1-hole-card flush would need this
      { rank: "5", suit: "spades" },
    ];
    const result = evaluateBestHand(hole, board);
    // A true 7-card-Hold'em evaluator would find a flush here (1 hole heart +
    // 4 board hearts is illegal, but it could also just use the 4 board
    // hearts + need a 5th - still only board, also illegal: must use exactly
    // 3 board cards). Since only 3 of the 4 board hearts can be used, and
    // only 1 hole heart is available, a 5-heart flush is mathematically
    // impossible under the 2+3 constraint. Confirm the evaluator agrees.
    expect(result.category).not.toBe("flush");
    expect(result.holeCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
  });

  it("rejects using all 3 hole cards or all 5 board cards (enforces exact 2+3 split)", () => {
    // Trip aces would be possible with 3 hole aces, but only 2 of the 3 hole
    // cards may be used, so trip aces from the hole alone is impossible -
    // the best the player can do is a pair of aces (using 2 of the 3).
    const hole: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "clubs" },
      { rank: "A", suit: "diamonds" },
    ];
    const board: Card[] = [
      { rank: "2", suit: "spades" },
      { rank: "5", suit: "spades" },
      { rank: "9", suit: "clubs" },
      { rank: "J", suit: "diamonds" },
      { rank: "4", suit: "hearts" },
    ];
    const result = evaluateBestHand(hole, board);
    expect(result.category).toBe("pair");
    expect(result.holeCardsUsed).toHaveLength(2);
    // Both used hole cards must be aces (the pair), confirming exactly 2 of
    // the 3 aces are used, not all 3.
    expect(result.holeCardsUsed.every((c) => c.rank === "A")).toBe(true);
  });

  it("produces a tie when two players have identical best hands", () => {
    const board: Card[] = [
      { rank: "9", suit: "clubs" },
      { rank: "9", suit: "diamonds" },
      { rank: "2", suit: "spades" },
      { rank: "5", suit: "hearts" },
      { rank: "J", suit: "clubs" },
    ];
    const holeA: Card[] = [
      { rank: "K", suit: "hearts" },
      { rank: "Q", suit: "hearts" },
      { rank: "3", suit: "diamonds" },
    ];
    const holeB: Card[] = [
      { rank: "K", suit: "spades" },
      { rank: "Q", suit: "spades" },
      { rank: "7", suit: "clubs" },
    ];
    const resultA = evaluateBestHand(holeA, board);
    const resultB = evaluateBestHand(holeB, board);
    // Both should end up as two pair (9s and Ks) with Q kicker - identical rank.
    expect(compareHandRanks(resultA, resultB)).toBe(0);
  });

  it("correctly ranks a straight flush above a four of a kind", () => {
    const hole: Card[] = [
      { rank: "9", suit: "spades" },
      { rank: "8", suit: "spades" },
      { rank: "2", suit: "clubs" },
    ];
    const board: Card[] = [
      { rank: "7", suit: "spades" },
      { rank: "6", suit: "spades" },
      { rank: "5", suit: "spades" },
      { rank: "5", suit: "clubs" },
      { rank: "5", suit: "diamonds" },
    ];
    const result = evaluateBestHand(hole, board);
    expect(result.category).toBe("straight_flush");
  });
});

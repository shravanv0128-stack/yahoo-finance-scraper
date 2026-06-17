import { describe, it, expect } from "vitest";
import { computePipTotal, comparePipResults, findPipWinners, pipValue } from "../pipEvaluator";
import { Card } from "../types";

describe("pipEvaluator", () => {
  it("A,K,10 = 1 + 0 + 10 = 11", () => {
    const cards: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "spades" },
      { rank: "10", suit: "clubs" },
    ];
    const result = computePipTotal(cards);
    expect(result.total).toBe(11);
  });

  it("face cards (J/Q/K) are worth 0 pips", () => {
    expect(pipValue({ rank: "J", suit: "hearts" })).toBe(0);
    expect(pipValue({ rank: "Q", suit: "hearts" })).toBe(0);
    expect(pipValue({ rank: "K", suit: "hearts" })).toBe(0);
  });

  it("Ace is worth 1 pip, not 14", () => {
    expect(pipValue({ rank: "A", suit: "hearts" })).toBe(1);
  });

  it("number cards are worth face value", () => {
    expect(pipValue({ rank: "7", suit: "hearts" })).toBe(7);
  });

  it("throws if not exactly 3 hole cards", () => {
    expect(() =>
      computePipTotal([
        { rank: "2", suit: "hearts" },
        { rank: "3", suit: "hearts" },
      ])
    ).toThrow();
  });

  it("comparePipResults: higher total wins", () => {
    const a = computePipTotal([
      { rank: "2", suit: "hearts" },
      { rank: "3", suit: "diamonds" },
      { rank: "4", suit: "clubs" },
    ]); // 9
    const b = computePipTotal([
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "diamonds" },
      { rank: "A", suit: "clubs" },
    ]); // 3
    expect(comparePipResults(a, b)).toBeGreaterThan(0);
  });

  it("findPipWinners handles ties", () => {
    const entries = [
      { id: "p1", pipResult: computePipTotal([{ rank: "2", suit: "hearts" }, { rank: "2", suit: "diamonds" }, { rank: "2", suit: "clubs" }]) }, // 6
      { id: "p2", pipResult: computePipTotal([{ rank: "3", suit: "hearts" }, { rank: "2", suit: "diamonds" }, { rank: "A", suit: "clubs" }]) }, // 6
      { id: "p3", pipResult: computePipTotal([{ rank: "K", suit: "hearts" }, { rank: "Q", suit: "diamonds" }, { rank: "J", suit: "clubs" }]) }, // 0
    ];
    const winners = findPipWinners(entries);
    expect(winners.map((w) => w.id).sort()).toEqual(["p1", "p2"]);
  });
});

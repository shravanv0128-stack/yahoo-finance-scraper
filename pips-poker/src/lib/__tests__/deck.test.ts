import { describe, it, expect } from "vitest";
import { buildDeck, shuffleDeck, drawCards, drawReplacements } from "../deck";

describe("deck", () => {
  it("builds 52 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(52);
  });

  it("shuffle produces a permutation of the same 52 cards", () => {
    const deck = buildDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    const originalKeys = deck.map((c) => `${c.rank}-${c.suit}`).sort();
    const shuffledKeys = shuffled.map((c) => `${c.rank}-${c.suit}`).sort();
    expect(shuffledKeys).toEqual(originalKeys);
  });

  it("shuffle does not mutate the input array", () => {
    const deck = buildDeck();
    const copy = deck.slice();
    shuffleDeck(deck);
    expect(deck).toEqual(copy);
  });

  it("drawCards splits drawn vs remaining without overlap", () => {
    const deck = buildDeck();
    const { drawn, remaining } = drawCards(deck, 5);
    expect(drawn).toHaveLength(5);
    expect(remaining).toHaveLength(47);
    const remainingKeys = new Set(remaining.map((c) => `${c.rank}-${c.suit}`));
    for (const c of drawn) {
      expect(remainingKeys.has(`${c.rank}-${c.suit}`)).toBe(false);
    }
  });

  it("drawReplacements returns kept + new cards and shrinks the deck", () => {
    const deck = buildDeck();
    const kept = deck.slice(0, 1); // pretend the player kept 1 card
    const restOfDeck = deck.slice(3); // simulate that 3 cards were already dealt elsewhere
    const { newHand, remaining } = drawReplacements(restOfDeck, kept, 2);
    expect(newHand).toHaveLength(3);
    expect(remaining).toHaveLength(restOfDeck.length - 2);
  });
});

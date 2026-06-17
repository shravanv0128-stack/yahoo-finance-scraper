// Deck construction, shuffling, and dealing helpers.
//
// All randomness for the game flows through this module's shuffle, which is
// only ever invoked server-side (gameEngine.ts, called from API routes using
// the service-role client). Clients never see the deck order ahead of time.

import { Card, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** Build a fresh, ordered 52-card deck (not shuffled). */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
 * This is the standard unbiased shuffle algorithm: walking from the end,
 * swap each element with a uniformly random earlier (or equal) element.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Build and shuffle a new deck in one step. */
export function freshShuffledDeck(): Card[] {
  return shuffleDeck(buildDeck());
}

/**
 * Draw `count` cards off the top of the deck. Returns the drawn cards and the
 * remaining deck, leaving the original array untouched (deck is treated as
 * an immutable value that gets persisted to game_state.deck after each draw).
 */
export function drawCards(deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } {
  if (count > deck.length) {
    throw new Error(`Cannot draw ${count} cards from a deck of ${deck.length}`);
  }
  return { drawn: deck.slice(0, count), remaining: deck.slice(count) };
}

/**
 * Used during draw_swap: a player discards `discarded` cards from their hand
 * and draws the same number of replacements from the top of the deck.
 * Returns the player's new hand (kept cards + new cards, kept cards first)
 * and the updated deck.
 */
export function drawReplacements(
  deck: Card[],
  keptCards: Card[],
  discardCount: number
): { newHand: Card[]; remaining: Card[] } {
  const { drawn, remaining } = drawCards(deck, discardCount);
  return { newHand: [...keptCards, ...drawn], remaining };
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

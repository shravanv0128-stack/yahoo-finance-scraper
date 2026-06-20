"use client";

import { useEffect, useRef } from "react";
import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";

// How long to stagger each successive card's flip by, so a batch of cards
// revealed together (e.g. the 3-card flop) turns over one at a time instead
// of snapping all at once - a little suspense before the next street.
const REVEAL_STAGGER_MS = 350;

export function CommunityBoard({ cards }: { cards: CardType[] }) {
  // Only cards beyond how many were already showing are "new" this render,
  // so a lone turn/river card flips immediately instead of inheriting a
  // long delay from its absolute board position.
  const previousCount = useRef(0);
  const baseline = previousCount.current;

  useEffect(() => {
    previousCount.current = cards.length;
  }, [cards.length]);

  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const isNewThisReveal = i >= baseline;
        const delay = isNewThisReveal ? (i - baseline) * REVEAL_STAGGER_MS : 0;
        return (
          <Card key={i} card={cards[i] ?? null} faceDown={!cards[i]} revealDelayMs={delay} />
        );
      })}
    </div>
  );
}

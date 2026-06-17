"use client";

import { useState } from "react";
import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";

export interface DrawSwapControlsProps {
  holeCards: CardType[];
  disabled: boolean;
  onSwap: (discardIndices: number[]) => void;
}

export function DrawSwapControls({ holeCards, disabled, onSwap }: DrawSwapControlsProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-felt-light/40 bg-felt p-4">
      <p className="text-xs text-felt-light">Select cards to discard, then swap (or stand pat).</p>
      <div className="flex gap-2">
        {holeCards.map((card, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => toggle(i)}
            className={`rounded ${selected.has(i) ? "ring-2 ring-chip-gold" : ""}`}
          >
            <Card card={card} />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={disabled}
          onClick={() => onSwap([])}
          className="rounded bg-felt-light px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Stand pat
        </button>
        <button
          disabled={disabled || selected.size === 0}
          onClick={() => onSwap(Array.from(selected))}
          className="rounded bg-chip-gold px-3 py-2 text-sm font-semibold text-felt-dark disabled:opacity-40"
        >
          Swap selected
        </button>
      </div>
    </div>
  );
}

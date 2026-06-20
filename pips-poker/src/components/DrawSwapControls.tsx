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
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-neon/40 bg-gradient-to-b from-emerald-950/90 to-slate-900/90 px-4 py-3 shadow-[0_0_20px_2px_rgba(57,255,140,0.15)]">
      <p className="text-xs text-white/70">Select cards to discard, then swap (or stand pat).</p>
      <div className="flex gap-2">
        {holeCards.map((card, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => toggle(i)}
            className={`rounded transition ${selected.has(i) ? "ring-2 ring-chip-gold" : ""}`}
          >
            <Card card={card} />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={disabled}
          onClick={() => onSwap([])}
          className="rounded bg-slate-600 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Stand pat
        </button>
        <button
          disabled={disabled || selected.size === 0}
          onClick={() => onSwap(Array.from(selected))}
          className="rounded bg-chip-gold px-3 py-2 text-sm font-semibold text-felt-dark transition hover:brightness-110 disabled:opacity-40"
        >
          Swap selected
        </button>
      </div>
    </div>
  );
}

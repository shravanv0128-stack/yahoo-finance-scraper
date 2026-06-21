"use client";

import { useState } from "react";
import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";
import { evaluateBestHandFlexible, handCategoryLabel } from "@/lib/handEvaluator";
import { computePipTotal } from "@/lib/pipEvaluator";

export interface DrawSwapControlsProps {
  holeCards: CardType[];
  communityCards: CardType[];
  disabled: boolean;
  onSwap: (discardIndices: number[]) => void;
}

// Shown as a centered popup (mirrors ShowdownSummary) so the flop, your
// cards, and the stand-pat/swap decision are all visible at once with no
// scrolling: flop on top, your hand + a live best-hand/pips ribbon below it,
// then the discard-selection buttons.
export function DrawSwapControls({ holeCards, communityCards, disabled, onSwap }: DrawSwapControlsProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  const pipTotal = computePipTotal(holeCards).total;
  const best = communityCards.length > 0 ? evaluateBestHandFlexible(holeCards, communityCards) : null;
  const handLabel = best ? handCategoryLabel(best) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-lg border border-black/50 bg-zinc-900 p-5 shadow-xl">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-yellow-300">Draw / Swap</h2>

      {communityCards.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Flop</p>
          <div className="flex gap-1.5">
            {communityCards.map((c, i) => (
              <Card key={i} card={c} size="md" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Your cards</p>
        <div className="flex gap-2">
          {holeCards.map((card, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => toggle(i)}
              className={`rounded transition ${selected.has(i) ? "ring-2 ring-chip-gold" : ""}`}
            >
              <Card card={card} size="lg" />
            </button>
          ))}
        </div>
        {(handLabel || pipTotal !== null) && (
          <div className="flex items-center gap-1 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold shadow ring-1 ring-chip-gold/40">
            {handLabel && <span className="text-chip-gold">{handLabel}</span>}
            {handLabel && <span className="text-white/30">·</span>}
            <span className="text-chip-blue">{pipTotal} pips</span>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-white/70">Select cards to discard, then swap (or stand pat).</p>
      <div className="flex gap-3">
        <button
          disabled={disabled}
          onClick={() => onSwap([])}
          className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Stand pat
        </button>
        <button
          disabled={disabled || selected.size === 0}
          onClick={() => onSwap(Array.from(selected))}
          className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark transition hover:brightness-110 disabled:opacity-40"
        >
          Swap selected
        </button>
      </div>
    </div>
  );
}

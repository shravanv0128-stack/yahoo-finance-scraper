"use client";

import { useEffect, useState } from "react";
import type { BettingAction } from "@/lib/types";

export interface BettingControlsProps {
  toCall: number;
  chipStack: number;
  pot: number;
  disabled: boolean;
  onAction: (action: BettingAction, amount: number) => void;
}

// Bottom-docked horizontal action bar, PokerNow-style: Fold / Check-or-Call /
// Raise buttons on the left, a bet-size slider with quick-size shortcuts
// (1/2 pot, pot, all-in) on the right for sizing a bet or raise.
export function BettingControls({ toCall, chipStack, pot, disabled, onAction }: BettingControlsProps) {
  // Pot-limit: the most a player can ever bet/raise is the current size of the pot.
  const maxBet = Math.max(1, Math.min(chipStack, pot));
  const [raiseAmount, setRaiseAmount] = useState(Math.min(1, maxBet));

  useEffect(() => {
    setRaiseAmount(Math.min(1, maxBet));
  }, [maxBet]);

  const halfPot = Math.min(maxBet, Math.round(pot / 2));
  const fullPot = maxBet;

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-neon/40 bg-gradient-to-b from-emerald-950/90 to-slate-900/90 px-4 py-3 shadow-[0_0_20px_2px_rgba(57,255,140,0.15)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        <button
          disabled={disabled}
          onClick={() => onAction("fold", 0)}
          className="rounded-lg bg-chip-red px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Fold
        </button>
        {toCall === 0 ? (
          <button
            disabled={disabled}
            onClick={() => onAction("check", 0)}
            className="rounded-lg bg-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Check
          </button>
        ) : (
          <button
            disabled={disabled}
            onClick={() => onAction("call", 0)}
            className="rounded-lg bg-chip-blue px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Call ${toCall}
          </button>
        )}
        <button
          disabled={disabled || chipStack <= 0}
          onClick={() => onAction("all_in", 0)}
          className="rounded-lg bg-chip-black px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          All In
        </button>
      </div>

      <div className="flex flex-1 items-center gap-3 sm:max-w-md">
        <input
          type="range"
          min={1}
          max={maxBet}
          value={raiseAmount}
          disabled={disabled}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-chip-gold disabled:opacity-40"
        />
        <input
          type="number"
          min={1}
          max={maxBet}
          value={raiseAmount}
          disabled={disabled}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1.5 text-sm text-white disabled:opacity-40"
        />
        <div className="flex gap-1">
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(halfPot)}
            className="rounded bg-slate-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-600 disabled:opacity-40"
          >
            ½ Pot
          </button>
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(fullPot)}
            className="rounded bg-slate-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-600 disabled:opacity-40"
          >
            Pot
          </button>
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(maxBet)}
            className="rounded bg-slate-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-600 disabled:opacity-40"
          >
            Max
          </button>
        </div>
        <button
          disabled={disabled || raiseAmount <= 0 || raiseAmount > chipStack}
          onClick={() => onAction(toCall === 0 ? "bet" : "raise", raiseAmount)}
          className="rounded-lg bg-chip-gold px-5 py-3 text-sm font-bold text-felt-dark transition hover:brightness-110 disabled:opacity-40"
        >
          {toCall === 0 ? "Bet" : "Raise"} ${raiseAmount}
        </button>
      </div>
    </div>
  );
}

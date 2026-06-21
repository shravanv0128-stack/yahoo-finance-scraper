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

  // Shared button shape: a bordered rectangle with a small keyboard-shortcut
  // letter pinned to the top-right corner, matching PokerNow's action bar.
  function ActionButton({
    shortcut,
    children,
    onClick,
    disabled: btnDisabled,
    tone,
  }: {
    shortcut: string;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone: "green" | "blue" | "red" | "dark";
  }) {
    const toneClasses: Record<string, string> = {
      green: "border-green-500 text-green-400 hover:bg-green-500/10",
      blue: "border-blue-400 text-blue-300 hover:bg-blue-400/10",
      red: "border-red-500 text-red-400 hover:bg-red-500/10",
      dark: "border-zinc-500 text-zinc-200 hover:bg-zinc-500/10",
    };
    return (
      <button
        disabled={btnDisabled ?? disabled}
        onClick={onClick}
        className={`relative min-w-[7rem] rounded-md border-2 bg-zinc-900/80 px-5 py-3 text-sm font-bold uppercase tracking-wide transition disabled:opacity-30 ${toneClasses[tone]}`}
      >
        <span className="absolute right-1.5 top-1 text-[9px] font-semibold text-white/40">{shortcut}</span>
        {children}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
          className="w-20 rounded border border-white/20 bg-zinc-800 px-2 py-1.5 text-sm text-white disabled:opacity-40"
        />
        <div className="flex gap-1">
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(halfPot)}
            className="rounded bg-zinc-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-600 disabled:opacity-40"
          >
            1/2
          </button>
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(fullPot)}
            className="rounded bg-zinc-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-600 disabled:opacity-40"
          >
            Pot
          </button>
          <button
            disabled={disabled}
            onClick={() => setRaiseAmount(maxBet)}
            className="rounded bg-zinc-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-600 disabled:opacity-40"
          >
            Max
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <ActionButton shortcut="F" tone="red" onClick={() => onAction("fold", 0)}>
          Fold
        </ActionButton>
        {toCall === 0 ? (
          <ActionButton shortcut="K" tone="dark" onClick={() => onAction("check", 0)}>
            Check
          </ActionButton>
        ) : (
          <ActionButton shortcut="C" tone="green" onClick={() => onAction("call", 0)}>
            Call {toCall}
          </ActionButton>
        )}
        <ActionButton
          shortcut="R"
          tone="blue"
          disabled={raiseAmount <= 0 || raiseAmount > chipStack}
          onClick={() => onAction(toCall === 0 ? "bet" : "raise", raiseAmount)}
        >
          {toCall === 0 ? "Bet" : "Raise"} {raiseAmount}
        </ActionButton>
        <ActionButton shortcut="A" tone="dark" disabled={chipStack <= 0} onClick={() => onAction("all_in", 0)}>
          All In
        </ActionButton>
      </div>
    </div>
  );
}

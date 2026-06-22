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
    tone: "green" | "blue" | "red" | "dark" | "gold";
  }) {
    const toneClasses: Record<string, string> = {
      green: "bg-green-700/90 text-white hover:bg-green-600 shadow-btn-call",
      blue: "bg-blue-700/90 text-white hover:bg-blue-600 shadow-btn-raise",
      red: "bg-red-800/90 text-white hover:bg-red-700 shadow-btn-fold",
      dark: "bg-zinc-700/80 text-zinc-100 hover:bg-zinc-600 shadow-[0_3px_10px_rgba(0,0,0,0.5)]",
      gold: "bg-chip-gold text-felt-dark font-extrabold hover:brightness-110 shadow-btn-allin",
    };
    return (
      <button
        disabled={btnDisabled ?? disabled}
        onClick={onClick}
        className={`relative min-w-[7rem] rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-30 disabled:hover:translate-y-0 ${toneClasses[tone]}`}
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
          className="w-20 rounded-lg border border-white/15 bg-zinc-800/90 px-2 py-1.5 text-sm font-bold text-chip-gold focus:border-chip-gold/50 focus:outline-none disabled:opacity-40"
        />
        <div className="flex gap-1">
          {[{ label: "½", val: halfPot }, { label: "Pot", val: fullPot }, { label: "Max", val: maxBet }].map((btn) => (
            <button
              key={btn.label}
              disabled={disabled}
              onClick={() => setRaiseAmount(btn.val)}
              className="rounded-lg border border-white/10 bg-zinc-800/80 px-2.5 py-1.5 text-[11px] font-bold text-white/70 transition-all duration-150 hover:-translate-y-0.5 hover:border-chip-gold/30 hover:text-chip-gold active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              {btn.label}
            </button>
          ))}
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
        <ActionButton shortcut="A" tone="gold" disabled={chipStack <= 0} onClick={() => onAction("all_in", 0)}>
          All In
        </ActionButton>
      </div>
    </div>
  );
}

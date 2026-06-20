"use client";

import { useState } from "react";

export interface LedgerPlayer {
  id: string;
  displayName: string;
  seat: number;
  chipStack: number;
  buyIn: number;
}

export function LedgerPanel({
  players,
  disabled,
  canEdit,
  onAdjust,
}: {
  players: LedgerPlayer[];
  disabled: boolean;
  canEdit: boolean;
  onAdjust: (playerId: string, delta: number) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-chip-gold/40 bg-felt p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-chip-gold">Ledger</h2>
      <div className="flex flex-col gap-2">
        {players.map((p) => {
          const amount = amounts[p.id] ?? 50;
          const net = p.chipStack - p.buyIn;
          const netColor = net > 0 ? "text-emerald-400" : net < 0 ? "text-chip-red" : "text-white/60";
          const netLabel = net > 0 ? `+$${net}` : net < 0 ? `-$${Math.abs(net)}` : "$0";
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded bg-felt-dark/60 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-white">{p.displayName}</p>
                <p className="text-xs text-white/60">Bought in: ${p.buyIn}</p>
                <p className="text-xs text-emerald-300">Stack now: ${p.chipStack}</p>
                <p className={`text-xs font-semibold ${netColor}`}>{netLabel}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    disabled={disabled}
                    onChange={(e) => setAmounts((cur) => ({ ...cur, [p.id]: Number(e.target.value) }))}
                    className="w-20 rounded border border-white/20 bg-slate-800 px-2 py-1 text-sm text-white disabled:opacity-40"
                  />
                  <button
                    disabled={disabled}
                    onClick={() => onAdjust(p.id, amount)}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    + Add
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => onAdjust(p.id, -amount)}
                    className="rounded bg-chip-red px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    − Subtract
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

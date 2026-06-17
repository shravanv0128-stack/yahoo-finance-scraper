import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";

// Shown once a hand reaches "hand_complete": summarizes each non-folded
// player's revealed hole cards and pip total, so the table can see why the
// pot was split the way it was. We don't have the full HandRankResult here
// (the API layer only persists revealed_cards + revealed_pip_total on
// hand_players), so this focuses on what's available: revealed cards and
// pip totals. A fuller "winning poker hand" breakdown could be added by
// also persisting the showdown's HandRankResult per player if desired.

export interface ShowdownPlayerSummary {
  seat: number;
  displayName: string;
  chipStack: number;
  revealedCards: CardType[] | null;
  revealedPipTotal: number | null;
  folded: boolean;
  amountWon: number;
  mucked: boolean;
}

export function ShowdownSummary({ players }: { players: ShowdownPlayerSummary[] }) {
  const shown = players.filter((p) => !p.folded && p.revealedCards);
  const mucked = players.filter((p) => !p.folded && !p.revealedCards && p.mucked);
  if (shown.length === 0 && mucked.length === 0) return null;

  const winners = shown.filter((p) => p.amountWon > 0);
  const winnerLabel =
    winners.length === 0
      ? null
      : winners.length === 1
        ? `${winners[0].displayName} wins $${winners[0].amountWon}`
        : `Split pot: ${winners.map((w) => `${w.displayName} +$${w.amountWon}`).join(", ")}`;

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-chip-gold/40 bg-felt p-4">
      <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wide text-chip-gold">
        Showdown
      </h2>
      {winnerLabel && (
        <p className="mb-3 text-center text-sm font-bold text-emerald-400">{winnerLabel}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((p) => (
          <div
            key={p.seat}
            className={`flex items-center justify-between rounded-md px-3 py-2 ${
              p.amountWon > 0 ? "bg-emerald-900/40 ring-1 ring-chip-gold/60" : "bg-felt-dark/60"
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {p.displayName}
                {p.amountWon > 0 && <span className="ml-2 text-chip-gold">+${p.amountWon}</span>}
              </p>
              <p className="text-xs text-emerald-300">Stack: ${p.chipStack}</p>
              {p.revealedPipTotal !== null && (
                <p className="text-xs text-chip-blue">Pip total: {p.revealedPipTotal}</p>
              )}
            </div>
            <div className="flex gap-1">
              {(p.revealedCards ?? []).map((c, i) => (
                <Card key={i} card={c} size="sm" />
              ))}
            </div>
          </div>
        ))}
        {mucked.map((p) => (
          <div
            key={p.seat}
            className="flex items-center justify-between rounded-md bg-felt-dark/60 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-white">{p.displayName}</p>
              <p className="text-xs text-felt-light/70">Stack: ${p.chipStack}</p>
            </div>
            <p className="text-xs italic text-felt-light/70">Mucked</p>
          </div>
        ))}
      </div>
    </div>
  );
}

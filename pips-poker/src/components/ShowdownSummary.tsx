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
}

export function ShowdownSummary({ players }: { players: ShowdownPlayerSummary[] }) {
  const shown = players.filter((p) => !p.folded && p.revealedCards);
  if (shown.length === 0) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-chip-gold/40 bg-felt p-4">
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-chip-gold">
        Showdown
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((p) => (
          <div
            key={p.seat}
            className="flex items-center justify-between rounded-md bg-felt-dark/60 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-white">{p.displayName}</p>
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
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Card as CardType, ShowdownResult } from "@/lib/types";
import { Card } from "./Card";

// Shown once a hand reaches "hand_complete". Drives two things:
//  1) a clear, per-board "who won which pot" breakdown (poker half vs pip
//     half, one section per board so "run it twice" is easy to follow), and
//  2) the reveal of each player's hole cards + pip total.
// When a hand was run twice, the parent reveals boards one at a time via
// `visibleBoards` so the two run-outs are understandable in sequence, and
// each board's own cards flip face-up one by one (see BoardCards below) for
// suspense.

const BOARD_CARD_STAGGER_MS = 2000;

// Flips a board's community cards face-up one at a time, ~2s apart. Keyed by
// the parent on `${handId}-${boardIndex}` so it only replays when that board
// is genuinely new, not on every polling re-render.
function BoardCards({ cards }: { cards: CardType[] }) {
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    setRevealedCount(0);
    const timers = cards.map((_, i) =>
      setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), i * BOARD_CARD_STAGGER_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  return (
    <div className="mb-2 flex justify-center gap-1">
      {cards.map((c, j) => (
        <Card key={j} card={c} size="sm" faceDown={j >= revealedCount} />
      ))}
    </div>
  );
}

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

export function ShowdownSummary({
  result,
  players,
  visibleBoards,
  handId,
}: {
  result: ShowdownResult | null;
  players: ShowdownPlayerSummary[];
  visibleBoards: number;
  handId?: string | number | null;
}) {
  const shown = players.filter((p) => !p.folded && p.revealedCards);
  const boards = result?.boards ?? [];
  const boardsToShow = boards.slice(0, Math.max(1, visibleBoards));

  if (boards.length === 0 && shown.length === 0) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-chip-gold/40 bg-felt p-4">
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-chip-gold">
        {result?.ranItTwice ? "Showdown · Run it twice" : "Showdown"}
      </h2>

      {/* Per-board "who won which pot" breakdown */}
      <div className="flex flex-col gap-3">
        {boardsToShow.map((b, i) => (
          <div key={i} className="rounded-md bg-felt-dark/60 p-3">
            {b.label && (
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-chip-gold">
                {b.label}
              </p>
            )}
            {b.communityCards.length > 0 && (
              <BoardCards key={`${handId ?? "hand"}-${i}`} cards={b.communityCards} />
            )}

            {result?.uncontested ? (
              <p className="text-center text-sm font-semibold text-emerald-400">
                {b.pokerWinners[0]?.displayName} wins ${b.pokerWinners[0]?.amount} (everyone else folded)
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded bg-black/30 px-3 py-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                    🂡 Best poker hand
                  </p>
                  {b.pokerWinners.map((w, j) => (
                    <p key={j} className="text-xs text-white">
                      <span className="font-semibold">{w.displayName}</span>{" "}
                      <span className="text-emerald-400">+${w.amount}</span>
                      <span className="text-felt-light"> — {w.handLabel}</span>
                    </p>
                  ))}
                </div>
                <div className="rounded bg-black/30 px-3 py-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-chip-blue">
                    ◆ Highest pips
                  </p>
                  {b.pipWinners.map((w, j) => (
                    <p key={j} className="text-xs text-white">
                      <span className="font-semibold">{w.displayName}</span>{" "}
                      <span className="text-emerald-400">+${w.amount}</span>
                      <span className="text-felt-light"> — {w.pipTotal} pips</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {result?.ranItTwice && visibleBoards < boards.length && (
          <p className="text-center text-xs italic text-felt-light/70">Revealing second board…</p>
        )}
      </div>

      {/* Everyone's revealed hole cards + pips */}
      {shown.length > 0 && (
        <>
          <div className="my-3 h-px bg-white/10" />
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
          </div>
        </>
      )}
    </div>
  );
}

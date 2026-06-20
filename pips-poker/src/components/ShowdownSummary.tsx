"use client";

import { useEffect, useState } from "react";
import type { Card as CardType, ShowdownResult } from "@/lib/types";
import { Card } from "./Card";

// Shown once a hand reaches "hand_complete". Drives two things:
//  1) a clear, per-board "who won which pot" breakdown (poker half vs pip
//     half, one section per board so "run it twice" is easy to follow), and
//  2) the reveal of each player's hole cards + pip total.
// When a hand was run twice, every board's differing (post-flop) cards are
// flipped on one combined timeline — all of board 1's cards finish before
// board 1's any of board 2's start — so the two run-outs can never race or
// interleave, and each board's winner breakdown only appears once that
// board's cards are fully revealed.

const CARD_STAGGER_MS = 2000;

// How many leading community cards are identical across every board (the
// shared flop in a run-it-twice hand). Those render once, face-up, with no
// animation; only the cards after this point differ between boards and get
// the flip reveal.
function sharedPrefixLength(boards: { communityCards: CardType[] }[]): number {
  if (boards.length === 0) return 0;
  const first = boards[0].communityCards;
  let n = first.length;
  for (const b of boards.slice(1)) {
    let i = 0;
    while (i < n && i < b.communityCards.length && b.communityCards[i].rank === first[i].rank && b.communityCards[i].suit === first[i].suit) {
      i++;
    }
    n = Math.min(n, i);
  }
  return n;
}

// Groups winners that have the same label/total into one line, e.g. two
// players tied with "Straight, Ace high" both get listed together.
function groupWinners<T extends { displayName: string }>(winners: T[], keyOf: (w: T) => string): { displayNames: string[]; key: string }[] {
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (const w of winners) {
    const key = keyOf(w);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(w.displayName);
  }
  return order.map((key) => ({ key, displayNames: groups.get(key)! }));
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
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
  handId,
}: {
  result: ShowdownResult | null;
  players: ShowdownPlayerSummary[];
  handId?: string | number | null;
}) {
  const shown = players.filter((p) => !p.folded && p.revealedCards);
  const boards = result?.boards ?? [];
  // The shared-flop split only makes sense once there are two boards to
  // compare (a run-it-twice hand); for a normal single-board hand every
  // community card animates the same way, just treated as "board 0's
  // differing cards" with no shared prefix.
  const flopLength = result?.ranItTwice ? sharedPrefixLength(boards) : 0;
  const sharedFlop = boards[0]?.communityCards.slice(0, flopLength) ?? [];
  const perBoardDiffering = boards.map((b) => b.communityCards.slice(flopLength));
  const totalDiffering = perBoardDiffering.reduce((sum, c) => sum + c.length, 0);
  // Cumulative card count through (and including) each board, so we know
  // exactly when board i's last card has flipped.
  const cumulative: number[] = [];
  perBoardDiffering.reduce((sum, c) => {
    const next = sum + c.length;
    cumulative.push(next);
    return next;
  }, 0);

  // One shared reveal clock across every board's differing cards, in order:
  // board 1's cards all flip (one by one) before board 2's first card does.
  const [revealedCount, setRevealedCount] = useState(0);
  useEffect(() => {
    setRevealedCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < totalDiffering; i++) {
      timers.push(setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), (i + 1) * CARD_STAGGER_MS));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handId, totalDiffering]);

  if (boards.length === 0 && shown.length === 0) return null;

  return (
    <div className="mx-auto flex max-h-full w-full max-w-3xl flex-col gap-2 overflow-y-auto rounded-lg border border-chip-gold/40 bg-felt p-5">
      <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wide text-chip-gold">
        {result?.ranItTwice ? "Showdown · Run it twice" : "Showdown"}
      </h2>

      {/* Shared flop cards in a row, shown once face-up with no animation;
          each board's differing turn/river cards fan out at an angle to the
          right of the flop — board 1 above, board 2 below — like a split
          board on a real table. */}
      {sharedFlop.length > 0 && (
        <div className="flex items-center justify-center py-3">
          <div className="flex gap-1.5">
            {sharedFlop.map((c, j) => (
              <Card key={j} card={c} size="md" />
            ))}
          </div>
          {result?.ranItTwice && (
            <div className="relative ml-3 h-20 w-28">
              {boards.map((b, i) => {
                const cards = perBoardDiffering[i];
                if (cards.length === 0) return null;
                const startIdx = i === 0 ? 0 : cumulative[i - 1];
                return (
                  <div
                    key={`${handId ?? "hand"}-fan-${i}`}
                    className={`absolute left-0 flex gap-1 ${i === 0 ? "-top-6 rotate-[-10deg]" : "top-6 rotate-[10deg]"}`}
                  >
                    {cards.map((c, j) => (
                      <Card key={j} card={c} size="md" faceDown={revealedCount < startIdx + j + 1} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Normal (non-run-it-twice) hand: no shared flop split, just the
          full community board animating in one card at a time. */}
      {!result?.ranItTwice && perBoardDiffering[0]?.length > 0 && (
        <div className="flex justify-center gap-1 py-3">
          {perBoardDiffering[0].map((c, j) => (
            <Card key={j} card={c} size="md" faceDown={revealedCount < j + 1} />
          ))}
        </div>
      )}

      {boards.map((b, i) => {
        // Hold off on a board's winner breakdown until its own cards have
        // finished flipping, so board 2's result never shows up before its
        // cards have been revealed (and vice versa for board 1).
        const boardRevealed = revealedCount >= (cumulative[i] ?? 0);
        if (!boardRevealed) return null;
        return (
          <div
            key={`${handId ?? "hand"}-${i}`}
            className={`rounded-md bg-felt-dark/60 p-3 ${i === boards.length - 1 || !result?.ranItTwice ? "animate-fadein" : ""}`}
          >
            {result?.ranItTwice && (
              <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-chip-gold">
                Board {i + 1}
              </p>
            )}

            {result?.uncontested ? (
              <p className="text-center text-sm font-semibold text-emerald-400">
                {b.pokerWinners[0]?.displayName} wins (everyone else folded)
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded bg-black/30 px-3 py-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">
                    🂡 Best poker hand
                  </p>
                  {groupWinners(b.pokerWinners, (w) => w.handLabel).map((g, j) => (
                    <p key={j} className="text-sm text-white">
                      <span className="font-semibold">{joinNames(g.displayNames)}</span>
                      <span className="text-white/50"> — {g.key}</span>
                    </p>
                  ))}
                </div>
                <div className="rounded bg-black/30 px-3 py-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-chip-blue">
                    ◆ Highest pips
                  </p>
                  {groupWinners(b.pipWinners, (w) => `${w.pipTotal} pips`).map((g, j) => (
                    <p key={j} className="text-sm text-white">
                      <span className="font-semibold">{joinNames(g.displayNames)}</span>
                      <span className="text-white/50"> — {g.key}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {result?.ranItTwice && revealedCount < totalDiffering && (
        <p className="text-center text-xs italic text-white/60">
          {revealedCount < (cumulative[0] ?? 0) ? "Revealing board 1…" : "Revealing board 2…"}
        </p>
      )}

      {/* Everyone's revealed hole cards + pips, below both boards */}
      {shown.length > 0 && (
        <>
          <div className="h-px bg-white/10" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shown.map((p) => (
              <div
                key={p.seat}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${
                  p.amountWon > 0 ? "bg-emerald-900/40 ring-1 ring-chip-gold/60" : "bg-felt-dark/60"
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-white">
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
                    <Card key={i} card={c} size="md" />
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

"use client";

import { useEffect, useState } from "react";
import type { Card as CardType, ShowdownResult } from "@/lib/types";
import { Card } from "./Card";

// Shown once a hand reaches "hand_complete". Drives two things:
//  1) a clear, per-board "who won which pot" breakdown (poker half vs pip
//     half, one section per board so "run it twice" is easy to follow), and
//  2) the reveal of each player's hole cards + pip total.
// When a hand was run twice, the parent reveals boards one at a time via
// `visibleBoards`: board 1 stays on screen and board 2 fades in directly
// beneath it once it's ready, so both run-outs can be compared side by
// side, and each board's own cards flip face-up one by one (see BoardCards
// below) for suspense.

const BOARD_CARD_STAGGER_MS = 2000;

// Flips a board's *differing* cards (turn/river) face-up one at a time, ~2s
// apart. Keyed by the parent on `${handId}-${boardIndex}` so it only replays
// when that board is genuinely new, not on every polling re-render.
function BoardCards({ cards }: { cards: CardType[] }) {
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    setRevealedCount(0);
    // Wait a full stagger interval before the *first* card flips too, even
    // when a board only has one differing card — otherwise it would flip
    // the instant it mounts, with no suspense at all.
    const timers = cards.map((_, i) =>
      setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), (i + 1) * BOARD_CARD_STAGGER_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  return (
    <div className="flex justify-center gap-1">
      {cards.map((c, j) => (
        <Card key={j} card={c} size="md" faceDown={j >= revealedCount} />
      ))}
    </div>
  );
}

// How many leading community cards are identical across every board being
// shown (the shared flop in a run-it-twice hand). Those render once, face-up,
// with no animation; only the cards after this point differ between boards
// and get the flip reveal.
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
  // The shared-flop split only makes sense once there are two boards to
  // compare (a run-it-twice hand); for a normal single-board hand every
  // community card should still animate in one by one.
  const flopLength = result?.ranItTwice ? sharedPrefixLength(boards) : 0;
  const sharedFlop = boards[0]?.communityCards.slice(0, flopLength) ?? [];

  if (boards.length === 0 && shown.length === 0) return null;

  return (
    <div className="mx-auto flex max-h-full w-full max-w-3xl flex-col gap-2 overflow-y-auto rounded-lg border border-chip-gold/40 bg-felt p-5">
      <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wide text-chip-gold">
        {result?.ranItTwice ? "Showdown · Run it twice" : "Showdown"}
      </h2>

      {/* Shared flop cards in a row, shown once face-up with no animation;
          each board's differing turn/river cards fan out at an angle to the
          right of the flop — board 1 above, board 2 below — like a split
          board on a real table. Always rendered (even before board 2 is
          revealed) so board 1's reveal animation never restarts partway
          through; board 2's fan simply mounts later, once visibleBoards
          allows it, so board 1 finishes its run-out first. */}
      {sharedFlop.length > 0 && (
        <div className="flex items-center justify-center py-3">
          <div className="flex gap-1.5">
            {sharedFlop.map((c, j) => (
              <Card key={j} card={c} size="md" />
            ))}
          </div>
          <div className="relative ml-3 h-20 w-28">
            {boardsToShow.map((b, i) => {
              const differingCards = b.communityCards.slice(flopLength);
              if (differingCards.length === 0) return null;
              const isFirst = i === 0;
              return (
                <div
                  key={`${handId ?? "hand"}-fan-${i}`}
                  className={`absolute left-0 flex gap-1 ${
                    isFirst ? "-top-6 rotate-[-10deg]" : "top-6 rotate-[10deg]"
                  } ${i === boardsToShow.length - 1 ? "animate-fadein" : ""}`}
                >
                  <BoardCards key={`${handId ?? "hand"}-cards-${i}`} cards={differingCards} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Normal (non-run-it-twice) hand: no shared flop split, just the
          full community board animating in one card at a time. */}
      {!result?.ranItTwice && boards[0]?.communityCards.length > 0 && (
        <div className="flex justify-center py-3">
          <BoardCards key={`${handId ?? "hand"}-cards-0`} cards={boards[0].communityCards} />
        </div>
      )}

      {boardsToShow.map((b, i) => {
        return (
          <div
            key={`${handId ?? "hand"}-${i}`}
            className={`rounded-md bg-felt-dark/60 p-3 ${i === boardsToShow.length - 1 ? "animate-fadein" : ""}`}
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
      {result?.ranItTwice && visibleBoards < boards.length && (
        <p className="text-center text-xs italic text-white/60">Revealing second board…</p>
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

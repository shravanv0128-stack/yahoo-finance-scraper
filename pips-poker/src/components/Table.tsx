"use client";

// The oval felt table itself: positions up to 9 seats evenly around an
// ellipse with the viewer's own seat rotated to the bottom-center (the
// PokerNow convention), renders the dealer button on whichever seat is
// dealer, and places the community board + pot display in the middle of
// the felt.

import type { Card } from "@/lib/types";
import { PlayerSeat } from "./PlayerSeat";
import { CommunityBoard } from "./CommunityBoard";
import { PotDisplay } from "./PotDisplay";

export interface TableSeatData {
  seat: number;
  displayName: string;
  chipStack: number;
  currentBet: number;
  status: string;
  isActingSeat: boolean;
  isMe: boolean;
  holeCards: Card[] | null;
  revealedCards: Card[] | null;
  revealedPipTotal: number | null;
  swappedCount: number | null;
  isWinner?: boolean;
}

export interface TableProps {
  seats: TableSeatData[];
  dealerSeat: number;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  pots?: { amount: number; label: string }[];
  mySeat: number | null;
  actDeadline?: string | null;
  actTimeoutSeconds?: number;
}

// Returns evenly spaced [x%, y%] positions around an ellipse, starting from
// the bottom (90deg) and going clockwise, so index 0 lands at bottom-center.
function ellipsePosition(index: number, total: number): { left: string; top: string } {
  const angleStep = (2 * Math.PI) / total;
  const angle = Math.PI / 2 + index * angleStep; // start at bottom, go clockwise
  const rx = 44; // % of width
  const ry = 34; // % of height
  const x = 50 + rx * Math.cos(angle);
  let y = 50 + ry * Math.sin(angle);
  // The bottom seat (always the viewer's own) grows tallest when it's their
  // turn to act (turn badge + bigger cards + timer bar + hand label), and
  // since seats are centered on this point, that extra height would grow
  // upward into the community cards too. Push it down a bit more than the
  // ellipse alone would to keep clearance from the board.
  if (index === 0) y += 6;
  return { left: `${x}%`, top: `${y}%` };
}

export function Table({
  seats,
  dealerSeat,
  communityCards,
  pot,
  currentBet,
  pots,
  mySeat,
  actDeadline = null,
  actTimeoutSeconds = 60,
}: TableProps) {
  // Rotate the seat order so the viewer's own seat is always index 0
  // (bottom-center), matching PokerNow's "you are always at the bottom".
  const orderedSeats =
    mySeat === null
      ? seats
      : (() => {
          const myIdx = seats.findIndex((s) => s.seat === mySeat);
          if (myIdx === -1) return seats;
          return [...seats.slice(myIdx), ...seats.slice(0, myIdx)];
        })();

  return (
    <div className="relative mx-auto h-full max-h-full w-full max-w-5xl" style={{ aspectRatio: "16/10" }}>
      {/* Flat PokerNow-style felt: a plain dark bezel ring around a solid
          green oval, no glow/bloom. */}
      <div className="absolute inset-[4%] rounded-[50%] bg-zinc-900" />
      <div className="absolute inset-[7%] rounded-[50%] bg-felt shadow-table ring-2 ring-black/40" />

      {/* Center: community cards + pot */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
        <PotDisplay pot={pot} currentBet={currentBet} pots={pots} />
        <CommunityBoard cards={communityCards} />
      </div>

      {/* Seats */}
      {orderedSeats.map((s, i) => {
        const pos = ellipsePosition(i, orderedSeats.length);
        return (
          <div
            key={s.seat}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.left, top: pos.top }}
          >
            <PlayerSeat
              seat={s.seat}
              displayName={s.displayName}
              chipStack={s.chipStack}
              currentBet={s.currentBet}
              status={s.status}
              isActingSeat={s.isActingSeat}
              isMe={s.isMe}
              isDealer={s.seat === dealerSeat}
              holeCards={s.holeCards}
              revealedCards={s.revealedCards}
              revealedPipTotal={s.revealedPipTotal}
              swappedCount={s.swappedCount}
              isWinner={s.isWinner}
              communityCards={communityCards}
              actDeadline={s.isActingSeat ? actDeadline : null}
              actTimeoutSeconds={actTimeoutSeconds}
            />
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="relative mx-auto aspect-[16/10] w-full max-w-5xl max-h-full">
      {/* Outer glow halo behind the whole table, like light bleeding off a
          backlit panel. */}
      <div className="absolute inset-[2%] rounded-[50%] bg-neon/5 blur-3xl" />

      {/* Metallic bezel ring */}
      <div className="absolute inset-[6%] rounded-[50%] bg-gradient-to-b from-zinc-800 via-black to-black shadow-[0_0_50px_10px_rgba(0,0,0,0.8)]" />
      {/* Glass felt surface, inset within the bezel */}
      <div className="absolute inset-[8.5%] rounded-[50%] bg-felt shadow-table" />
      {/* Thin glowing neon trim tracing the bezel's inner edge */}
      <div className="absolute inset-[8.5%] rounded-[50%] ring-1 ring-neon/70 shadow-[0_0_18px_4px_rgba(57,255,140,0.55)]" />
      {/* Faint inner accent ring for depth */}
      <div className="absolute inset-[12%] rounded-[50%] border border-neon/10" />

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

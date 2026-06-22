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
  isPaused?: boolean;
}

// Returns evenly spaced [x%, y%] positions around an ellipse, starting from
// the bottom (90deg) and going clockwise, so index 0 lands at bottom-center.
function ellipsePosition(index: number, total: number): { left: string; top: string } {
  const angleStep = (2 * Math.PI) / total;
  const angle = Math.PI / 2 + index * angleStep; // start at bottom, go clockwise
  const rx = 43; // % of width
  const ry = 28; // % of height — slightly tighter vertically so seats stay inside the oval
  const x = 50 + rx * Math.cos(angle);
  let y = 50 + ry * Math.sin(angle);
  // Push the bottom seat (viewer's own) further down so the community board
  // never overlaps hole cards even when the seat is tallest (lg cards + badge).
  if (index === 0) y += 8;
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
  isPaused = false,
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
    <div className="relative mx-auto h-full max-h-full w-full max-w-7xl" style={{ aspectRatio: "16/10" }}>
      {/* Amber wood rail (4 nested layers, matching PokerNow's carved-rail look) */}
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-amber-900 via-amber-950 to-black shadow-[0_30px_60px_rgba(0,0,0,0.7)]">
        <div className="h-full w-full rounded-[50%] bg-gradient-to-b from-yellow-700/80 via-amber-800 to-amber-950 p-[3%] shadow-[inset_0_2px_8px_rgba(255,255,255,0.12)]">
          <div className="h-full w-full rounded-[50%] bg-gradient-to-b from-amber-950 to-stone-900 p-[2%] shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)]">
            {/* Felt */}
            <div
              className="felt-texture relative h-full w-full rounded-[50%] shadow-table ring-1 ring-black/40"
              style={{ background: "radial-gradient(ellipse at center, #1e5e3f 0%, #10402a 55%, #0a2a1c 100%)" }}
            >
              {/* Subtle center decorative ring */}
              <div className="absolute inset-[14%] rounded-[50%] border border-emerald-300/8" />
            </div>
          </div>
        </div>
      </div>

      {/* Center: community cards + pot — shifted slightly above true center
          so the board doesn't crowd the bottom seat's hole cards */}
      <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
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
              isPaused={isPaused}
            />
          </div>
        );
      })}
    </div>
  );
}

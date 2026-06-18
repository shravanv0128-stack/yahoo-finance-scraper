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
  maxSeats?: number;
  onTakeSeat?: () => void;
}

// Returns evenly spaced [x%, y%] positions around an ellipse, starting from
// the bottom (90deg) and going clockwise, so index 0 lands at bottom-center.
function ellipsePosition(index: number, total: number): { left: string; top: string } {
  const angleStep = (2 * Math.PI) / total;
  const angle = Math.PI / 2 + index * angleStep; // start at bottom, go clockwise
  const rx = 46; // % of width
  const ry = 40; // % of height
  const x = 50 + rx * Math.cos(angle);
  const y = 50 + ry * Math.sin(angle);
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
  maxSeats = 8,
  onTakeSeat,
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

  const totalSlots = Math.max(maxSeats, orderedSeats.length);
  const emptySlotCount = totalSlots - orderedSeats.length;

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-4xl">
      {/* Felt surface */}
      <div className="absolute inset-[6%] rounded-[50%] bg-felt shadow-table ring-4 ring-neon/40" />
      <div className="absolute inset-[6%] rounded-[50%] ring-1 ring-neon/20" />
      <div className="absolute inset-[9%] rounded-[50%] border border-neon/10" />

      {/* Center: community cards + pot */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
        <PotDisplay pot={pot} currentBet={currentBet} pots={pots} />
        <CommunityBoard cards={communityCards} />
      </div>

      {/* Occupied seats */}
      {orderedSeats.map((s, i) => {
        const pos = ellipsePosition(i, totalSlots);
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
              communityCards={communityCards}
              actDeadline={s.isActingSeat ? actDeadline : null}
              actTimeoutSeconds={actTimeoutSeconds}
            />
          </div>
        );
      })}

      {/* Empty slots: futuristic "TAKE SEAT" placeholders */}
      {Array.from({ length: emptySlotCount }).map((_, i) => {
        const pos = ellipsePosition(orderedSeats.length + i, totalSlots);
        return (
          <button
            key={`empty-${i}`}
            onClick={onTakeSeat}
            disabled={!onTakeSeat}
            className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neon/30 bg-black/60 text-center text-[10px] font-bold uppercase tracking-wide text-neon/70 shadow-neon transition hover:bg-neon/10 hover:text-neon disabled:cursor-default disabled:opacity-50"
            style={{ left: pos.left, top: pos.top }}
          >
            Take
            <br />
            Seat
          </button>
        );
      })}
    </div>
  );
}

import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";
import { TurnTimerBar } from "./TurnTimerBar";
import { evaluateBestHandFlexible, handCategoryLabel } from "@/lib/handEvaluator";
import { computePipTotal } from "@/lib/pipEvaluator";

export interface PlayerSeatProps {
  seat: number;
  displayName: string;
  chipStack: number;
  currentBet: number;
  status: string;
  isActingSeat: boolean;
  isMe: boolean;
  isDealer?: boolean;
  holeCards: CardType[] | null; // null = unknown/hidden, [] = folded/no cards
  revealedCards: CardType[] | null;
  revealedPipTotal: number | null;
  swappedCount: number | null;
  communityCards?: CardType[];
  actDeadline?: string | null;
  actTimeoutSeconds?: number;
  isPaused?: boolean;
  // True for a few seconds right after this player takes the pot - shows a
  // spinning gold halo behind their avatar and enlarges their cards, so it's
  // obvious who won without needing the full showdown popup (used for
  // uncontested hands, where there's nothing else to show).
  isWinner?: boolean;
}

// A single seat around the oval felt table: avatar circle with name, chip
// stack readout below, a current-bet chip badge, and 3 hole cards above the
// avatar (face up only for the viewer's own seat or at showdown). The
// currently-acting seat gets a glowing amber ring, mirroring PokerNow.
export function PlayerSeat({
  seat,
  displayName,
  chipStack,
  currentBet,
  status,
  isActingSeat,
  isMe,
  isDealer = false,
  holeCards,
  revealedCards,
  revealedPipTotal,
  swappedCount,
  communityCards,
  actDeadline = null,
  actTimeoutSeconds = 60,
  isPaused = false,
  isWinner = false,
}: PlayerSeatProps) {
  const cardsToShow = revealedCards ?? (isMe ? holeCards : null);
  const showFaceUp = revealedCards !== null || isMe;
  const folded = status === "folded";
  const busted = chipStack <= 0 && status === "sitting_out";

  // Live "what am I holding" ribbon for the viewer's own seat during play:
  // the current best poker hand (given the board so far) plus the pip total.
  // Only shown for your own cards while the hand is live (not at showdown,
  // where the summary already breaks everything down).
  let liveLabel: string | null = null;
  let livePips: number | null = null;
  if (isMe && !folded && revealedCards === null && holeCards && holeCards.length === 3) {
    livePips = computePipTotal(holeCards).total;
    const best = communityCards ? evaluateBestHandFlexible(holeCards, communityCards) : null;
    if (best) liveLabel = handCategoryLabel(best);
  }

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl transition-all duration-300 ${
        folded || busted ? "opacity-50" : ""
      } ${
        isActingSeat
          ? "animate-pulseglow bg-yellow-400/8 px-2 py-2 ring-2 ring-yellow-300 shadow-[0_0_20px_6px_rgba(250,204,21,0.45),0_0_40px_12px_rgba(250,204,21,0.15)]"
          : ""
      }`}
    >
      {isActingSeat && (
        <div className="rounded-full bg-gradient-to-b from-yellow-300 to-yellow-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_12px_3px_rgba(250,204,21,0.65)] ring-1 ring-yellow-200/60">
          {isMe ? "Your turn" : "Acting"}
        </div>
      )}

      {/* Opponents' hidden cards collapse into a small overlapping stack
          (PokerNow-style) so they take up far less room at the table -
          except while it's actually their turn, when they fan out bigger
          and face down so the acting seat reads clearly. Your own cards,
          folded hands, and anyone's revealed cards at showdown, always
          fan out fully (folded gets the dimmed cross overlay on top). */}
      {!isMe && !showFaceUp && !isActingSeat && !folded ? (
        <div className="relative flex h-16 w-14 items-center justify-center">
          <div className="absolute -translate-x-2 rotate-[-9deg]">
            <Card faceDown size="sm" />
          </div>
          <div className="absolute">
            <Card faceDown size="sm" />
          </div>
          <div className="absolute translate-x-2 rotate-[9deg]">
            <Card faceDown size="sm" />
          </div>
        </div>
      ) : (
        <div className="relative flex gap-1.5">
          {(cardsToShow ?? (holeCards ? [null, null, null] : [])).map((_, i) => (
            <Card
              key={i}
              card={cardsToShow?.[i] ?? undefined}
              faceDown={!showFaceUp || !cardsToShow?.[i]}
              size={isWinner || (isActingSeat && isMe) ? "lg" : "md"}
              highlight={isActingSeat || isWinner}
            />
          ))}
          {folded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/45 backdrop-blur-[1px]">
              <svg viewBox="0 0 24 24" className="h-10 w-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
                <line x1="5" y1="5" x2="19" y2="19" stroke="#f5f5f5" strokeWidth="2.75" strokeLinecap="round" />
                <line x1="19" y1="5" x2="5" y2="19" stroke="#f5f5f5" strokeWidth="2.75" strokeLinecap="round" />
                <line x1="5" y1="5" x2="19" y2="19" stroke="#ef4444" strokeWidth="1.25" strokeLinecap="round" />
                <line x1="19" y1="5" x2="5" y2="19" stroke="#ef4444" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      )}

      {isActingSeat && (
        <div className="w-full px-0.5">
          <TurnTimerBar deadline={actDeadline} totalSeconds={actTimeoutSeconds} paused={isPaused} />
        </div>
      )}

      {!isMe && !folded && swappedCount !== null && (
        <div className="rounded bg-zinc-800/95 px-2 py-1 text-xs font-semibold text-yellow-300 ring-1 ring-black/40">
          {swappedCount === 0 ? `${displayName} stood pat` : `${displayName} swapped ${swappedCount}`}
        </div>
      )}

      {(liveLabel || livePips !== null) && (
        <div className="flex items-center gap-1 rounded bg-zinc-800/95 px-2 py-1 text-xs font-semibold ring-1 ring-black/40">
          {liveLabel && <span className="text-yellow-300">{liveLabel}</span>}
          {liveLabel && livePips !== null && <span className="text-white/30">·</span>}
          {livePips !== null && <span className="text-chip-blue">{livePips} pips</span>}
        </div>
      )}

      {/* PokerNow-style rectangular name plate */}
      <div className="relative p-1.5">
        {isWinner && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-yellow-300 shadow-[0_0_16px_4px_rgba(250,204,21,0.55)]" />
        )}
        <div
          className={`relative flex min-w-[8rem] flex-col items-center gap-0.5 rounded-xl border px-4 py-2 text-center shadow-glass ${
            isWinner
              ? "border-yellow-300 bg-gradient-to-b from-yellow-900/40 to-zinc-900/90"
              : isActingSeat
                ? "border-yellow-400/70 bg-gradient-to-b from-yellow-900/25 to-zinc-900/90"
                : "border-white/8 bg-gradient-to-b from-zinc-800/90 to-zinc-900/90"
          }`}
        >
          {isDealer && (
            <span className="absolute -left-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-white to-gray-100 text-xs font-black text-black shadow-chip ring-2 ring-black/30">
              D
            </span>
          )}
          <span className="px-1 text-sm font-semibold leading-tight text-white/90">
            {displayName}
            {isMe && <span className="ml-1 text-[10px] font-normal text-white/40">(you)</span>}
          </span>
          <span className="text-sm font-black leading-tight text-chip-gold">{chipStack}</span>
          {status === "all_in" && (
            <span className="absolute -bottom-3 rounded-full bg-gradient-to-b from-chip-red to-red-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-btn-fold ring-1 ring-black/40">
              ALL IN
            </span>
          )}
        </div>
      </div>

      {currentBet > 0 && (
        <div className="flex items-center gap-1.5 rounded-full border border-chip-gold/30 bg-zinc-900/90 px-3 py-1 text-xs font-black text-chip-gold shadow-btn-allin">
          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-yellow-200 to-chip-gold shadow-chip ring-1 ring-black/40" />
          {currentBet}
        </div>
      )}

      {folded && <span className="text-xs uppercase tracking-wide text-gray-400">Folded</span>}
      {busted && (
        <span className="text-xs font-bold uppercase tracking-wide text-chip-red">Busted - rebuy to play</span>
      )}
      {revealedPipTotal !== null && (
        <span className="text-xs text-chip-blue">Pips: {revealedPipTotal}</span>
      )}
    </div>
  );
}

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
      className={`flex flex-col items-center gap-1 rounded-2xl transition-all duration-300 ${
        folded || busted ? "opacity-40" : ""
      } ${isActingSeat ? "bg-amber-400/5 p-2 ring-1 ring-amber-300/40" : "p-2"}`}
    >
      {isActingSeat && (
        <div className="rounded-full border border-amber-300/60 bg-black/70 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 shadow-[0_0_8px_1px_rgba(251,191,36,0.4)]">
          {isMe ? "Your turn" : "Acting"}
        </div>
      )}

      <div className="relative flex gap-1">
        {(cardsToShow ?? (holeCards ? [null, null, null] : [])).map((_, i) => (
          <Card
            key={i}
            card={cardsToShow?.[i] ?? undefined}
            faceDown={!showFaceUp || !cardsToShow?.[i]}
            size={isWinner || isActingSeat ? "lg" : "md"}
            highlight={isActingSeat || isWinner}
          />
        ))}
        {folded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-red-500/90 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]">
              ✕
            </span>
          </div>
        )}
      </div>

      {isActingSeat && (
        <div className="w-full px-0.5">
          <TurnTimerBar deadline={actDeadline} totalSeconds={actTimeoutSeconds} />
        </div>
      )}

      {!isMe && !folded && swappedCount !== null && (
        <div className="rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-chip-gold shadow ring-1 ring-chip-gold/40">
          {swappedCount === 0 ? `${displayName} stood pat` : `${displayName} swapped ${swappedCount}`}
        </div>
      )}

      {(liveLabel || livePips !== null) && (
        <div className="flex items-center gap-1 rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold shadow ring-1 ring-chip-gold/40">
          {liveLabel && <span className="text-chip-gold">{liveLabel}</span>}
          {liveLabel && livePips !== null && <span className="text-white/30">·</span>}
          {livePips !== null && <span className="text-chip-blue">{livePips} pips</span>}
        </div>
      )}

      <div className="relative">
        {isWinner && (
          <div
            className="animate-spin absolute -inset-2.5 rounded-full opacity-90 blur-[2px]"
            style={{
              background:
                "conic-gradient(from 0deg, #fde68a, #f59e0b, #fde68a 50%, transparent 75%, #fde68a)",
              animationDuration: "2.5s",
            }}
          />
        )}
      <div
        className={`relative flex flex-col items-center justify-center rounded-full border bg-gradient-to-b from-zinc-800/90 via-black/90 to-black text-center backdrop-blur-sm transition-all ${
          isActingSeat ? "h-24 w-24" : "h-20 w-20"
        } ${
          isWinner
            ? "border-amber-300 shadow-[0_0_16px_4px_rgba(251,191,36,0.6)]"
            : isActingSeat
              ? "border-amber-300/80 shadow-[0_0_10px_2px_rgba(251,191,36,0.4)]"
              : "border-neon/50 shadow-neon"
        }`}
      >
        {isDealer && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neon text-[10px] font-bold text-felt-dark shadow-neon">
            D
          </span>
        )}
        <span className="px-1 text-[11px] font-semibold leading-tight text-white">
          {displayName}
          {isMe ? " (you)" : ""}
        </span>
        {status === "all_in" && (
          <span className="absolute -bottom-2 rounded bg-chip-red px-1 text-[8px] font-bold text-white">
            ALL IN
          </span>
        )}
      </div>
      </div>

      <div className="rounded-full border border-neon/30 bg-black/60 px-2 py-0.5 text-xs font-semibold text-neon">
        ${chipStack}
      </div>

      {currentBet > 0 && (
        <div className="rounded-full bg-neon px-2 py-0.5 text-[10px] font-bold text-felt-dark shadow-neon">
          ${currentBet}
        </div>
      )}

      {folded && <span className="text-[10px] uppercase tracking-wide text-gray-400">Folded</span>}
      {busted && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-chip-red">Busted - rebuy to play</span>
      )}
      {revealedPipTotal !== null && (
        <span className="text-[10px] text-chip-blue">Pips: {revealedPipTotal}</span>
      )}
    </div>
  );
}

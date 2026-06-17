import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";
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
  communityCards?: CardType[];
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
  communityCards,
}: PlayerSeatProps) {
  const cardsToShow = revealedCards ?? (isMe ? holeCards : null);
  const showFaceUp = revealedCards !== null || isMe;
  const folded = status === "folded";

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
    <div className={`flex flex-col items-center gap-1 ${folded ? "opacity-40" : ""}`}>
      <div className="flex gap-1">
        {(cardsToShow ?? (holeCards ? [null, null, null] : [])).map((_, i) => (
          <Card
            key={i}
            card={cardsToShow?.[i] ?? undefined}
            faceDown={!showFaceUp || !cardsToShow?.[i]}
            size={isMe ? "md" : "sm"}
          />
        ))}
      </div>

      {(liveLabel || livePips !== null) && (
        <div className="flex items-center gap-1 rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold shadow ring-1 ring-chip-gold/40">
          {liveLabel && <span className="text-chip-gold">{liveLabel}</span>}
          {liveLabel && livePips !== null && <span className="text-white/30">·</span>}
          {livePips !== null && <span className="text-chip-blue">{livePips} pips</span>}
        </div>
      )}

      <div
        className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 bg-slate-800/90 text-center transition-shadow ${
          isActingSeat
            ? "border-amber-400 shadow-[0_0_18px_5px_rgba(251,191,36,0.65)]"
            : "border-slate-600"
        }`}
      >
        {isDealer && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-900 shadow">
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

      <div className="rounded bg-black/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
        ${chipStack}
      </div>

      {currentBet > 0 && (
        <div className="rounded-full bg-chip-gold/90 px-2 py-0.5 text-[10px] font-bold text-felt-dark shadow">
          ${currentBet}
        </div>
      )}

      {folded && <span className="text-[10px] uppercase tracking-wide text-gray-400">Folded</span>}
      {revealedPipTotal !== null && (
        <span className="text-[10px] text-chip-blue">Pips: {revealedPipTotal}</span>
      )}
    </div>
  );
}

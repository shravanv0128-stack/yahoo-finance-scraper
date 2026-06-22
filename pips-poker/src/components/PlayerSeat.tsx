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
        isActingSeat && isMe
          ? "animate-pulseglow bg-amber-400/10 px-2 py-2 ring-2 ring-amber-300 shadow-[0_0_24px_8px_rgba(251,191,36,0.5),0_0_48px_16px_rgba(251,191,36,0.18)]"
          : isActingSeat
          ? "animate-pulseglow bg-white/5 px-2 py-2 ring-2 ring-white/60 shadow-[0_0_20px_6px_rgba(255,255,255,0.25),0_0_40px_12px_rgba(255,255,255,0.08)]"
          : ""
      }`}
    >
      {isActingSeat && (
        <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-lg ring-1 ${
          isMe
            ? "bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-900 shadow-[0_0_12px_3px_rgba(251,191,36,0.6)] ring-amber-200/60"
            : "bg-gradient-to-b from-white/90 to-zinc-200 text-zinc-900 shadow-[0_0_10px_2px_rgba(255,255,255,0.3)] ring-white/40"
        }`}>
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

      {/* Nameplate: avatar + name/stack in a horizontal row */}
      <div className="relative p-1">
        {isWinner && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-yellow-300 shadow-[0_0_16px_4px_rgba(250,204,21,0.55)]" />
        )}
        <div
          className={`relative flex w-36 items-center gap-2 rounded-xl border px-2.5 py-2 shadow-xl backdrop-blur-sm transition-all ${
            isWinner
              ? "border-amber-400/70 bg-zinc-900/90 ring-2 ring-amber-400/30"
              : isActingSeat && isMe
                ? "border-amber-400/60 bg-zinc-900/90 ring-2 ring-amber-400/25"
                : isActingSeat
                  ? "border-white/40 bg-zinc-900/90 ring-2 ring-white/20"
                  : isMe
                    ? "border-amber-400/30 bg-zinc-900/90"
                    : "border-white/10 bg-zinc-900/90"
          } ${folded || busted ? "" : ""}`}
        >
          {isDealer && (
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-black text-zinc-900 shadow-md ring-2 ring-zinc-800">
              D
            </span>
          )}

          {/* Avatar circle with initial */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner ${
              isMe
                ? "bg-gradient-to-br from-amber-400 to-amber-600"
                : "bg-gradient-to-br from-emerald-500 to-emerald-700"
            }`}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          {/* Name + stack */}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold leading-tight text-zinc-100">
              {displayName}
              {isMe && <span className="ml-1 text-[10px] font-normal text-white/40">(you)</span>}
            </p>
            <p className="flex items-center gap-1 text-xs font-bold text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-700/60" />
              {chipStack}
            </p>
          </div>

          {status === "all_in" && (
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b from-chip-red to-red-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-btn-fold ring-1 ring-black/40">
              ALL IN
            </span>
          )}
        </div>
      </div>

      {currentBet > 0 && (
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-[9px] font-black text-white shadow-md ring-2 ring-white/20">
            $
          </span>
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300 shadow">
            {currentBet}
          </span>
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

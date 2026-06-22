import type { Card as CardType } from "@/lib/types";

const SUIT_SYMBOLS: Record<CardType["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS: CardType["suit"][] = ["hearts", "diamonds"];

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-16 w-12",
  md: "h-20 w-14",
  lg: "h-24 w-[4.25rem]",
};

const RANK_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const SUIT_CENTER_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

export function Card({
  card,
  faceDown = false,
  size = "md",
  highlight = false,
  revealDelayMs = 0,
}: {
  card?: CardType | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  revealDelayMs?: number;
}) {
  const dims = SIZE_CLASSES[size];
  const highlightRing = highlight
    ? "ring-2 ring-amber-300/80 shadow-[0_0_10px_3px_rgba(251,191,36,0.4)]"
    : "";

  const isRed = card ? RED_SUITS.includes(card.suit) : false;
  const showFace = !faceDown && !!card;

  return (
    <div className={`${dims} [perspective:600px]`}>
      <div
        className={`relative h-full w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${
          showFace ? "[transform:rotateY(180deg)]" : ""
        }`}
        style={{ transitionDelay: showFace ? `${revealDelayMs}ms` : "0ms" }}
      >
        {/* Back face */}
        <div
          className={`card-back-pattern ${highlightRing} absolute inset-0 flex items-center justify-center rounded-lg border border-black/40 bg-gradient-to-br from-red-700 via-red-800 to-red-950 shadow-[0_4px_12px_rgba(0,0,0,0.55)] [backface-visibility:hidden]`}
        >
          <div className="flex h-1/2 w-1/2 items-center justify-center rounded-sm border border-white/40 bg-white/5">
            <div className="h-1/3 w-1/3 rotate-45 rounded-[2px] bg-white/25" />
          </div>
        </div>

        {/* Front face — rank top-left, suit centered large, rank bottom-right inverted */}
        <div
          className={`${highlightRing} absolute inset-0 flex flex-col justify-between rounded-lg border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.55)] ring-1 ring-black/10 [backface-visibility:hidden] [transform:rotateY(180deg)]`}
        >
          {card && (
            <>
              {/* Top-left rank + suit */}
              <span className={`flex flex-col items-start leading-none ${RANK_CLASSES[size]} font-bold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
                {card.rank}
                <span className="text-[0.7em]">{SUIT_SYMBOLS[card.suit]}</span>
              </span>

              {/* Center suit — large */}
              <span className={`self-center leading-none ${SUIT_CENTER_CLASSES[size]} ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>

              {/* Bottom-right rank + suit, rotated 180° */}
              <span className={`flex flex-col items-end rotate-180 leading-none ${RANK_CLASSES[size]} font-bold ${isRed ? "text-rose-600" : "text-zinc-900"}`}>
                {card.rank}
                <span className="text-[0.7em]">{SUIT_SYMBOLS[card.suit]}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

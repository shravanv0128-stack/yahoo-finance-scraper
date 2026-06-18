import type { Card as CardType } from "@/lib/types";

const SUIT_SYMBOLS: Record<CardType["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS: CardType["suit"][] = ["hearts", "diamonds"];

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-12 w-9 text-xs",
  md: "h-20 w-14 text-base",
  lg: "h-24 w-16 text-lg",
};

export function Card({
  card,
  faceDown = false,
  size = "md",
  highlight = false,
}: {
  card?: CardType | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
}) {
  const dims = SIZE_CLASSES[size];
  const highlightClasses = highlight
    ? "ring-1 ring-amber-300/70 shadow-[0_0_8px_2px_rgba(251,191,36,0.35)]"
    : "";

  if (faceDown || !card) {
    return (
      <div
        className={`${dims} ${highlightClasses} flex items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-blue-900 to-slate-950 shadow-md`}
      >
        <div className="h-1/2 w-1/2 rounded-sm border border-white/20" />
      </div>
    );
  }

  const isRed = RED_SUITS.includes(card.suit);

  return (
    <div
      className={`${dims} ${highlightClasses} flex flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-md`}
    >
      <span className={`font-bold leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
        {card.rank}
      </span>
      <span className={`leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}

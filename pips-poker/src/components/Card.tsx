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
}: {
  card?: CardType | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${dims} flex items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-blue-900 to-slate-950 shadow-md`}
      >
        <div className="h-1/2 w-1/2 rounded-sm border border-white/20" />
      </div>
    );
  }

  const isRed = RED_SUITS.includes(card.suit);

  return (
    <div className={`${dims} flex flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-md`}>
      <span className={`font-bold leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
        {card.rank}
      </span>
      <span className={`leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}

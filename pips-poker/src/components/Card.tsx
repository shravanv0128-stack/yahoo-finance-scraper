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
  revealDelayMs = 0,
}: {
  card?: CardType | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  // Stagger when this card's flip-to-face-up transition kicks in, so a run
  // of several cards revealed at once (the flop, or a run-it-twice board)
  // flips over one at a time instead of all snapping at once.
  revealDelayMs?: number;
}) {
  const dims = SIZE_CLASSES[size];
  const highlightClasses = highlight
    ? "ring-1 ring-amber-300/70 shadow-[0_0_8px_2px_rgba(251,191,36,0.35)]"
    : "";

  const isRed = card ? RED_SUITS.includes(card.suit) : false;
  // faceDown (or no card dealt yet) shows the back face; otherwise rotate
  // the inner flip container 180deg to reveal the front face. Both faces
  // are always rendered and layered via backface-visibility so the flip is
  // a true 3D turn rather than a content swap.
  const showFace = !faceDown && !!card;

  return (
    <div className={`${dims} [perspective:600px]`}>
      <div
        className={`relative h-full w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${
          showFace ? "[transform:rotateY(180deg)]" : ""
        }`}
        style={{ transitionDelay: showFace ? `${revealDelayMs}ms` : "0ms" }}
      >
        {/* Back face (card down) */}
        <div
          className={`${highlightClasses} absolute inset-0 flex items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-blue-900 to-slate-950 shadow-md [backface-visibility:hidden]`}
        >
          <div className="h-1/2 w-1/2 rounded-sm border border-white/20" />
        </div>

        {/* Front face (card up) */}
        <div
          className={`${highlightClasses} absolute inset-0 flex flex-col items-center justify-center rounded-md border border-gray-300 bg-white shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]`}
        >
          {card && (
            <>
              <span className={`font-bold leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
                {card.rank}
              </span>
              <span className={`leading-tight ${isRed ? "text-chip-red" : "text-chip-black"}`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
  md: "h-28 w-20",
  lg: "h-32 w-[5.75rem]",
};

const RANK_TEXT_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

const SUIT_TEXT_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
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

  const cornerRankClasses: Record<"sm" | "md" | "lg", string> = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };
  const cornerSuitClasses: Record<"sm" | "md" | "lg", string> = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className={`${dims} [perspective:600px]`}>
      <div
        className={`relative h-full w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${
          showFace ? "[transform:rotateY(180deg)]" : ""
        }`}
        style={{ transitionDelay: showFace ? `${revealDelayMs}ms` : "0ms" }}
      >
        {/* Back face (card down): deep red gradient with a diamond lattice
            pattern and a centered emblem, closer to a real card back than a
            flat color block. */}
        <div
          className={`card-back-pattern ${highlightClasses} absolute inset-0 flex items-center justify-center rounded-md border border-black/40 bg-gradient-to-br from-red-700 via-red-800 to-red-950 shadow-md [backface-visibility:hidden]`}
        >
          <div className="flex h-1/2 w-1/2 items-center justify-center rounded-sm border border-white/40 bg-white/5">
            <div className="h-1/3 w-1/3 rotate-45 rounded-[2px] bg-white/25" />
          </div>
        </div>

        {/* Front face (card up): off-white card stock with a faint inner
            border and small corner index in addition to the large centered
            rank/suit, for a more authentic printed-card look. */}
        <div
          className={`${highlightClasses} absolute inset-0 flex flex-col items-center justify-center rounded-md border border-gray-300 bg-gradient-to-b from-white to-gray-50 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]`}
        >
          {card && (
            <>
              <span
                className={`absolute left-1 top-0.5 flex flex-col items-center leading-none font-bold ${cornerRankClasses[size]} ${isRed ? "text-chip-red" : "text-chip-black"}`}
              >
                {card.rank}
                <span className={cornerSuitClasses[size]}>{SUIT_SYMBOLS[card.suit]}</span>
              </span>
              <span
                className={`font-extrabold leading-none ${RANK_TEXT_CLASSES[size]} ${isRed ? "text-chip-red" : "text-chip-black"}`}
              >
                {card.rank}
              </span>
              <span className={`leading-none ${SUIT_TEXT_CLASSES[size]} ${isRed ? "text-chip-red" : "text-chip-black"}`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

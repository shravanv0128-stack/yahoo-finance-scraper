import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";

export function CommunityBoard({ cards }: { cards: CardType[] }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) =>
        cards[i] ? (
          <Card key={i} card={cards[i]} />
        ) : (
          <div key={i} className="h-20 w-14 rounded-md border border-dashed border-white/15" />
        )
      )}
    </div>
  );
}

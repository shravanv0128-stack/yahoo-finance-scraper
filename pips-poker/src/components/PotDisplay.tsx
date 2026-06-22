// Prominent pot-total readout shown above/around the community board, plus
// the current bet-to-call amount, matching PokerNow's center-of-table pot
// chip stack + label pattern. When players are all-in for different amounts
// the pot splits into a main pot + side pots, each shown on its own chip so
// nobody has to do the side-pot math by hand.

export interface PotChip {
  amount: number;
  label: string;
}

// A small stack of layered chip discs (gold/red/blue), purely decorative,
// rendered next to the pot label to evoke a real chip pile on the felt.
function ChipStack({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const colors = ["bg-chip-gold", "bg-chip-red", "bg-chip-blue"];
  return (
    <div className="relative flex h-4 items-end">
      {colors.map((c, i) => (
        <div
          key={i}
          className={`${dims} ${c} animate-chipland -ml-1.5 rounded-full shadow-chip ring-1 ring-black/40 first:ml-0`}
          style={{ animationDelay: `${i * 60}ms`, zIndex: i }}
        />
      ))}
    </div>
  );
}

export function PotDisplay({
  pot,
  currentBet,
  pots,
}: {
  pot: number;
  currentBet: number;
  pots?: PotChip[];
}) {
  // Show the per-pot breakdown only when there's an actual side pot; otherwise
  // fall back to the single aggregate "POT $x" chip.
  const hasSidePots = (pots?.length ?? 0) > 1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {hasSidePots ? (
        <div className="flex flex-col items-center gap-1.5">
          {pots!.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-black/50 bg-gradient-to-b from-zinc-800 to-zinc-900 px-4 py-1 shadow-chip ring-1 ring-white/5"
            >
              <ChipStack />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {p.label}
              </span>
              <span className="text-xs font-bold text-chip-gold">{p.amount}</span>
            </div>
          ))}
          <span className="text-[10px] font-medium text-white/50">Total {pot}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-full border border-chip-gold/20 bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 px-5 py-1.5 shadow-glass ring-1 ring-white/5">
          <ChipStack size="md" />
          <span className="text-base font-black tracking-wide text-chip-gold">{pot}</span>
        </div>
      )}
      {currentBet > 0 && (
        <span className="text-xs font-medium text-white/70">To call: ${currentBet}</span>
      )}
    </div>
  );
}

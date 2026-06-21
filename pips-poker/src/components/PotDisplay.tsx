// Prominent pot-total readout shown above/around the community board, plus
// the current bet-to-call amount, matching PokerNow's center-of-table pot
// chip stack + label pattern. When players are all-in for different amounts
// the pot splits into a main pot + side pots, each shown on its own chip so
// nobody has to do the side-pot math by hand.

export interface PotChip {
  amount: number;
  label: string;
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
    <div className="flex flex-col items-center gap-1">
      {hasSidePots ? (
        <div className="flex flex-col items-center gap-1">
          {pots!.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md bg-zinc-800/95 px-4 py-1 ring-1 ring-black/40"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {p.label}
              </span>
              <span className="text-xs font-bold text-white">{p.amount}</span>
            </div>
          ))}
          <span className="text-[10px] font-medium text-white/50">Total {pot}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-zinc-800/95 px-5 py-1.5 ring-1 ring-black/40">
          <span className="text-base font-bold tracking-wide text-white">{pot}</span>
        </div>
      )}
      {currentBet > 0 && (
        <span className="text-xs font-medium text-white/70">To call: ${currentBet}</span>
      )}
    </div>
  );
}

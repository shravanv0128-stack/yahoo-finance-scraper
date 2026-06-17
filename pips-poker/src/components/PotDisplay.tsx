// Prominent pot-total readout shown above/around the community board, plus
// the current bet-to-call amount, matching PokerNow's center-of-table pot
// chip stack + label pattern.

export function PotDisplay({ pot, currentBet }: { pot: number; currentBet: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 rounded-full bg-black/50 px-5 py-1.5 shadow-lg ring-1 ring-chip-gold/40">
        <span className="h-3 w-3 rounded-full bg-chip-gold" />
        <span className="text-sm font-bold tracking-wide text-chip-gold">POT ${pot}</span>
      </div>
      {currentBet > 0 && (
        <span className="text-xs font-medium text-white/70">To call: ${currentBet}</span>
      )}
    </div>
  );
}

"use client";

export function RunItTwicePrompt({
  disabled,
  hasVoted,
  votesIn,
  votesNeeded,
  onChoose,
}: {
  disabled: boolean;
  hasVoted: boolean;
  votesIn: number;
  votesNeeded: number;
  onChoose: (runTwice: boolean) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-black/50 bg-zinc-900 px-4 py-3 text-center shadow-xl">
      <p className="text-xs text-white/80">
        Everyone's all-in. Run it twice to split the pot 50/50 across two boards, needs everyone to
        agree; one "run it once" vote settles it now.
      </p>
      {hasVoted ? (
        <p className="text-center text-xs italic text-white/60">
          Waiting on the rest of the table ({votesIn}/{votesNeeded} agreed to run it twice)...
        </p>
      ) : (
        <div className="flex gap-3">
          <button
            disabled={disabled}
            onClick={() => onChoose(false)}
            className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Run it once
          </button>
          <button
            disabled={disabled}
            onClick={() => onChoose(true)}
            className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark transition hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Run it twice
          </button>
        </div>
      )}
    </div>
  );
}

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
    <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-chip-gold/40 bg-felt p-4">
      <p className="text-center text-sm font-semibold text-white">
        Everyone's all-in. Run it twice splits the pot 50/50 between two boards - it only happens if
        every player agrees; one "run it once" vote settles it immediately.
      </p>
      {hasVoted ? (
        <p className="text-center text-xs italic text-felt-light/70">
          Waiting on the rest of the table ({votesIn}/{votesNeeded} agreed to run it twice)...
        </p>
      ) : (
        <div className="flex gap-3">
          <button
            disabled={disabled}
            onClick={() => onChoose(false)}
            className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Run it once
          </button>
          <button
            disabled={disabled}
            onClick={() => onChoose(true)}
            className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark disabled:opacity-40"
          >
            Run it twice
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import type { ShowDecision } from "@/lib/types";

export function ShowMuckPrompt({
  disabled,
  onChoose,
}: {
  disabled: boolean;
  onChoose: (decision: ShowDecision) => void;
}) {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-chip-gold/40 bg-felt p-4">
      <p className="text-center text-sm font-semibold text-white">
        Want to show your cards, or keep them mucked?
      </p>
      <div className="flex gap-3">
        <button
          disabled={disabled}
          onClick={() => onChoose("muck")}
          className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Keep mucked
        </button>
        <button
          disabled={disabled}
          onClick={() => onChoose("show")}
          className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark disabled:opacity-40"
        >
          Show cards
        </button>
      </div>
    </div>
  );
}

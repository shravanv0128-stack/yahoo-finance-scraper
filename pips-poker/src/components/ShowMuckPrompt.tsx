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
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-chip-gold/20 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-3 shadow-rail">
      <p className="text-center text-sm font-semibold text-white">
        Want to show your cards, or keep them mucked?
      </p>
      <div className="flex gap-3">
        <button
          disabled={disabled}
          onClick={() => onChoose("muck")}
          className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
        >
          Keep mucked
        </button>
        <button
          disabled={disabled}
          onClick={() => onChoose("show")}
          className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark transition hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
        >
          Show cards
        </button>
      </div>
    </div>
  );
}

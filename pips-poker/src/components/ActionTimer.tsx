"use client";

import { useEffect, useState } from "react";

// Visual-only countdown derived from game_state.act_deadline. The actual
// timeout enforcement (auto-fold/auto-check) happens server-side, lazily,
// the next time anyone polls GET /api/rooms/:roomId/state - this is purely
// so players can see how much time is left.
export function ActionTimer({ deadline }: { deadline: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  if (secondsLeft === null) return null;

  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
        secondsLeft <= 10 ? "bg-chip-red text-white" : "bg-slate-700 text-white"
      }`}
    >
      {secondsLeft}s
    </span>
  );
}

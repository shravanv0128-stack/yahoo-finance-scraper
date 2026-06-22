"use client";

import { useEffect, useState } from "react";

// A thin countdown bar, sized to match the card row above it, that drains
// from full to empty as the acting player's clock runs out - much easier to
// catch out of the corner of your eye than a small number in the header.
export function TurnTimerBar({
  deadline,
  totalSeconds,
  paused = false,
}: {
  deadline: string | null;
  totalSeconds: number;
  paused?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline || paused) {
      return;
    }
    const update = () => {
      const remaining = Math.max(0, (new Date(deadline).getTime() - Date.now()) / 1000);
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [deadline, paused]);

  if (secondsLeft === null && !paused) return null;

  // While paused, freeze the bar at whatever it last showed (instead of
  // continuing to drain) and swap in a clear "Paused" label so it's obvious
  // the clock isn't actually running out.
  if (paused) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50 shadow-inner">
          <div className="h-full rounded-full bg-gradient-to-r from-yellow-500/70 to-yellow-300/70" style={{ width: "100%" }} />
        </div>
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-yellow-300">
          Paused
        </span>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, ((secondsLeft ?? 0) / totalSeconds) * 100));
  const isLow = (secondsLeft ?? 0) <= 10;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50 shadow-inner">
      <div
        className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
          isLow
            ? "bg-gradient-to-r from-red-600 to-chip-red shadow-[0_0_6px_2px_rgba(224,71,62,0.7)]"
            : "bg-gradient-to-r from-sky-500 to-chip-blue shadow-[0_0_6px_2px_rgba(56,189,248,0.8)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

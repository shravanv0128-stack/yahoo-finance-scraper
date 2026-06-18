"use client";

import { useEffect, useState } from "react";

// A thin countdown bar, sized to match the card row above it, that drains
// from full to empty as the acting player's clock runs out - much easier to
// catch out of the corner of your eye than a small number in the header.
export function TurnTimerBar({ deadline, totalSeconds }: { deadline: string | null; totalSeconds: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, (new Date(deadline).getTime() - Date.now()) / 1000);
      setSecondsLeft(remaining);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [deadline]);

  if (secondsLeft === null) return null;

  const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const isLow = secondsLeft <= 10;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50">
      <div
        className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
          isLow ? "bg-chip-red" : "bg-chip-blue shadow-[0_0_6px_2px_rgba(56,189,248,0.8)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

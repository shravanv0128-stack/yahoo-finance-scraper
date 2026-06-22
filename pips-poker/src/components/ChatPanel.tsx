"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomChatMessage } from "@/hooks/useRoomRealtime";

export interface ChatPanelProps {
  messages: RoomChatMessage[];
  myUserId: string | null;
  disabled: boolean;
  onSend: (message: string) => void;
}

// Distinct, high-contrast colors cycled per-player (by user_id) so every
// name in the chat is visually distinguishable at a glance.
const NAME_COLORS = [
  "text-pink-400",
  "text-sky-400",
  "text-amber-400",
  "text-violet-400",
  "text-lime-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
];

function nameColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

// Bottom-left docked chat: a fixed-height scrollable message list (showing
// roughly the last few messages at a time, with the rest reachable by
// scrolling up) plus a single-line input. Sits next to (not stacked above)
// the action bar - see the bottom dock in src/app/room/[code]/page.tsx.
export function ChatPanel({ messages, myUserId, disabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <div className="flex h-40 w-full flex-col rounded-lg border border-black/40 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-inner sm:h-auto sm:w-64">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && <p className="text-xs text-white/30">No messages yet.</p>}
        {messages.map((m) => (
          <p key={m.id} className="text-xs leading-snug text-white/80">
            <span className={`font-semibold ${m.user_id === myUserId ? "text-yellow-300" : nameColor(m.user_id)}`}>
              {m.display_name}:
            </span>{" "}
            <span className="break-words">{m.message}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-1 border-t border-black/40 p-2">
        <input
          type="text"
          value={draft}
          disabled={disabled}
          maxLength={500}
          placeholder="Say something..."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          className="min-w-0 flex-1 rounded border border-white/20 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder:text-white/30 transition focus:border-chip-gold/50 focus:outline-none disabled:opacity-40"
        />
        <button
          disabled={disabled || !draft.trim()}
          onClick={send}
          className="rounded bg-gradient-to-b from-yellow-300 to-chip-gold px-3 py-1.5 text-xs font-bold text-black transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

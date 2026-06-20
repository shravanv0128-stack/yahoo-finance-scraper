"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomChatMessage } from "@/hooks/useRoomRealtime";

export interface ChatPanelProps {
  messages: RoomChatMessage[];
  myUserId: string | null;
  disabled: boolean;
  onSend: (message: string) => void;
}

// Rolling window: only the most recent messages are ever shown, so the chat
// panel never grows the page no matter how long the conversation gets.
const VISIBLE_MESSAGES = 4;

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

// Bottom-left docked chat: a fixed-size scrollable message list plus a
// single-line input, styled with a distinct indigo tint so it stands out
// from the rest of the dark/neon table theme. Sits next to (not stacked
// above) the action bar - see the bottom dock in src/app/room/[code]/page.tsx.
export function ChatPanel({ messages, myUserId, disabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const visible = messages.slice(-VISIBLE_MESSAGES);

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
    <div className="flex h-40 w-full flex-col rounded-lg border border-indigo-400/50 bg-indigo-950/70 shadow-[0_0_16px_2px_rgba(99,102,241,0.25)] sm:h-auto sm:w-64">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visible.length === 0 && <p className="text-xs text-white/30">No messages yet.</p>}
        {visible.map((m) => (
          <p key={m.id} className="text-xs leading-snug text-white/80">
            <span className={`font-semibold ${m.user_id === myUserId ? "text-neon" : nameColor(m.user_id)}`}>
              {m.display_name}:
            </span>{" "}
            <span className="break-words">{m.message}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-1 border-t border-indigo-400/20 p-2">
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
          className="min-w-0 flex-1 rounded border border-white/20 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-white/30 disabled:opacity-40"
        />
        <button
          disabled={disabled || !draft.trim()}
          onClick={send}
          className="rounded bg-neon px-3 py-1.5 text-xs font-bold text-felt-dark disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomChatMessage } from "@/hooks/useRoomRealtime";

export interface ChatPanelProps {
  messages: RoomChatMessage[];
  myUserId: string | null;
  disabled: boolean;
  onSend: (message: string) => void;
}

// Bottom-left docked chat: a fixed-size scrollable message list plus a
// single-line input, styled to match the dark neon table theme. Sits next
// to (not stacked above) the action bar - see the bottom dock in
// src/app/room/[code]/page.tsx.
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
    <div className="flex h-40 w-full flex-col rounded-lg border border-neon/30 bg-black/60 sm:h-auto sm:w-64">
      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && <p className="text-xs text-white/30">No messages yet.</p>}
        {messages.map((m) => (
          <p key={m.id} className="text-xs leading-snug text-white/80">
            <span className={`font-semibold ${m.user_id === myUserId ? "text-neon" : "text-chip-gold"}`}>
              {m.display_name}:
            </span>{" "}
            <span className="break-words">{m.message}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-1 border-t border-white/10 p-2">
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

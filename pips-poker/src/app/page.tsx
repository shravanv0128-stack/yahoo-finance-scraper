"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureSession } from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function authedFetch(url: string, body: unknown) {
    const session = await ensureSession();
    const token = session?.access_token;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const data = await authedFetch("/api/rooms/create", {
        name: name || "Pips Poker Table",
        displayName,
      });
      router.push(`/room/${data.room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setError(null);
    setBusy(true);
    try {
      const data = await authedFetch("/api/rooms/join", { code: joinCode, displayName });
      router.push(`/room/${data.room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-chip-gold">Pips Poker</h1>
        <p className="mt-2 max-w-md text-sm text-felt-light">
          Half the pot goes to the best poker hand. Half goes to whoever holds the highest pip
          total in their 3 hole cards. Two ways to win every hand.
        </p>
      </div>

      {error && (
        <p className="rounded bg-chip-red/20 px-4 py-2 text-sm text-chip-red">{error}</p>
      )}

      <div className="w-full max-w-sm rounded-lg border border-felt-light bg-felt p-6 shadow-table">
        <label className="mb-1 block text-xs uppercase tracking-wide text-felt-light">
          Your display name
        </label>
        <input
          className="mb-4 w-full rounded border border-felt-light bg-felt-dark px-3 py-2 text-sm text-white"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Ada"
        />

        <h2 className="mb-2 text-sm font-semibold text-white">Create a room</h2>
        <input
          className="mb-2 w-full rounded border border-felt-light bg-felt-dark px-3 py-2 text-sm text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Table name"
        />
        <button
          onClick={createRoom}
          disabled={busy || !displayName}
          className="mb-6 w-full rounded bg-chip-gold px-3 py-2 text-sm font-semibold text-felt-dark disabled:opacity-50"
        >
          Create room
        </button>

        <h2 className="mb-2 text-sm font-semibold text-white">Join a room</h2>
        <input
          className="mb-2 w-full rounded border border-felt-light bg-felt-dark px-3 py-2 text-sm text-white"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Room code, e.g. ABCD12"
        />
        <button
          onClick={joinRoom}
          disabled={busy || !displayName || !joinCode}
          className="w-full rounded bg-chip-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Join room
        </button>
      </div>
    </main>
  );
}

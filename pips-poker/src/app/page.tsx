"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, getSession, signInWithGoogle, signOut } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [anteAmount, setAnteAmount] = useState("0.5");
  const [startingStack, setStartingStack] = useState("1000");
  const [maxPlayers, setMaxPlayers] = useState("8");
  const [actTimeoutSeconds, setActTimeoutSeconds] = useState("60");
  const [allowRunItTwice, setAllowRunItTwice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setSessionLoaded(true);
      if (s?.user) {
        setDisplayName((current) => current || s.user.user_metadata?.full_name || s.user.email || "");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setDisplayName((current) => current || s.user.user_metadata?.full_name || s.user.email || "");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function authedFetch(url: string, body: unknown) {
    const token = session?.access_token;
    if (!token) throw new Error("Sign in with Google first");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
        anteAmount: Number(anteAmount) || undefined,
        startingStack: Number(startingStack) || undefined,
        maxPlayers: Number(maxPlayers) || undefined,
        actTimeoutSeconds: Number(actTimeoutSeconds) || undefined,
        allowRunItTwice,
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
        <p className="mt-2 max-w-md text-sm text-white/70">
          Half the pot goes to the best poker hand. Half goes to whoever holds the highest pip
          total in their 3 hole cards. Two ways to win every hand.
        </p>
      </div>

      {error && (
        <p className="rounded bg-chip-red/20 px-4 py-2 text-sm text-chip-red">{error}</p>
      )}

      {sessionLoaded && !session && (
        <button
          onClick={() => signInWithGoogle()}
          className="rounded bg-white px-6 py-3 text-sm font-semibold text-felt-dark shadow"
        >
          Sign in with Google
        </button>
      )}

      {session && (
        <div className="w-full max-w-sm rounded-lg border border-black/50 bg-zinc-900 p-6 shadow-table">
          <div className="mb-4 flex items-center justify-between text-xs text-white/60">
            <span>Signed in as {session.user.email}</span>
            <button onClick={() => signOut()} className="text-white underline">
              Sign out
            </button>
          </div>

          <label className="mb-1 block text-xs uppercase tracking-wide text-white/60">
            Your display name
          </label>
          <input
            className="mb-4 w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Ada"
          />

          <h2 className="mb-2 text-sm font-semibold text-white">Create a room</h2>
          <input
            className="mb-2 w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table name"
          />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/60">
                Bomb pot (per hand)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
                value={anteAmount}
                onChange={(e) => setAnteAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/60">
                Starting stack
              </label>
              <input
                type="number"
                step="1"
                min="1"
                className="w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
                value={startingStack}
                onChange={(e) => setStartingStack(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/60">
                Max players (2–8)
              </label>
              <input
                type="number"
                step="1"
                min="2"
                max="8"
                className="w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/60">
                Turn timer (sec)
              </label>
              <input
                type="number"
                step="5"
                min="10"
                max="300"
                className="w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
                value={actTimeoutSeconds}
                onChange={(e) => setActTimeoutSeconds(e.target.value)}
              />
            </div>
          </div>
          <label className="mb-2 flex items-center gap-2 text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={allowRunItTwice}
              onChange={(e) => setAllowRunItTwice(e.target.checked)}
              className="h-3.5 w-3.5 accent-chip-gold"
            />
            Allow running it twice when everyone&apos;s all-in
          </label>
          <p className="mb-2 text-[11px] text-white/50">
            Every player puts in the bomb pot each hand — no blinds. Bets are plain dollar amounts; the
            most you can ever bet or raise is the size of the pot.
          </p>
          <button
            onClick={createRoom}
            disabled={busy || !displayName}
            className="mb-6 w-full rounded bg-chip-gold px-3 py-2 text-sm font-semibold text-felt-dark disabled:opacity-50"
          >
            Create room
          </button>

          <h2 className="mb-2 text-sm font-semibold text-white">Join a room</h2>
          <input
            className="mb-2 w-full rounded border border-black/40 bg-zinc-800 px-3 py-2 text-sm text-white"
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
      )}
    </main>
  );
}

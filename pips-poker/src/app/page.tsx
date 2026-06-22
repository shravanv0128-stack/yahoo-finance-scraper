"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, getSession, signInWithGoogle, signOut } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Spinner } from "@/components/Spinner";

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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Decorative scattered suit glyphs */}
      <div className="pointer-events-none fixed inset-0 select-none overflow-hidden" aria-hidden>
        {[
          { s: "♠", x: "8%",  y: "12%", size: "7rem",  op: "0.05", rot: "-15deg" },
          { s: "♥", x: "88%", y: "8%",  size: "9rem",  op: "0.055", rot: "12deg" },
          { s: "♣", x: "4%",  y: "70%", size: "8rem",  op: "0.045", rot: "-8deg" },
          { s: "♦", x: "90%", y: "72%", size: "7.5rem",op: "0.05", rot: "20deg" },
          { s: "♠", x: "50%", y: "5%",  size: "5rem",  op: "0.04", rot: "5deg" },
          { s: "♥", x: "22%", y: "85%", size: "6rem",  op: "0.04", rot: "-5deg" },
          { s: "♦", x: "74%", y: "45%", size: "5.5rem",op: "0.035",rot: "18deg" },
        ].map((d, i) => (
          <span
            key={i}
            className="absolute font-bold leading-none"
            style={{
              left: d.x, top: d.y,
              fontSize: d.size,
              opacity: d.op,
              transform: `rotate(${d.rot}) translate(-50%, -50%)`,
              color: d.s === "♥" || d.s === "♦" ? "#e0473e" : "#f3c34d",
            }}
          >
            {d.s}
          </span>
        ))}
      </div>

      {/* Hero */}
      <div className="relative z-10 mb-8 text-center animate-slideup">
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="text-4xl opacity-70">♠</span>
          <h1 className="text-glow-gold text-6xl font-black tracking-tight text-chip-gold">
            PIPS
          </h1>
          <span className="text-3xl text-chip-red opacity-80">♥</span>
          <h1 className="text-glow-gold text-6xl font-black tracking-tight text-chip-gold">
            POKER
          </h1>
        </div>
        <div className="mx-auto mb-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-chip-gold/40" />
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-chip-gold/60">
            Two ways to win every hand
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-chip-gold/40" />
        </div>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
          Half the pot to the best poker hand. Half to the highest pip total.
          Bomb pot format, pot-limit, no blinds.
        </p>
      </div>

      {error && (
        <div className="relative z-10 mb-4 flex items-center gap-2 rounded-lg border border-chip-red/30 bg-chip-red/10 px-4 py-2.5 text-sm text-chip-red backdrop-blur-sm">
          <span className="text-base">⚠</span>
          {error}
        </div>
      )}

      {sessionLoaded && !session && (
        <div className="relative z-10 animate-slideup text-center">
          <button
            onClick={() => signInWithGoogle()}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-xl bg-white px-8 py-4 text-sm font-bold text-gray-900 shadow-glass transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
          <p className="mt-4 text-xs text-white/30">No account needed beyond your Google login</p>
        </div>
      )}

      {session && (
        <div className="relative z-10 w-full max-w-md animate-slideup">
          {/* Glass panel */}
          <div className="rounded-2xl border border-white/8 bg-zinc-900/80 shadow-glass backdrop-blur-md">
            {/* Header strip */}
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
              <span className="text-xs text-white/50">{session.user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-white/40 transition hover:text-white/70 underline underline-offset-2"
              >
                Sign out
              </button>
            </div>

            <div className="p-5">
              {/* Display name */}
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-chip-gold/70">
                Your name at the table
              </label>
              <input
                className="mb-5 w-full rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2.5 text-sm text-white placeholder-white/25 transition focus:border-chip-gold/50 focus:outline-none focus:ring-1 focus:ring-chip-gold/30"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ada"
              />

              {/* Create section */}
              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/8" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Create a room</span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>

                <input
                  className="mb-3 w-full rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2.5 text-sm text-white placeholder-white/25 transition focus:border-chip-gold/50 focus:outline-none focus:ring-1 focus:ring-chip-gold/30"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Table name (optional)"
                />

                <div className="mb-3 grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Bomb pot", key: "ante", val: anteAmount, set: setAnteAmount, type: "number", step: "0.01", min: "0" },
                    { label: "Starting stack", key: "stack", val: startingStack, set: setStartingStack, type: "number", step: "1", min: "1" },
                    { label: "Max players (2–8)", key: "max", val: maxPlayers, set: setMaxPlayers, type: "number", step: "1", min: "2", max: "8" },
                    { label: "Turn timer (sec)", key: "timer", val: actTimeoutSeconds, set: setActTimeoutSeconds, type: "number", step: "5", min: "10", max: "300" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/45">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        step={f.step}
                        min={f.min}
                        max={"max" in f ? f.max : undefined}
                        className="w-full rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-chip-gold/50 focus:outline-none focus:ring-1 focus:ring-chip-gold/30"
                        value={f.val}
                        onChange={(e) => f.set(e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-[11px] text-white/60">
                  <div
                    className={`relative h-4 w-7 flex-shrink-0 rounded-full transition-colors duration-200 ${allowRunItTwice ? "bg-chip-gold" : "bg-zinc-700"}`}
                    onClick={() => setAllowRunItTwice((v) => !v)}
                  >
                    <div
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${allowRunItTwice ? "translate-x-3.5" : "translate-x-0.5"}`}
                    />
                  </div>
                  Allow running it twice when everyone&apos;s all-in
                </label>

                <p className="mb-3 text-[10px] leading-relaxed text-white/35">
                  Every player puts in the bomb pot each hand, no blinds. Bets are dollar amounts; max bet is the pot.
                </p>

                <button
                  onClick={createRoom}
                  disabled={busy || !displayName}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-chip-gold px-4 py-3 text-sm font-bold text-felt-dark shadow-btn-allin transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy && <Spinner />}
                  {busy ? "Creating..." : "Create room"}
                </button>
              </div>

              {/* Join section */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/8" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Join a room</span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>

                <input
                  className="mb-3 w-full rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2.5 text-center text-base font-bold tracking-[0.25em] text-white placeholder-white/20 uppercase transition focus:border-chip-gold/50 focus:outline-none focus:ring-1 focus:ring-chip-gold/30"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={8}
                />

                <button
                  onClick={joinRoom}
                  disabled={busy || !displayName || !joinCode}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-zinc-800/60 px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-chip-gold/40 hover:bg-zinc-700/60 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy && <Spinner />}
                  {busy ? "Joining..." : "Join room"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

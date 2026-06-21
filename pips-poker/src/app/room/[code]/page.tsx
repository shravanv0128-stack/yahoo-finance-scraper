"use client";

// The live table screen for a room. Named [code] per the route the home
// page links to (room.id is passed as this segment); it is treated purely
// as the room identifier for /api/rooms/:roomId/* calls.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, getSession, signInWithGoogle } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { Table, type TableSeatData } from "@/components/Table";
import { BettingControls } from "@/components/BettingControls";
import { DrawSwapControls } from "@/components/DrawSwapControls";
import { ShowdownSummary, type ShowdownPlayerSummary } from "@/components/ShowdownSummary";
import { LedgerPanel } from "@/components/LedgerPanel";
import { RunItTwicePrompt } from "@/components/RunItTwicePrompt";
import { ShowMuckPrompt } from "@/components/ShowMuckPrompt";
import { ChatPanel } from "@/components/ChatPanel";
import type { BettingAction, ShowDecision, ShowdownResult, GameMode, RotationMode } from "@/lib/types";

const BETTING_PHASES = new Set(["preflop_betting", "flop_betting", "turn_betting", "river_betting"]);

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const roomId = params.code;
  const { data, error, loading, refresh } = useRoomRealtime(roomId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showKick, setShowKick] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [smallBlindInput, setSmallBlindInput] = useState("");
  const [bigBlindInput, setBigBlindInput] = useState("");
  const [pipsIntervalInput, setPipsIntervalInput] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

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

  // The next hand is dealt automatically by the server a few seconds after a
  // hand completes (see the room state GET route), so no client timer is
  // needed for that. The run-it-twice reveal (board 1's cards flipping
  // before board 2's) is staged entirely inside ShowdownSummary, on a single
  // combined timeline, so the two boards can never race or interleave.

  // The showdown summary is shown as an overlay on top of the table rather
  // than pushed into the page flow, so it never forces a scroll. It's kept
  // mounted for a moment after the hand moves on (next hand auto-deals) so
  // it can fade out smoothly instead of disappearing the instant the phase
  // flips - the snapshot freezes its content while that fade plays out.
  const [showdownSnapshot, setShowdownSnapshot] = useState<{
    result: ShowdownResult | null;
    handId: string | number | null;
    players: ShowdownPlayerSummary[];
  } | null>(null);
  const [showdownVisible, setShowdownVisible] = useState(false);
  useEffect(() => {
    const gs = data?.gameState;
    if (gs?.phase === "hand_complete") {
      setShowdownSnapshot({
        result: gs.showdown_result,
        handId: gs.hand_id,
        players: handPlayers.map((hp) => ({
          seat: hp.seat,
          displayName: hp.display_name,
          chipStack: hp.chip_stack,
          revealedCards: hp.revealed_cards,
          revealedPipTotal: hp.revealed_pip_total,
          folded: hp.status === "folded",
          amountWon: hp.amount_won,
          mucked: hp.mucked,
        })),
      });
      setShowdownVisible(true);
    } else {
      setShowdownVisible(false);
      const t = setTimeout(() => setShowdownSnapshot(null), 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.gameState?.phase, data?.gameState?.hand_id]);

  // If the room leader removes us from the table, our own player row flips
  // to is_active=false on the next poll - send us back to the home page
  // (create/join-by-code) rather than leaving us stuck looking at a table
  // we're no longer part of.
  useEffect(() => {
    if (!data) return;
    const me = data.players.find((p) => p.user_id === data.myUserId);
    if (me && !me.is_active) {
      router.push("/");
    }
  }, [data, router]);

  async function authedFetch(url: string, body: unknown) {
    const token = session?.access_token;
    if (!token) throw new Error("Sign in with Google first");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function handleJoin() {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/join`, { code: roomId, displayName });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/hands/start`, { roomId });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to start hand");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: BettingAction, amount: number) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/hands/action`, { roomId, action, amount });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwap(discardIndices: number[]) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/hands/swap`, { roomId, discardIndices });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRunTwice(runTwice: boolean) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/hands/run-twice`, { roomId, runTwice });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to resolve run-it-twice");
    } finally {
      setBusy(false);
    }
  }

  async function handleShowDecision(decision: ShowDecision) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/hands/show`, { roomId, decision });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to submit show/muck decision");
    } finally {
      setBusy(false);
    }
  }

  async function handleLedgerAdjust(playerId: string, delta: number) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/ledger`, { roomId, playerId, delta });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to adjust stack");
    } finally {
      setBusy(false);
    }
  }

  async function handleRebuy(amount: number) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/rebuy`, { roomId, amount });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to buy back in");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferLeader(toUserId: string) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/transfer-leader`, { roomId, toUserId });
      setShowTransfer(false);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to transfer leadership");
    } finally {
      setBusy(false);
    }
  }

  async function handleKick(playerId: string) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/kick`, { roomId, playerId });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove player");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetGameMode(gameMode: GameMode) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/set-game-mode`, { roomId, gameMode });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to set game mode");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateSettings(updates: {
    smallBlind?: number;
    bigBlind?: number;
    rotationMode?: RotationMode;
    pipsInterval?: number;
  }) {
    setSettingsError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/settings`, { roomId, ...updates });
      await refresh();
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAway(away: boolean) {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/players/away`, { roomId, away });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update away status");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-felt-dark text-white">
        Loading table...
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-felt-dark text-white">
        <p className="text-chip-red">{error}</p>
      </main>
    );
  }

  async function handleSendChat(message: string) {
    try {
      await authedFetch(`/api/rooms/chat`, { roomId, message });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to send message");
    }
  }

  if (!data) return null;

  const { room, players, gameState, handPlayers, myHoleCards, myUserId, chatMessages, handHistory } = data;
  const myPlayer = players.find((p) => p.user_id === myUserId);
  const amSeated = !!myPlayer;

  const hpBySeat = new Map(handPlayers.map((hp) => [hp.seat, hp]));
  const isHandLive = !!gameState?.hand_id;

  // Busted (chip_stack <= 0) players stay seated so they can rebuy, but once
  // there's no live hand to show their showdown result in, they drop off the
  // felt entirely until they buy back in - matching "only people with money
  // are still in" for the waiting-room view.
  const activePlayers = players.filter((p) => p.is_active);
  const visiblePlayers = isHandLive ? activePlayers : activePlayers.filter((p) => p.chip_stack > 0);
  const eligiblePlayers = players.filter((p) => p.is_active && !p.is_away && p.chip_stack > 0);

  const seats: TableSeatData[] = visiblePlayers.map((p) => {
    const hp = hpBySeat.get(p.seat);
    const isMe = p.user_id === myUserId;
    return {
      seat: p.seat,
      displayName: p.display_name,
      chipStack: hp ? hp.chip_stack : p.chip_stack,
      currentBet: hp?.current_bet ?? 0,
      status: hp?.status ?? "sitting_out",
      isActingSeat: isHandLive && gameState?.active_seat === p.seat,
      isMe,
      holeCards: isMe ? myHoleCards : hp ? [null, null, null].map(() => null) as any : null,
      revealedCards: hp?.revealed_cards ?? null,
      revealedPipTotal: hp?.revealed_pip_total ?? null,
      swappedCount: hp?.has_swapped ? hp.swapped_count ?? 0 : null,
    };
  });

  const myHandPlayer = myPlayer ? handPlayers.find((hp) => hp.seat === myPlayer.seat) : undefined;
  const isMyTurn =
    isHandLive && myPlayer != null && gameState?.active_seat === myPlayer.seat && myHandPlayer?.status === "active";
  const isBettingPhase = gameState ? BETTING_PHASES.has(gameState.phase) : false;
  const isSwapPhase = gameState?.phase === "draw_swap";
  const toCall = myHandPlayer ? Math.max(0, (gameState?.current_bet ?? 0) - myHandPlayer.current_bet) : 0;
  const isRunTwicePending = gameState?.awaiting_run_it_twice ?? false;
  // After a hand is complete, anyone who didn't win (and didn't fold) can
  // optionally reveal their cards for show - purely cosmetic, doesn't
  // affect the payout, which already happened automatically.
  const canOfferShow =
    gameState?.phase === "hand_complete" &&
    myHandPlayer != null &&
    myHandPlayer.status !== "folded" &&
    myHandPlayer.mucked &&
    !myHandPlayer.has_decided_show;
  const leaderId = room.leader_id ?? room.created_by;
  const isLeader = !!myUserId && leaderId === myUserId;
  const amInLiveHand = isHandLive && myHandPlayer && myHandPlayer.status !== "folded";
  const canStartHand = !isHandLive || gameState?.phase === "hand_complete";
  const iBusted = amSeated && (myPlayer?.chip_stack ?? 0) <= 0;
  const transferTargets = activePlayers.filter((p) => p.user_id !== leaderId);
  const kickTargets = activePlayers.filter((p) => p.user_id !== leaderId);

  const currentGameMode: GameMode = gameState?.game_mode ?? "pips";
  const rotationMode: RotationMode = room.rotation_mode ?? "dealer_choice";
  const pipsInterval = room.pips_interval ?? 5;
  const pendingGameMode = gameState?.pending_game_mode ?? null;
  // Between hands and only relevant when the leader picks the mode each hand;
  // otherwise the rotation (every_x) determines it automatically and there's
  // nothing to choose.
  const showGameModePicker = canStartHand && rotationMode === "dealer_choice";
  let nextHandLabel: string | null = null;
  if (canStartHand) {
    if (rotationMode === "dealer_choice") {
      nextHandLabel = pendingGameMode === "holdem" ? "Texas Hold'em" : pendingGameMode === "pips" ? "Pips Poker" : null;
    } else {
      // every_x: hand_number isn't directly available client-side, so we
      // can't precisely predict the next hand's mode without it; fall back
      // to not showing a prediction in that case rather than guessing wrong.
      nextHandLabel = null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-felt-dark">
      <header className="flex items-center justify-between border-b border-neon/15 bg-black/60 px-4 py-3 text-white backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <span className="text-xl font-black tracking-wider text-neon drop-shadow-[0_0_8px_rgba(57,255,140,0.7)]">
            PIPS
          </span>
          <div className="flex items-center gap-5 text-[11px]">
            <div>
              <p className="text-white/40">ROOM</p>
              <p className="font-mono font-bold text-white">{room.code}</p>
            </div>
            <div>
              <p className="text-white/40">GAME</p>
              <p className="font-bold text-white">
                {currentGameMode === "holdem" ? "TEXAS HOLD'EM" : "PIPS POKER"}
              </p>
            </div>
            <div>
              <p className="text-white/40">PHASE</p>
              <p className="font-bold uppercase text-white">{gameState?.phase ?? "waiting room"}</p>
            </div>
            {nextHandLabel && (
              <div>
                <p className="text-white/40">NEXT HAND</p>
                <p className="font-bold text-white">{nextHandLabel}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              showSettings
                ? "border-neon bg-neon text-felt-dark shadow-neon"
                : "border-white/15 bg-black/40 text-white hover:border-neon/50"
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              showHistory
                ? "border-neon bg-neon text-felt-dark shadow-neon"
                : "border-white/15 bg-black/40 text-white hover:border-neon/50"
            }`}
          >
            History
          </button>
          <button
            onClick={() => setShowLedger((v) => !v)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              showLedger
                ? "border-neon bg-neon text-felt-dark shadow-neon"
                : "border-white/15 bg-black/40 text-white hover:border-neon/50"
            }`}
          >
            Ledger
          </button>
          {amSeated && canStartHand && (
            <button
              onClick={() => handleToggleAway(!myPlayer?.is_away)}
              disabled={busy}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                myPlayer?.is_away
                  ? "border-neon bg-neon text-felt-dark shadow-neon"
                  : "border-white/15 bg-black/40 text-white hover:border-neon/50"
              }`}
            >
              {myPlayer?.is_away ? "I'm back" : "I'm away"}
            </button>
          )}
          {amSeated && canStartHand && (
            <button
              onClick={handleStart}
              disabled={busy || eligiblePlayers.length < 2}
              className="rounded-full bg-neon px-4 py-2 text-sm font-bold text-felt-dark shadow-neon transition disabled:opacity-40"
            >
              Start hand
            </button>
          )}
          {isLeader && transferTargets.length > 0 && (
            <button
              onClick={() => setShowTransfer((v) => !v)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                showTransfer
                  ? "border-neon bg-neon text-felt-dark shadow-neon"
                  : "border-white/15 bg-black/40 text-white hover:border-neon/50"
              }`}
            >
              Transfer leadership
            </button>
          )}
          {isLeader && kickTargets.length > 0 && (
            <button
              onClick={() => setShowKick((v) => !v)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                showKick
                  ? "border-chip-red bg-chip-red text-white shadow-none"
                  : "border-white/15 bg-black/40 text-white hover:border-chip-red/50"
              }`}
            >
              Remove player
            </button>
          )}
        </div>
      </header>

      {showTransfer && isLeader && (
        <div className="mx-auto mt-2 flex w-full max-w-md flex-col gap-2 rounded-lg border border-neon/30 bg-black/60 p-3">
          <p className="text-center text-xs text-white/60">
            Hand host powers (ledger edits) to another seated player.
          </p>
          <div className="flex flex-col gap-1">
            {transferTargets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleTransferLeader(p.user_id)}
                disabled={busy}
                className="rounded border border-white/15 bg-felt-dark px-3 py-2 text-left text-sm text-white transition hover:border-neon/50 disabled:opacity-40"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showKick && isLeader && (
        <div className="mx-auto mt-2 flex w-full max-w-md flex-col gap-2 rounded-lg border border-chip-red/40 bg-black/60 p-3">
          <p className="text-center text-xs text-white/60">
            Remove a player from the table. They&apos;ll be sent back to the home page.
          </p>
          <div className="flex flex-col gap-1">
            {kickTargets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleKick(p.id)}
                disabled={busy}
                className="rounded border border-white/15 bg-felt-dark px-3 py-2 text-left text-sm text-white transition hover:border-chip-red disabled:opacity-40"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="mx-auto mt-2 flex w-full max-w-md flex-col gap-3 rounded-lg border border-neon/30 bg-black/60 p-3 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Game mode rotation</p>
            {isLeader ? (
              <div className="mt-1 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="rotationMode"
                    checked={rotationMode === "dealer_choice"}
                    disabled={busy}
                    onChange={() => handleUpdateSettings({ rotationMode: "dealer_choice" })}
                  />
                  Dealer chooses game each hand
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="rotationMode"
                    checked={rotationMode === "every_x"}
                    disabled={busy}
                    onChange={() => handleUpdateSettings({ rotationMode: "every_x" })}
                  />
                  Play Pips every
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={pipsIntervalInput}
                    onChange={(e) => setPipsIntervalInput(e.target.value)}
                    onBlur={() => {
                      if (!pipsIntervalInput.trim()) return;
                      const parsed = Number(pipsIntervalInput);
                      if (!Number.isInteger(parsed) || parsed < 2) {
                        setSettingsError("Enter a valid hand interval.");
                        return;
                      }
                      handleUpdateSettings({ pipsInterval: parsed });
                    }}
                    placeholder={String(pipsInterval)}
                    disabled={busy}
                    className="w-16 rounded bg-felt-dark px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 focus:ring-neon disabled:opacity-40"
                  />
                  hands
                </label>
                {settingsError && <p className="text-xs text-chip-red">{settingsError}</p>}
              </div>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                {rotationMode === "dealer_choice"
                  ? "Dealer chooses game each hand"
                  : `Pips every ${pipsInterval} hands`}
              </p>
            )}
          </div>

          {showGameModePicker && (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">Next hand's game</p>
              {isLeader ? (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => handleSetGameMode("pips")}
                    disabled={busy}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                      pendingGameMode === "pips"
                        ? "border-neon bg-neon text-felt-dark shadow-neon"
                        : "border-white/15 bg-black/40 text-white hover:border-neon/50"
                    }`}
                  >
                    Pips Poker
                  </button>
                  <button
                    onClick={() => handleSetGameMode("holdem")}
                    disabled={busy}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                      pendingGameMode === "holdem"
                        ? "border-neon bg-neon text-felt-dark shadow-neon"
                        : "border-white/15 bg-black/40 text-white hover:border-neon/50"
                    }`}
                  >
                    Texas Hold'em
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-white/70">
                  {pendingGameMode === "holdem" ? "Texas Hold'em" : pendingGameMode === "pips" ? "Pips Poker" : "Not chosen yet"}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">Blinds (Hold'em)</p>
            {isLeader && canStartHand ? (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-white/60">SB</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={smallBlindInput}
                  onChange={(e) => setSmallBlindInput(e.target.value)}
                  onBlur={() => {
                    if (!smallBlindInput.trim()) return;
                    const parsed = Number(smallBlindInput);
                    if (Number.isFinite(parsed) && parsed > 0) handleUpdateSettings({ smallBlind: parsed });
                  }}
                  placeholder={String(room.small_blind ?? 1)}
                  disabled={busy}
                  className="w-16 rounded bg-felt-dark px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 focus:ring-neon disabled:opacity-40"
                />
                <span className="text-white/60">BB</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={bigBlindInput}
                  onChange={(e) => setBigBlindInput(e.target.value)}
                  onBlur={() => {
                    if (!bigBlindInput.trim()) return;
                    const parsed = Number(bigBlindInput);
                    if (Number.isFinite(parsed) && parsed > 0) handleUpdateSettings({ bigBlind: parsed });
                  }}
                  placeholder={String(room.big_blind ?? 2)}
                  disabled={busy}
                  className="w-16 rounded bg-felt-dark px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 focus:ring-neon disabled:opacity-40"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                {room.small_blind ?? 1} / {room.big_blind ?? 2}
              </p>
            )}
            {!canStartHand && isLeader && (
              <p className="mt-1 text-xs text-white/40">Settings lock while a hand is in progress.</p>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <p className="mx-auto mt-2 rounded bg-chip-red/20 px-4 py-1 text-sm text-chip-red">{actionError}</p>
      )}

      {showLedger && players.length > 0 && (
        <LedgerPanel
          players={players.map((p) => ({
            id: p.id,
            displayName: p.display_name,
            seat: p.seat,
            chipStack: p.chip_stack,
            buyIn: p.buy_in,
          }))}
          disabled={busy}
          canEdit={isLeader}
          onAdjust={handleLedgerAdjust}
        />
      )}

      {showHistory && (
        <div className="mx-auto mt-2 flex w-full max-w-md flex-col gap-2 rounded-lg border border-neon/30 bg-black/60 p-3 text-white">
          {handHistory.length === 0 ? (
            <p className="text-center text-xs text-white/50">No completed hands yet.</p>
          ) : (
            handHistory.map((h) => (
              <div key={h.handId} className="rounded border border-white/10 bg-felt-dark/60 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    Hand #{h.handNumber} - {h.gameMode === "holdem" ? "Texas Hold'em" : "Pips Poker"}
                  </span>
                  <span className="text-white/40">{h.dealerSeat != null ? `Dealer seat ${h.dealerSeat}` : ""}</span>
                </div>
                <p className="mt-1 text-white/60">
                  {h.gameMode === "holdem"
                    ? `Blinds ${room.small_blind ?? 1}/${room.big_blind ?? 2}`
                    : `Ante ${room.ante_amount ?? 0}`}
                  {" - Pot "}
                  {h.pot}
                </p>
                <p className="mt-1">
                  Winner(s): {h.winners.length > 0 ? h.winners.map((w) => `${w.displayName} (+${w.amountWon})`).join(", ") : "-"}
                </p>
                {h.gameMode === "pips" && h.pipWinner && (
                  <p className="text-white/60">
                    Highest pips: {h.pipWinner.displayName} ({h.pipWinner.pipTotal})
                  </p>
                )}
                {h.gameMode === "pips" && h.cardsSwappedCount != null && (
                  <p className="text-white/60">Cards swapped: {h.cardsSwappedCount}</p>
                )}
                <p className="mt-1 text-white/40">
                  {h.players.map((p) => `${p.displayName} ${p.netChange >= 0 ? "+" : ""}${p.netChange}`).join("  ")}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {iBusted && (
        <div className="mx-auto mt-4 flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-chip-gold/40 bg-felt p-3">
          <p className="text-center text-xs text-white/70">
            You're out of chips. Buy back in to get dealt into the next hand.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">$</span>
            <input
              type="number"
              min={1}
              step={1}
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(e.target.value)}
              placeholder={String(room.starting_stack ?? 1000)}
              disabled={busy}
              className="w-24 rounded bg-felt-dark px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 focus:ring-chip-gold disabled:opacity-40"
            />
            <button
              onClick={() => {
                const parsed = Number(rebuyAmount);
                const amount = rebuyAmount.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : room.starting_stack ?? 1000;
                handleRebuy(amount);
              }}
              disabled={busy}
              className="rounded bg-chip-gold px-4 py-2 text-xs font-semibold text-felt-dark disabled:opacity-40"
            >
              Buy back in
            </button>
          </div>
        </div>
      )}

      {!amSeated && sessionLoaded && !session && (
        <div className="mx-auto mt-6 flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-felt-light bg-felt p-4">
          <button
            onClick={() => signInWithGoogle()}
            className="rounded bg-white px-6 py-3 text-sm font-semibold text-felt-dark shadow"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {!amSeated && session && (
        <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-2 rounded-lg border border-felt-light bg-felt p-4">
          <label className="text-xs uppercase tracking-wide text-felt-light">Your display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-felt-light bg-felt-dark px-3 py-2 text-sm text-white"
            placeholder="e.g. Ada"
          />
          <button
            onClick={handleJoin}
            disabled={busy || !displayName}
            className="rounded bg-chip-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Take a seat
          </button>
        </div>
      )}

      <div className="relative flex flex-1 items-center justify-center px-4 py-6 pb-24">
        <Table
          seats={seats}
          dealerSeat={gameState?.dealer_seat ?? 0}
          communityCards={gameState?.community_cards ?? []}
          pot={gameState?.pot ?? 0}
          currentBet={gameState?.current_bet ?? 0}
          pots={gameState?.pots ?? []}
          mySeat={myPlayer?.seat ?? null}
          actDeadline={gameState?.act_deadline ?? null}
          actTimeoutSeconds={room.act_timeout_seconds ?? 60}
        />

        {/* Showdown summary as an overlay on top of the table, never pushing
            the page into a scroll. It fades in on arrival and fades out
            smoothly (rather than vanishing abruptly) once the next hand
            starts dealing. */}
        {showdownSnapshot && (
          // The backdrop is fully opaque from the very first frame (no fade,
          // no transparency) so the real table cards underneath - which the
          // server has already dealt face-up by the time hand_complete fires
          // - can never be glimpsed through it while only the inner panel
          // fades in/out.
          <div className={`absolute inset-0 z-10 flex items-center justify-center bg-black p-4 ${showdownVisible ? "" : "pointer-events-none"}`}>
            <div className={`transition-opacity duration-300 ${showdownVisible ? "opacity-100" : "opacity-0"}`}>
              <ShowdownSummary
                result={showdownSnapshot.result}
                handId={showdownSnapshot.handId}
                players={showdownSnapshot.players}
              />
            </div>
          </div>
        )}

        {/* Draw/swap decision as a centered popup too, so the flop, your
            cards, and the stand-pat/swap buttons are all visible together
            with no scrolling. */}
        {isSwapPhase && myHandPlayer && myHandPlayer.status === "active" && !myHandPlayer.has_swapped && myHoleCards && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4">
            <DrawSwapControls
              holeCards={myHoleCards}
              communityCards={gameState?.community_cards ?? []}
              disabled={busy}
              onSwap={handleSwap}
            />
          </div>
        )}
      </div>

      {gameState?.phase === "hand_complete" && (
        <p className="mx-auto -mt-2 mb-2 text-center text-xs text-white/50">
          {gameState.showdown_result?.ranItTwice
            ? "Next hand starts automatically in a bit, once both boards have been shown..."
            : "Next hand starts automatically in a few seconds..."}
        </p>
      )}

      {amSeated && (
        <div className="flex w-full flex-col items-stretch gap-3 border-t border-white/10 bg-black/40 px-4 py-3 sm:flex-row">
          <ChatPanel messages={chatMessages} myUserId={myUserId} disabled={busy} onSend={handleSendChat} />

          <div className="flex flex-1 items-stretch">
            {isMyTurn && isBettingPhase && myHandPlayer && (
              <BettingControls
                toCall={toCall}
                chipStack={myHandPlayer.chip_stack}
                pot={gameState?.pot ?? 0}
                disabled={busy}
                onAction={handleAction}
              />
            )}

            {isRunTwicePending && amInLiveHand && myHandPlayer && (
              <RunItTwicePrompt
                disabled={busy}
                hasVoted={!!gameState?.run_it_twice_votes?.[myHandPlayer.id]}
                votesIn={Object.values(gameState?.run_it_twice_votes ?? {}).filter(Boolean).length}
                votesNeeded={handPlayers.filter((hp) => hp.status !== "folded").length}
                onChoose={handleRunTwice}
              />
            )}

            {canOfferShow && <ShowMuckPrompt disabled={busy} onChoose={handleShowDecision} />}
          </div>
        </div>
      )}

    </main>
  );
}

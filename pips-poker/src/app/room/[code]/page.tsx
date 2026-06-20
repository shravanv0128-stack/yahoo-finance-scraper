"use client";

// The live table screen for a room. Named [code] per the route the home
// page links to (room.id is passed as this segment); it is treated purely
// as the room identifier for /api/rooms/:roomId/* calls.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, getSession, signInWithGoogle } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { Table, type TableSeatData } from "@/components/Table";
import { BettingControls } from "@/components/BettingControls";
import { DrawSwapControls } from "@/components/DrawSwapControls";
import { ShowdownSummary } from "@/components/ShowdownSummary";
import { LedgerPanel } from "@/components/LedgerPanel";
import { RunItTwicePrompt } from "@/components/RunItTwicePrompt";
import { ShowMuckPrompt } from "@/components/ShowMuckPrompt";
import { CommunityBoard } from "@/components/CommunityBoard";
import { ChatPanel } from "@/components/ChatPanel";
import type { BettingAction, ShowDecision } from "@/lib/types";

const BETTING_PHASES = new Set(["flop_betting", "turn_betting", "river_betting"]);

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const roomId = params.code;
  const { data, error, loading, refresh } = useRoomRealtime(roomId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

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
  // needed for that. What we DO stage on the client is the run-it-twice
  // reveal: show board 1 and its result first, then board 2 a few seconds
  // later, so two run-outs are easy to follow instead of appearing at once.
  const [revealStage, setRevealStage] = useState(1);
  useEffect(() => {
    const gs = data?.gameState;
    if (gs?.phase !== "hand_complete" || !gs.showdown_result?.ranItTwice) {
      setRevealStage(1);
      return;
    }
    setRevealStage(1);
    const timer = setTimeout(() => setRevealStage(2), 3000);
    return () => clearTimeout(timer);
  }, [data?.gameState?.phase, data?.gameState?.hand_id, data?.gameState?.showdown_result?.ranItTwice]);

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

  async function handleRebuy() {
    setActionError(null);
    setBusy(true);
    try {
      await authedFetch(`/api/rooms/rebuy`, { roomId });
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

  const { room, players, gameState, handPlayers, myHoleCards, myUserId, chatMessages } = data;
  const myPlayer = players.find((p) => p.user_id === myUserId);
  const amSeated = !!myPlayer;

  const hpBySeat = new Map(handPlayers.map((hp) => [hp.seat, hp]));
  const isHandLive = !!gameState?.hand_id;

  // Busted (chip_stack <= 0) players stay seated so they can rebuy, but once
  // there's no live hand to show their showdown result in, they drop off the
  // felt entirely until they buy back in - matching "only people with money
  // are still in" for the waiting-room view.
  const visiblePlayers = isHandLive ? players : players.filter((p) => p.chip_stack > 0);
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
  const transferTargets = players.filter((p) => p.user_id !== leaderId);

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
              <p className="font-bold text-white">PIPS POKER</p>
            </div>
            <div>
              <p className="text-white/40">PHASE</p>
              <p className="font-bold uppercase text-white">{gameState?.phase ?? "waiting room"}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {iBusted && (
        <div className="mx-auto mt-4 flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border border-chip-gold/40 bg-felt p-3">
          <p className="text-center text-xs text-white/70">
            You're out of chips. Buy back in to get dealt into the next hand.
          </p>
          <button
            onClick={handleRebuy}
            disabled={busy}
            className="rounded bg-chip-gold px-4 py-2 text-xs font-semibold text-felt-dark disabled:opacity-40"
          >
            Buy back in (${room.starting_stack ?? 1000})
          </button>
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

      <div className="flex flex-1 items-center justify-center px-4 py-6 pb-24">
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
      </div>

      {gameState?.community_cards_2 && (
        <div className="mx-auto -mt-2 mb-2 flex flex-col items-center gap-1">
          <p className="text-[10px] uppercase tracking-wide text-chip-gold">Board 1</p>
          {revealStage >= 2 ? (
            <>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-chip-gold">Board 2 (run it twice)</p>
              <CommunityBoard cards={gameState.community_cards_2} />
            </>
          ) : (
            <p className="mt-1 text-[10px] italic text-felt-light/70">Revealing second board…</p>
          )}
        </div>
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

            {isSwapPhase && myHandPlayer && myHandPlayer.status === "active" && !myHandPlayer.has_swapped && myHoleCards && (
              <DrawSwapControls holeCards={myHoleCards} disabled={busy} onSwap={handleSwap} />
            )}
          </div>
        </div>
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

      {gameState?.phase === "hand_complete" && (
        <ShowdownSummary
          result={gameState.showdown_result}
          visibleBoards={revealStage}
          players={handPlayers.map((hp) => ({
            seat: hp.seat,
            displayName: hp.display_name,
            chipStack: hp.chip_stack,
            revealedCards: hp.revealed_cards,
            revealedPipTotal: hp.revealed_pip_total,
            folded: hp.status === "folded",
            amountWon: hp.amount_won,
            mucked: hp.mucked,
          }))}
        />
      )}

      {gameState?.phase === "hand_complete" && (
        <p className="mx-auto mt-2 text-center text-xs text-white/50">
          {gameState.showdown_result?.ranItTwice
            ? "Next hand starts automatically in a bit, once both boards have been shown..."
            : "Next hand starts automatically in a few seconds..."}
        </p>
      )}
    </main>
  );
}

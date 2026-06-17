"use client";

// The live table screen for a room. Named [code] per the route the home
// page links to (room.id is passed as this segment); it is treated purely
// as the room identifier for /api/rooms/:roomId/* calls.

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { Table, type TableSeatData } from "@/components/Table";
import { BettingControls } from "@/components/BettingControls";
import { DrawSwapControls } from "@/components/DrawSwapControls";
import { ShowdownSummary } from "@/components/ShowdownSummary";
import type { BettingAction } from "@/lib/types";

const BETTING_PHASES = new Set(["flop_betting", "turn_betting", "river_betting"]);

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const roomId = params.code;
  const { data, error, loading, refresh } = useRoomRealtime(roomId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");

  async function authedFetch(url: string, body: unknown) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
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

  if (!data) return null;

  const { room, players, gameState, handPlayers, myHoleCards, myUserId } = data;
  const myPlayer = players.find((p) => p.user_id === myUserId);
  const amSeated = !!myPlayer;

  const hpBySeat = new Map(handPlayers.map((hp) => [hp.seat, hp]));
  const isHandLive = !!gameState?.hand_id;

  const seats: TableSeatData[] = players.map((p) => {
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
    };
  });

  const myHandPlayer = myPlayer ? handPlayers.find((hp) => hp.seat === myPlayer.seat) : undefined;
  const isMyTurn =
    isHandLive && myPlayer != null && gameState?.active_seat === myPlayer.seat && myHandPlayer?.status === "active";
  const isBettingPhase = gameState ? BETTING_PHASES.has(gameState.phase) : false;
  const isSwapPhase = gameState?.phase === "draw_swap";
  const toCall = myHandPlayer ? Math.max(0, (gameState?.current_bet ?? 0) - myHandPlayer.current_bet) : 0;

  return (
    <main className="flex min-h-screen flex-col bg-felt-dark">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <div>
          <h1 className="text-lg font-bold text-chip-gold">{room.name}</h1>
          <p className="text-xs text-white/60">
            Room code: <span className="font-mono">{room.code}</span> &middot; Phase:{" "}
            {gameState?.phase ?? "waiting_room"}
          </p>
        </div>
        {amSeated && !isHandLive && (
          <button
            onClick={handleStart}
            disabled={busy || players.length < 2}
            className="rounded bg-chip-gold px-4 py-2 text-sm font-semibold text-felt-dark disabled:opacity-40"
          >
            Start hand
          </button>
        )}
      </header>

      {actionError && (
        <p className="mx-auto mt-2 rounded bg-chip-red/20 px-4 py-1 text-sm text-chip-red">{actionError}</p>
      )}

      {!amSeated && (
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

      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <Table
          seats={seats}
          dealerSeat={gameState?.dealer_seat ?? 0}
          communityCards={gameState?.community_cards ?? []}
          pot={gameState?.pot ?? 0}
          currentBet={gameState?.current_bet ?? 0}
          mySeat={myPlayer?.seat ?? null}
        />
      </div>

      {isMyTurn && isBettingPhase && myHandPlayer && (
        <BettingControls
          toCall={toCall}
          minRaise={gameState?.min_raise ?? 1}
          chipStack={myHandPlayer.chip_stack}
          pot={gameState?.pot ?? 0}
          disabled={busy}
          onAction={handleAction}
        />
      )}

      {isSwapPhase && myHandPlayer && myHandPlayer.status === "active" && !myHandPlayer.has_swapped && myHoleCards && (
        <div className="flex justify-center border-t border-white/10 bg-slate-900/95 px-4 py-3">
          <DrawSwapControls holeCards={myHoleCards} disabled={busy} onSwap={handleSwap} />
        </div>
      )}

      {gameState?.phase === "hand_complete" && (
        <ShowdownSummary
          players={handPlayers.map((hp) => ({
            seat: hp.seat,
            displayName: hp.display_name,
            chipStack: hp.chip_stack,
            revealedCards: hp.revealed_cards,
            revealedPipTotal: hp.revealed_pip_total,
            folded: hp.status === "folded",
          }))}
        />
      )}
    </main>
  );
}

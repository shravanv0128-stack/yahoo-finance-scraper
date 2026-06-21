"use client";

// Subscribes to a room's live state: polls /api/rooms/:roomId/state for the
// room's current public state (players, game_state, hand_players, and the
// caller's own hole cards) and layers a Supabase Realtime subscription on
// top of postgres_changes for game_state/hand_players/actions so updates
// from other players feel close to instant. The poll is the source of
// truth and keeps the UI eventually consistent even if a Realtime event is
// missed; the subscription just triggers an earlier refetch.
//
// Hole cards for OTHER players are never exposed here - the server route
// only returns the calling user's own hole cards (myHoleCards), relying on
// the hole_cards RLS policy (auth.uid() = user_id) as the actual privacy
// boundary even though this client code never attempts to read others'.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, getSession } from "@/lib/supabaseClient";
import type { Card, GamePhase, ShowdownResult } from "@/lib/types";

export interface RoomPlayer {
  id: string;
  user_id: string;
  display_name: string;
  seat: number;
  chip_stack: number;
  buy_in: number;
  is_active: boolean;
  is_away: boolean;
}

export interface RoomHandPlayer {
  id: string;
  seat: number;
  display_name: string;
  status: string;
  chip_stack: number;
  current_bet: number;
  total_committed: number;
  has_acted_this_round: boolean;
  has_swapped: boolean;
  swapped_count: number | null;
  revealed_cards: Card[] | null;
  revealed_pip_total: number | null;
  amount_won: number;
  mucked: boolean;
  has_decided_show: boolean;
}

export interface RoomGameState {
  phase: GamePhase;
  community_cards: Card[];
  pot: number;
  current_bet: number;
  min_raise: number;
  dealer_seat: number;
  active_seat: number | null;
  act_deadline: string | null;
  is_paused: boolean;
  awaiting_run_it_twice: boolean;
  run_it_twice_votes: Record<string, boolean>;
  community_cards_2: Card[] | null;
  showdown_result: ShowdownResult | null;
  pots: { amount: number; label: string }[];
  hand_id: string | null;
}

export interface RoomChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

export interface RoomStateResponse {
  room: {
    id: string;
    code: string;
    name: string;
    created_by: string;
    leader_id?: string | null;
    ante_amount: number;
    small_bet: number;
    starting_stack?: number;
    act_timeout_seconds?: number;
    max_players?: number;
  };
  players: RoomPlayer[];
  gameState: RoomGameState | null;
  handPlayers: RoomHandPlayer[];
  myHoleCards: Card[] | null;
  myUserId: string;
  chatMessages: RoomChatMessage[];
}

const POLL_MS = 2500;

export function useRoomRealtime(roomId: string) {
  const [data, setData] = useState<RoomStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/rooms/${roomId}/state`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load room state");
      if (mounted.current) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_MS);

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_state", filter: `room_id=eq.${roomId}` },
        refresh
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hand_players" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "actions" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        refresh
      )
      .subscribe();

    return () => {
      mounted.current = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { data, error, loading, refresh };
}

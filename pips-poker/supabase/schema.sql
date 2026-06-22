-- Pips Poker schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Pips Poker is a 3-hole-card split-pot variant: each hand awards half the
-- pot to the best 5-card poker hand (hole + community) and half to the
-- highest "pip total" of a player's 3 hole cards (A=1, 2-10=face, J/Q/K=0).
-- See src/lib/types.ts for the row shapes this schema backs, and
-- src/lib/gameEngine.ts for the phase state machine that mutates game_state.

create extension if not exists "pgcrypto";

-- A room is a persistent table that hands are played at.
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_by uuid not null,
  -- The user currently holding host powers (ledger edits, force-end-stuck-
  -- hand, transferring leadership). Defaults to created_by; automatically
  -- hands off to the highest-stack active player if the creator busts, and
  -- automatically reverts back to the creator once they rebuy. Can also be
  -- delegated manually via the "Transfer leadership" control.
  leader_id uuid,
  -- True when leader_id was set by the bust-failover above (so a later
  -- creator rebuy should reclaim leadership); false for the creator's normal
  -- standing or an explicit manual transfer, which stick until the leader
  -- themself busts/leaves.
  leader_auto_assigned boolean not null default false,
  -- Monetary columns use numeric(10,2) (decimal dollars), not integer, so
  -- that fractional values like the $0.50 bomb-pot ante are stored exactly
  -- (an integer column would truncate 0.5 to 0). gameEngine.ts works in
  -- plain dollar amounts (e.g. ANTE_AMOUNT = 0.5) to match.
  ante_amount numeric(10,2) not null default 0.5,
  small_bet numeric(10,2) not null default 1,
  -- Host-configured table settings, chosen on the create-room screen.
  starting_stack numeric(10,2) not null default 1000,
  max_players integer not null default 8,
  act_timeout_seconds integer not null default 60,
  allow_run_it_twice boolean not null default true,
  created_at timestamptz not null default now()
);

-- A seat at a room. Persists across hands; chip_stack carries over.
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null references rooms(id) on delete cascade,
  display_name text not null,
  seat integer not null,
  chip_stack numeric(10,2) not null default 1000,
  buy_in numeric(10,2) not null default 1000,
  is_active boolean not null default true,
  is_away boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, user_id)
);
-- Run this once against an existing database to add buy-in tracking without
-- dropping/recreating the players table:
-- alter table players add column if not exists buy_in numeric(10,2) not null default 1000;

-- One row per hand played at a room.
create table if not exists hands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  hand_number integer not null,
  phase text not null default 'waiting_room',
  pot numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (room_id, hand_number)
);

-- Per-hand snapshot of each seated player's participation. Public columns
-- only; hole cards live separately in hole_cards so RLS can hide them from
-- everyone except the owning user (and the server, via the service role key).
create table if not exists hand_players (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references hands(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  user_id uuid not null,
  seat integer not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','folded','all_in','sitting_out')),
  chip_stack numeric(10,2) not null default 0,
  current_bet numeric(10,2) not null default 0,
  total_committed numeric(10,2) not null default 0,
  has_acted_this_round boolean not null default false,
  has_swapped boolean not null default false,
  revealed_cards jsonb,
  revealed_pip_total integer,
  amount_won numeric(10,2) not null default 0,
  mucked boolean not null default false,
  has_decided_show boolean not null default false,
  unique (hand_id, player_id)
);
-- Run this once against an existing database to add showdown win/show-muck tracking:
-- alter table hand_players add column if not exists amount_won numeric(10,2) not null default 0;
-- alter table hand_players add column if not exists mucked boolean not null default false;
-- alter table hand_players add column if not exists has_decided_show boolean not null default false;

-- Each player's 3 hole cards for a hand. Only readable by that user (or the
-- server via the service-role key) until showdown copies them into
-- hand_players.revealed_cards for everyone to see.
create table if not exists hole_cards (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references hands(id) on delete cascade,
  hand_player_id uuid not null references hand_players(id) on delete cascade,
  user_id uuid not null,
  cards jsonb not null,
  unique (hand_player_id)
);

-- Single mutable row per room holding the live game state (deck, community
-- cards, pot, whose turn it is). Always mutated server-side.
create table if not exists game_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references rooms(id) on delete cascade,
  hand_id uuid references hands(id) on delete set null,
  phase text not null default 'waiting_room',
  community_cards jsonb not null default '[]'::jsonb,
  deck jsonb not null default '[]'::jsonb,
  pot numeric(10,2) not null default 0,
  current_bet numeric(10,2) not null default 0,
  min_raise numeric(10,2) not null default 0,
  dealer_seat integer not null default 0,
  active_seat integer,
  act_deadline timestamptz,
  awaiting_run_it_twice boolean not null default false,
  run_it_twice_votes jsonb not null default '{}'::jsonb,
  community_cards_2 jsonb,
  last_aggressor_seat integer,
  awaiting_show_decision boolean not null default false,
  showdown_result jsonb,
  -- True when the room leader has paused the action clock (e.g. someone
  -- went AFK). While paused, enforceActTimeout never auto-folds/checks and
  -- the auto-deal-next-hand timer doesn't advance. paused_at records when
  -- the pause started so resuming can push act_deadline forward by however
  -- long the pause lasted, instead of it firing immediately.
  is_paused boolean not null default false,
  paused_at timestamptz,
  updated_at timestamptz not null default now()
);
-- Run this once against an existing database to add show/muck tracking:
-- alter table game_state add column if not exists last_aggressor_seat integer;
-- alter table game_state add column if not exists awaiting_show_decision boolean not null default false;
-- Run this once to add the per-board showdown breakdown ("who won which pot"):
-- alter table game_state add column if not exists showdown_result jsonb;

-- Append-only betting/action log for replay and audit.
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  hand_id uuid not null references hands(id) on delete cascade,
  hand_player_id uuid not null references hand_players(id) on delete cascade,
  user_id uuid not null,
  action text not null check (action in ('check','call','bet','raise','fold','all_in')),
  amount numeric(10,2) not null default 0,
  phase text not null,
  created_at timestamptz not null default now()
);

-- Free-text table chat. Independent of hands so messages persist across the
-- whole room's lifetime, not just one hand.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table rooms enable row level security;
alter table players enable row level security;
alter table hands enable row level security;
alter table hand_players enable row level security;
alter table hole_cards enable row level security;
alter table game_state enable row level security;
alter table actions enable row level security;
alter table chat_messages enable row level security;

-- Rooms are only visible to users who actually hold a seat in them. This
-- stops any signed-in client from enumerating every room's join `code` via
-- the REST API and walking into private tables uninvited. The join-by-code
-- flow still works because /api/rooms/join looks the room up server-side
-- with the service-role key (which bypasses RLS), not from the browser.
create policy "rooms readable by seated members" on rooms for select using (
  exists (select 1 from players p where p.room_id = rooms.id and p.user_id = auth.uid())
);

-- These tables carry no per-user secrets (stacks, public hand state, the
-- action log, public chat), so they stay readable by any authenticated user
-- - this is what powers the Realtime subscriptions in useRoomRealtime.ts.
create policy "players readable by authenticated users" on players for select using (auth.role() = 'authenticated');
create policy "hands readable by authenticated users" on hands for select using (auth.role() = 'authenticated');
create policy "hand_players readable by authenticated users" on hand_players for select using (auth.role() = 'authenticated');
create policy "actions readable by authenticated users" on actions for select using (auth.role() = 'authenticated');
create policy "chat readable by authenticated users" on chat_messages for select using (auth.role() = 'authenticated');

-- game_state is DELIBERATELY NOT directly readable by clients: its `deck`
-- column holds every undealt card (including the upcoming turn/river) in
-- order, so exposing the row would let a player query it via REST/Realtime
-- and know future community cards in advance. The client only ever sees the
-- safe subset of game_state through GET /api/rooms/:roomId/state, which runs
-- under the service-role key and strips `deck` before returning. Because of
-- this, game_state changes propagate to clients via the ~2.5s poll (and the
-- hand_players/actions Realtime events that accompany every betting action)
-- rather than a direct game_state Realtime subscription.

-- Chat messages are inserted ONLY by the server (service role) via
-- /api/rooms/chat, which verifies the caller is seated in the room, stamps
-- the real seated display_name, and enforces the length limit. No direct
-- client insert policy is granted: one would let a client post to any room
-- without a seat, spoof another player's display_name, bypass the length
-- cap, and spam unbounded messages straight at the REST API.

-- Hole cards are private: only the owning user can read their own row.
-- The server bypasses this with the service-role key to deal cards and to
-- compute showdown results.
create policy "users read only their own hole cards" on hole_cards
  for select using (auth.uid() = user_id);

-- Players never write their own seat directly from the browser - every
-- game-affecting mutation (dealing, betting, pot/chip updates, sitting
-- in/out, advancing phases) goes through an app/api/** route, which
-- authenticates the caller then uses the service-role key (bypasses RLS)
-- to make the change after validating it server-side. Deliberately no
-- insert/update/delete policy is granted on `players` to authenticated
-- clients: a permissive "auth.uid() = user_id" write policy here would let
-- any signed-in browser client call the Supabase REST API directly to
-- rewrite their own chip_stack/is_active/buy_in (etc.) and bypass every
-- game rule the server enforces, even though no legitimate code path ever
-- needs to write this table from the client.

-- Anyone authenticated may create a room (room creation is the entry point
-- for the "create room" flow on the home page), but only as themselves -
-- without the with-check below, a client could insert a row claiming
-- `created_by` is some other user's id and so impersonate them as the
-- room's creator/leader.
create policy "authenticated users can create rooms" on rooms
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create index if not exists players_room_id_idx on players (room_id);
create index if not exists hands_room_id_idx on hands (room_id);
create index if not exists hand_players_hand_id_idx on hand_players (hand_id);
create index if not exists hole_cards_hand_id_idx on hole_cards (hand_id);
create index if not exists actions_hand_id_idx on actions (hand_id);
create index if not exists chat_messages_room_id_idx on chat_messages (room_id);

-- ============================================================================
-- Realtime: enable postgres_changes broadcasts for the tables the client
-- subscribes to (see src/hooks/useRoomRealtime.ts). Run these after the
-- tables above exist; safe to re-run (will error harmlessly if already added,
-- in which case just ignore that specific error).
-- ============================================================================
-- NOTE: game_state is intentionally NOT broadcast over Realtime - it carries
-- the secret `deck` column, and Realtime would send the whole row to every
-- subscriber. Clients pick up game_state changes via the poll plus the
-- hand_players/actions events below (which accompany every betting action).
alter publication supabase_realtime add table hand_players;
alter publication supabase_realtime add table actions;
alter publication supabase_realtime add table chat_messages;

-- ============================================================================
-- Migration: run this block against an existing database that was created
-- before the ledger / run-it-twice / timer / away-status features were
-- added. Safe to re-run (IF NOT EXISTS guards each column).
-- ============================================================================
alter table players add column if not exists is_away boolean not null default false;
alter table game_state add column if not exists act_deadline timestamptz;
alter table game_state add column if not exists awaiting_run_it_twice boolean not null default false;
alter table game_state add column if not exists community_cards_2 jsonb;
-- Run this once to add unanimous run-it-twice voting:
-- alter table game_state add column if not exists run_it_twice_votes jsonb not null default '{}'::jsonb;
-- Run this once to add host-configured table settings:
-- alter table rooms add column if not exists starting_stack numeric(10,2) not null default 1000;
-- alter table rooms add column if not exists max_players integer not null default 8;
-- alter table rooms add column if not exists act_timeout_seconds integer not null default 60;
-- alter table rooms add column if not exists allow_run_it_twice boolean not null default true;
-- Run this once to show "X swapped N cards" bubbles during draw_swap:
-- alter table hand_players add column if not exists swapped_count integer;
-- Run this once to add room-leader failover/transfer support:
-- alter table rooms add column if not exists leader_id uuid;
-- alter table rooms add column if not exists leader_auto_assigned boolean not null default false;
-- update rooms set leader_id = created_by where leader_id is null;
-- Run this once to add the table chat feature:
-- create table if not exists chat_messages (
--   id uuid primary key default gen_random_uuid(),
--   room_id uuid not null references rooms(id) on delete cascade,
--   user_id uuid not null,
--   display_name text not null,
--   message text not null,
--   created_at timestamptz not null default now()
-- );
-- alter table chat_messages enable row level security;
-- create policy "chat readable by authenticated users" on chat_messages for select using (auth.role() = 'authenticated');
-- create policy "users send their own chat messages" on chat_messages for insert with check (auth.uid() = user_id);
-- create index if not exists chat_messages_room_id_idx on chat_messages (room_id);
-- alter publication supabase_realtime add table chat_messages;
-- Run this once to let the room leader pause the action clock:
-- alter table game_state add column if not exists is_paused boolean not null default false;
-- alter table game_state add column if not exists paused_at timestamptz;

-- ============================================================================
-- SECURITY FIX - run this against any existing database created before this
-- fix: it removes a policy that let any signed-in browser client write
-- directly to their own `players` row (chip_stack, is_active, buy_in, etc.)
-- via the Supabase REST API, completely bypassing the server's game-rule
-- enforcement (e.g. self-crediting chips, un-busting, un-kicking). No
-- legitimate client code path ever wrote this table directly - all
-- mutations already went through app/api/** routes using the service-role
-- key, so dropping the policy is purely a tightening with no functional
-- loss. Also pins room creation to the caller's own auth.uid(), so a room
-- can't be inserted claiming a different user as its creator/leader.
-- ============================================================================
drop policy if exists "users manage their own seat" on players;
drop policy if exists "authenticated users can create rooms" on rooms;
create policy "authenticated users can create rooms" on rooms
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

-- ============================================================================
-- SECURITY FIX v2 - run this against any existing database. It closes three
-- holes that direct REST/Realtime access to the tables would otherwise allow:
--
--   1. game_state.deck leak (HIGH): game_state was readable by any signed-in
--      user, exposing the undealt deck (future turn/river cards). Dropping the
--      select policy makes game_state reachable only via the service-role API
--      route, which strips `deck`. (Clients fall back to the existing poll +
--      hand_players/actions Realtime, so live updates still work.)
--   2. chat_messages spoofing/spam (MEDIUM): the direct-insert policy let a
--      client post to any room without a seat, spoof another player's name,
--      and bypass the server's length cap. All legitimate inserts go through
--      /api/rooms/chat (service role), so the policy is removed.
--   3. room-code enumeration (MEDIUM): rooms were readable by every signed-in
--      user, leaking all join codes. Restricted to users seated in the room;
--      join-by-code still works via the service-role join route.
-- ============================================================================
drop policy if exists "game_state readable by authenticated users" on game_state;
drop policy if exists "users send their own chat messages" on chat_messages;
drop policy if exists "rooms readable by authenticated users" on rooms;
create policy "rooms readable by seated members" on rooms for select using (
  exists (select 1 from players p where p.room_id = rooms.id and p.user_id = auth.uid())
);
-- game_state is no longer in the client Realtime path; drop it from the
-- publication so no row (deck included) is ever broadcast to subscribers.
-- Safe to ignore an error here if it was never added.
alter publication supabase_realtime drop table game_state;

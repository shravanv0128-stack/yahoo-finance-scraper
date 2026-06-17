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
  -- Monetary columns use numeric(10,2) (decimal dollars), not integer, so
  -- that fractional values like the $0.50 bomb-pot ante are stored exactly
  -- (an integer column would truncate 0.5 to 0). gameEngine.ts works in
  -- plain dollar amounts (e.g. ANTE_AMOUNT = 0.5) to match.
  ante_amount numeric(10,2) not null default 0.5,
  small_bet numeric(10,2) not null default 1,
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
  community_cards_2 jsonb,
  last_aggressor_seat integer,
  awaiting_show_decision boolean not null default false,
  showdown_result jsonb,
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

alter table rooms enable row level security;
alter table players enable row level security;
alter table hands enable row level security;
alter table hand_players enable row level security;
alter table hole_cards enable row level security;
alter table game_state enable row level security;
alter table actions enable row level security;

-- Public, read-only metadata for anyone signed in.
create policy "rooms readable by authenticated users" on rooms for select using (auth.role() = 'authenticated');
create policy "players readable by authenticated users" on players for select using (auth.role() = 'authenticated');
create policy "hands readable by authenticated users" on hands for select using (auth.role() = 'authenticated');
create policy "hand_players readable by authenticated users" on hand_players for select using (auth.role() = 'authenticated');
create policy "game_state readable by authenticated users" on game_state for select using (auth.role() = 'authenticated');
create policy "actions readable by authenticated users" on actions for select using (auth.role() = 'authenticated');

-- Hole cards are private: only the owning user can read their own row.
-- The server bypasses this with the service-role key to deal cards and to
-- compute showdown results.
create policy "users read only their own hole cards" on hole_cards
  for select using (auth.uid() = user_id);

-- Players manage their own seat (choosing a display name, sitting out).
-- All game-affecting mutations (dealing, betting, pot/chip updates,
-- advancing phases) are performed server-side with the service role key,
-- which bypasses RLS entirely.
create policy "users manage their own seat" on players
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone authenticated may create a room (room creation is the entry point
-- for the "create room" flow on the home page).
create policy "authenticated users can create rooms" on rooms
  for insert with check (auth.role() = 'authenticated');

create index if not exists players_room_id_idx on players (room_id);
create index if not exists hands_room_id_idx on hands (room_id);
create index if not exists hand_players_hand_id_idx on hand_players (hand_id);
create index if not exists hole_cards_hand_id_idx on hole_cards (hand_id);
create index if not exists actions_hand_id_idx on actions (hand_id);

-- ============================================================================
-- Realtime: enable postgres_changes broadcasts for the tables the client
-- subscribes to (see src/hooks/useRoomRealtime.ts). Run these after the
-- tables above exist; safe to re-run (will error harmlessly if already added,
-- in which case just ignore that specific error).
-- ============================================================================
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table hand_players;
alter publication supabase_realtime add table actions;

-- ============================================================================
-- Migration: run this block against an existing database that was created
-- before the ledger / run-it-twice / timer / away-status features were
-- added. Safe to re-run (IF NOT EXISTS guards each column).
-- ============================================================================
alter table players add column if not exists is_away boolean not null default false;
alter table game_state add column if not exists act_deadline timestamptz;
alter table game_state add column if not exists awaiting_run_it_twice boolean not null default false;
alter table game_state add column if not exists community_cards_2 jsonb;

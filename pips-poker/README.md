# Pips Poker

A private, friends-only poker variant: 3 hole cards, bomb-pot ante, no preflop
betting, a one-time hole-card discard/swap after the flop, and a showdown that
splits the pot 50/50 between the best poker hand (Omaha-style: exactly 2 hole
+ 3 board cards) and the highest pip total (Ace=1, 2-10=face, J/Q/K=0).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Realtime)
- Vitest for the game-logic test suite

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Run the schema**: open the SQL editor in your Supabase project and run
   the contents of `supabase/schema.sql`. This creates `rooms`, `players`,
   `hands`, `hand_players`, `hole_cards`, `actions`, `game_state`, plus RLS
   policies (hole cards are only readable by their owning user; everything
   else is readable by anyone, since this is a private-room game with no
   sensitive PII).
3. **Copy environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in from your Supabase project settings (Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon` public key
   - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` secret key (server-only,
     never exposed to the browser — used by the API routes in
     `src/app/api/**` to perform privileged game mutations)
4. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Playing with friends

1. On the home page, create a room — you get a room code and a shareable
   link like `http://localhost:3000/room/<code>` (swap `localhost:3000` for
   your deployed URL once you host it, e.g. on Vercel).
2. Send that link to your friends. Anyone with the link can open it, type a
   display name, and take a seat — no account/signup required to join.
3. Once at least 2 players are seated, anyone seated can click "Start hand."
   Everyone antes automatically, hole cards are dealt, and the table is live
   for everyone via Supabase Realtime.

### Testing locally with multiple "players"

Open the room link in several browser windows (or one normal + one
incognito/private window per extra player) and use different display names
in each — this simulates separate friends joining without needing multiple
real devices.

## Project structure

```
src/
  lib/
    types.ts          shared TS types (Card, GamePhase, etc.)
    deck.ts            deck build/shuffle/deal
    pipEvaluator.ts     pip values + pip-total comparison
    handEvaluator.ts    best 5-card hand under the 2-hole+3-board constraint
    bettingEngine.ts    pot/bet tracking, call amounts, simplified side pots
    gamePhases.ts       phase order + transition helper
    gameEngine.ts       orchestrates a full hand using the modules above
    supabaseClient.ts   browser client (anon key)
    supabaseServer.ts   server-only client (service role key)
  components/           Table, PlayerSeat, Card, BettingControls,
                         DrawSwapControls, PotDisplay, ShowdownSummary,
                         CommunityBoard
  hooks/useRoomRealtime.ts   subscribes to live room/hand state
  app/
    page.tsx                 home: create/join a room
    room/[code]/page.tsx     the table
    api/rooms/...            room create/join/state routes
    api/hands/...            start/action/swap/showdown routes (server-authoritative)
supabase/schema.sql      full DB schema + RLS policies
```

All game-mutating logic (shuffling, dealing, betting validation, phase
transitions, showdown evaluation) runs server-side in the `api/hands/*`
route handlers using the Supabase service role key, so clients can't see or
influence outcomes beyond the actions they're allowed to take.

## Tests

```bash
npm test
```

Covers the deck (uniqueness/shuffle), the hand evaluator (the 2-hole+3-board
constraint, including cases that would be a better hand if it weren't
enforced, and tie scenarios), and the pip evaluator.

## Known gaps / simplifications (MVP scope)

- Game state updates rely on Supabase Realtime plus short client-side
  polling as a fallback; there's no reconnect/backoff UI if a Realtime
  channel drops.
- Side-pot handling covers the common one/two-all-in case but isn't a fully
  general N-way side-pot algorithm.
- No animations for dealing/chip movement.
- Mobile layout is unoptimized — desktop-first as requested.
- A legacy unused route, `src/app/api/rooms/[roomId]/join/route.ts`, is dead
  code superseded by `src/app/api/rooms/join/route.ts` and can be deleted.

## Suggested next steps

- Mobile-responsive layout.
- In-room text chat.
- Spectator mode (watch without a seat).
- Hand history / replay log per room.
- Customizable house rules (ante size, starting stack, swap limits).

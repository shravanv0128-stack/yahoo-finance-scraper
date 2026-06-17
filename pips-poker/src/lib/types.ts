// Shared types for Pips Poker. Kept dependency-free so they can be imported
// from both server (API routes) and client (components/hooks) code.

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

// Rank uses numeric values for 2-10 and string codes for face/ace cards so
// that poker-hand comparisons (handEvaluator.ts) can sort numerically while
// pip scoring (pipEvaluator.ts) can map ranks -> pip values independently.
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Game phases, in exact order of play. Stored verbatim as the `phase` column
// in game_state and used to drive both server transition logic and client UI.
export type GamePhase =
  | "waiting_room"
  | "ante"
  | "deal_hole_cards"
  | "flop"
  | "flop_betting"
  | "draw_swap"
  | "turn"
  | "turn_betting"
  | "river"
  | "river_betting"
  | "showdown"
  | "hand_complete";

export type PlayerStatus = "active" | "folded" | "all_in" | "sitting_out";

export type BettingAction = "check" | "call" | "bet" | "raise" | "fold" | "all_in";

export interface Player {
  id: string;
  user_id: string;
  room_id: string;
  display_name: string;
  seat: number;
  chip_stack: number;
  is_active: boolean; // seated and not sitting out
  created_at?: string;
}

export interface HandPlayerPublic {
  id: string;
  hand_id: string;
  player_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  status: PlayerStatus;
  chip_stack: number;
  current_bet: number; // amount put in during the *current* betting round
  total_committed: number; // total put into the pot this hand (all rounds + ante)
  has_acted_this_round: boolean;
  has_swapped: boolean; // whether the player has used their one draw_swap opportunity
  revealed_cards: Card[] | null; // populated at showdown only
  revealed_pip_total: number | null;
}

export interface HoleCardsRow {
  id: string;
  hand_id: string;
  hand_player_id: string;
  user_id: string;
  cards: Card[]; // exactly 3 cards
}

export interface ActionRow {
  id: string;
  hand_id: string;
  hand_player_id: string;
  user_id: string;
  action: BettingAction;
  amount: number;
  phase: GamePhase;
  created_at: string;
}

export interface GameStateRow {
  id: string;
  room_id: string;
  hand_id: string | null;
  phase: GamePhase;
  community_cards: Card[];
  deck: Card[]; // remaining undealt cards, server-only concern but stored for resumability
  pot: number;
  current_bet: number; // highest current_bet among hand_players this round
  min_raise: number;
  dealer_seat: number;
  active_seat: number | null; // whose turn it is to act (betting rounds only)
  updated_at: string;
}

export interface HandRow {
  id: string;
  room_id: string;
  hand_number: number;
  phase: GamePhase;
  pot: number;
  created_at: string;
  completed_at: string | null;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  created_by: string;
  ante_amount: number;
  small_bet: number;
  created_at: string;
}

// Result of evaluating a single 5-card poker hand (handEvaluator.ts)
export type HandRankCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush";

export interface HandRankResult {
  category: HandRankCategory;
  categoryRank: number; // 0 (high card) .. 8 (straight flush), higher is better
  // tiebreak values in descending priority order, e.g. for full house: [trips rank, pair rank]
  tiebreakers: number[];
  cards: Card[]; // the best 5 cards
  holeCardsUsed: [Card, Card];
  boardCardsUsed: [Card, Card, Card];
}

export interface PipResult {
  cards: Card[]; // the 3 hole cards
  total: number;
}

export interface ShowdownPlayerResult {
  hand_player_id: string;
  seat: number;
  display_name: string;
  bestHand: HandRankResult;
  pipResult: PipResult;
  pokerWinShare: number; // dollars won from the poker half
  pipWinShare: number; // dollars won from the pip half
  totalWin: number;
}

// Keeps rooms.leader_id (who currently holds host powers - ledger edits,
// force-end-stuck-hand, transferring leadership) in sync with players
// busting/rebuying:
//  - If the current leader no longer has chips (or left/went away), hand off
//    to the room creator if they're eligible, otherwise to whoever has the
//    biggest stack. That handoff is marked "auto" so it can be reclaimed.
//  - Once the creator is eligible again and the current leader only holds
//    the seat because of an earlier auto handoff, leadership reverts to the
//    creator automatically.
//  - A manual transfer (leader_auto_assigned = false) sticks until the
//    leader holding it busts/leaves, at which point the same failover runs.
import type { SupabaseClient } from "@supabase/supabase-js";

interface LeaderRoom {
  created_by: string;
  leader_id: string | null;
  leader_auto_assigned: boolean;
}

interface LeaderPlayer {
  user_id: string;
  chip_stack: number;
  is_active: boolean;
  is_away: boolean;
}

function isEligible(p: LeaderPlayer | undefined): p is LeaderPlayer {
  return !!p && p.is_active && !p.is_away && p.chip_stack > 0;
}

export async function syncRoomLeader(
  supabase: SupabaseClient,
  roomId: string
): Promise<{ leaderId: string | null; leaderAutoAssigned: boolean }> {
  const { data: room } = await supabase
    .from("rooms")
    .select("created_by, leader_id, leader_auto_assigned")
    .eq("id", roomId)
    .single();
  if (!room) return { leaderId: null, leaderAutoAssigned: false };

  const { data: players } = await supabase
    .from("players")
    .select("user_id, chip_stack, is_active, is_away")
    .eq("room_id", roomId);
  if (!players || players.length === 0) {
    return { leaderId: room.leader_id ?? room.created_by, leaderAutoAssigned: room.leader_auto_assigned };
  }

  const r = room as LeaderRoom;
  const byUser = new Map(players.map((p: LeaderPlayer) => [p.user_id, p]));
  const currentLeader = r.leader_id ? byUser.get(r.leader_id) : undefined;
  const creator = byUser.get(r.created_by);

  let nextLeaderId = r.leader_id ?? r.created_by;
  let nextAuto = r.leader_auto_assigned;

  if (!isEligible(currentLeader)) {
    if (isEligible(creator)) {
      nextLeaderId = r.created_by;
      nextAuto = false;
    } else {
      const ranked = (players as LeaderPlayer[])
        .filter(isEligible)
        .sort((a, b) => b.chip_stack - a.chip_stack);
      nextLeaderId = ranked[0]?.user_id ?? r.created_by;
      nextAuto = true;
    }
  } else if (r.leader_auto_assigned && r.leader_id !== r.created_by && isEligible(creator)) {
    nextLeaderId = r.created_by;
    nextAuto = false;
  }

  if (nextLeaderId !== r.leader_id || nextAuto !== r.leader_auto_assigned) {
    await supabase
      .from("rooms")
      .update({ leader_id: nextLeaderId, leader_auto_assigned: nextAuto })
      .eq("id", roomId);
  }

  return { leaderId: nextLeaderId, leaderAutoAssigned: nextAuto };
}

export async function transferLeadership(
  supabase: SupabaseClient,
  roomId: string,
  fromUserId: string,
  toUserId: string
): Promise<void> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("created_by, leader_id")
    .eq("id", roomId)
    .single();
  if (error || !room) throw new Error("Room not found");
  if ((room.leader_id ?? room.created_by) !== fromUserId) {
    throw new Error("Only the current room leader can transfer leadership");
  }

  const { data: target } = await supabase
    .from("players")
    .select("user_id, is_active")
    .eq("room_id", roomId)
    .eq("user_id", toUserId)
    .maybeSingle();
  if (!target || !target.is_active) {
    throw new Error("That player isn't seated in this room");
  }

  await supabase
    .from("rooms")
    .update({ leader_id: toUserId, leader_auto_assigned: false })
    .eq("id", roomId);
}

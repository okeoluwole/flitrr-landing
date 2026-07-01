/**
 * Seat accounting for an organisation's team (pure logic).
 *
 * One organisation has a seat_limit. A seat is held by an active member or by
 * an outstanding pending invite, so:
 *
 *   seats used = active members + outstanding pending invites
 *
 * A pending invite and the membership it becomes are never both counted: an
 * invite is consumed into a membership at acceptance (the database side does
 * this atomically), so a person is either a pending invite or a member, never
 * both. That keeps this sum exact.
 *
 * No database, no React, no clock: the same inputs always give the same answer,
 * so the whole module is unit-testable in isolation. The server enforces these
 * checks authoritatively (the invite route and the reactivate function); this
 * module is the single shared rule the UI reads to show counts and to disable
 * or explain a blocked action without a round trip.
 */

// A clamped, non-negative integer. Anything not a finite number floors to 0, so
// a bad count can never invent free seats or hide used ones.
function count(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Seats currently held: active members plus outstanding pending invites.
 */
export function seatsUsed({ activeMembers, pendingInvites } = {}) {
  return count(activeMembers) + count(pendingInvites);
}

/**
 * The full seat picture for an organisation.
 * Returns { limit, used, remaining, hasFreeSeat }.
 *   - limit: the organisation's seat_limit (at least 1).
 *   - used: active members + pending invites.
 *   - remaining: free seats, never negative.
 *   - hasFreeSeat: whether one more seat can be taken.
 */
export function seatAvailability({ seatLimit, activeMembers, pendingInvites } = {}) {
  const limit = Math.max(1, count(seatLimit));
  const used = seatsUsed({ activeMembers, pendingInvites });
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, hasFreeSeat: used < limit };
}

/**
 * Whether a new invite may be sent. Inviting takes one seat (the pending
 * invite), so it is blocked when no seat is free.
 * Returns { allowed, reason }. reason is null when allowed.
 */
export function canInvite(input = {}) {
  const { limit, used, hasFreeSeat } = seatAvailability(input);
  if (hasFreeSeat) return { allowed: true, reason: null };
  return {
    allowed: false,
    reason: `All ${limit} seats are in use (${used} of ${limit}). Free a seat by deactivating a member, or contact Flitrr to raise your seat limit.`,
  };
}

/**
 * Whether a deactivated member may be reactivated. Reactivating returns one
 * person to active, taking a seat, so it is blocked when no seat is free. The
 * deactivated person is not in the active count, so the same free-seat test
 * applies.
 * Returns { allowed, reason }. reason is null when allowed.
 */
export function canReactivate(input = {}) {
  const { limit, used, hasFreeSeat } = seatAvailability(input);
  if (hasFreeSeat) return { allowed: true, reason: null };
  return {
    allowed: false,
    reason: `All ${limit} seats are in use (${used} of ${limit}). Free a seat before reactivating, or contact Flitrr to raise your seat limit.`,
  };
}

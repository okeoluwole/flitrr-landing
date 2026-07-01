import { describe, it, expect } from 'vitest';
import {
  seatsUsed,
  seatAvailability,
  canInvite,
  canReactivate,
} from '../lib/team/seats.js';

/**
 * Seat accounting: seats used is active members plus outstanding pending
 * invites, and inviting or reactivating is blocked when no seat is free.
 */

describe('seatsUsed', () => {
  it('sums active members and pending invites', () => {
    expect(seatsUsed({ activeMembers: 3, pendingInvites: 2 })).toBe(5);
  });

  it('treats missing counts as zero', () => {
    expect(seatsUsed({})).toBe(0);
    expect(seatsUsed()).toBe(0);
    expect(seatsUsed({ activeMembers: 4 })).toBe(4);
  });

  it('never invents or hides seats from bad input', () => {
    expect(seatsUsed({ activeMembers: -3, pendingInvites: 1 })).toBe(1);
    expect(seatsUsed({ activeMembers: 2.9, pendingInvites: 1.9 })).toBe(3);
    expect(seatsUsed({ activeMembers: 'x', pendingInvites: null })).toBe(0);
  });
});

describe('seatAvailability', () => {
  it('reports the limit, used, remaining and a free seat', () => {
    expect(
      seatAvailability({ seatLimit: 5, activeMembers: 2, pendingInvites: 1 })
    ).toEqual({ limit: 5, used: 3, remaining: 2, hasFreeSeat: true });
  });

  it('reports no free seat when full', () => {
    expect(
      seatAvailability({ seatLimit: 3, activeMembers: 2, pendingInvites: 1 })
    ).toEqual({ limit: 3, used: 3, remaining: 0, hasFreeSeat: false });
  });

  it('never reports negative remaining when over the limit', () => {
    const a = seatAvailability({ seatLimit: 1, activeMembers: 2, pendingInvites: 1 });
    expect(a.remaining).toBe(0);
    expect(a.hasFreeSeat).toBe(false);
  });

  it('floors the limit at one', () => {
    expect(seatAvailability({ seatLimit: 0 }).limit).toBe(1);
    expect(seatAvailability({}).limit).toBe(1);
  });
});

describe('canInvite', () => {
  it('allows inviting while a seat is free', () => {
    expect(canInvite({ seatLimit: 5, activeMembers: 2, pendingInvites: 1 })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('blocks inviting when full, with a reason', () => {
    const r = canInvite({ seatLimit: 3, activeMembers: 2, pendingInvites: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('All 3 seats');
  });

  it('counts a pending invite as a held seat', () => {
    // One active member, two pending, limit three: full.
    expect(canInvite({ seatLimit: 3, activeMembers: 1, pendingInvites: 2 }).allowed).toBe(
      false
    );
  });
});

describe('canReactivate', () => {
  it('allows reactivating while a seat is free', () => {
    expect(
      canReactivate({ seatLimit: 5, activeMembers: 2, pendingInvites: 1 }).allowed
    ).toBe(true);
  });

  it('blocks reactivating when full, with a reason', () => {
    const r = canReactivate({ seatLimit: 2, activeMembers: 2, pendingInvites: 0 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('reactivating');
  });
});

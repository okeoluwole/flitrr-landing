import { describe, it, expect } from 'vitest';
import {
  activeAdminCount,
  canDemote,
  canDeactivate,
  LAST_ADMIN_REASON,
} from '../lib/team/adminGuard.js';

/**
 * The last-admin guard: an organisation must always keep at least one active
 * admin, so the last active admin cannot demote or deactivate itself until
 * another member is promoted.
 */

// A small roster builder. Each entry is [userId, role, active].
function roster(...rows) {
  return rows.map(([userId, role, active]) => ({ userId, role, active }));
}

const ONLY_ADMIN = roster(['a', 'admin', true], ['b', 'member', true]);
const TWO_ADMINS = roster(['a', 'admin', true], ['b', 'admin', true]);
const ADMIN_PLUS_DEACTIVATED_ADMIN = roster(
  ['a', 'admin', true],
  ['b', 'admin', false]
);

describe('activeAdminCount', () => {
  it('counts only admins that are active', () => {
    expect(activeAdminCount(TWO_ADMINS)).toBe(2);
    expect(activeAdminCount(ONLY_ADMIN)).toBe(1);
    expect(activeAdminCount(ADMIN_PLUS_DEACTIVATED_ADMIN)).toBe(1);
  });

  it('is zero for a missing or empty roster', () => {
    expect(activeAdminCount([])).toBe(0);
    expect(activeAdminCount(undefined)).toBe(0);
  });
});

describe('canDemote', () => {
  it('blocks demoting the only active admin', () => {
    const r = canDemote({ members: ONLY_ADMIN, targetUserId: 'a' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(LAST_ADMIN_REASON);
  });

  it('allows demoting an admin when another active admin remains', () => {
    expect(canDemote({ members: TWO_ADMINS, targetUserId: 'a' })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('does not count a deactivated admin as the safety net', () => {
    // b is an admin but deactivated, so demoting a would leave zero active.
    const r = canDemote({ members: ADMIN_PLUS_DEACTIVATED_ADMIN, targetUserId: 'a' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(LAST_ADMIN_REASON);
  });

  it('refuses to demote a plain member', () => {
    const r = canDemote({ members: ONLY_ADMIN, targetUserId: 'b' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Only an admin');
  });

  it('reports a target that is not in the roster', () => {
    const r = canDemote({ members: TWO_ADMINS, targetUserId: 'zzz' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('could not be found');
  });
});

describe('canDeactivate', () => {
  it('blocks deactivating the only active admin', () => {
    const r = canDeactivate({ members: ONLY_ADMIN, targetUserId: 'a' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(LAST_ADMIN_REASON);
  });

  it('allows deactivating an admin when another active admin remains', () => {
    expect(canDeactivate({ members: TWO_ADMINS, targetUserId: 'a' }).allowed).toBe(true);
  });

  it('always allows deactivating a plain member', () => {
    expect(canDeactivate({ members: ONLY_ADMIN, targetUserId: 'b' })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('does not count a deactivated admin as the safety net', () => {
    const r = canDeactivate({
      members: ADMIN_PLUS_DEACTIVATED_ADMIN,
      targetUserId: 'a',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(LAST_ADMIN_REASON);
  });

  it('reports an already-deactivated target', () => {
    const r = canDeactivate({
      members: ADMIN_PLUS_DEACTIVATED_ADMIN,
      targetUserId: 'b',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('already deactivated');
  });
});

/**
 * The last-admin guard (pure logic).
 *
 * An organisation must always have at least one active admin. So the last
 * active admin cannot be demoted to member, and cannot be deactivated, until
 * another member has been promoted to admin. A named human makes that choice;
 * the system never auto-picks a replacement. The product blocks the action and
 * says why.
 *
 * This module is the single shared rule. It is enforced authoritatively at the
 * database level (a trigger on organisation_members that refuses any update or
 * delete leaving an organisation with zero active admins), and mirrored here so
 * the UI can disable or explain a blocked action instantly, with no round trip.
 * The two must agree: this rule and the trigger are the same invariant.
 *
 * No database, no React, no clock. A member is { userId, role, active }, where
 * role is 'admin' or 'member' and active is true unless deactivated.
 */

export const LAST_ADMIN_REASON =
  'An organisation must keep at least one active admin. Promote another member to admin first.';

// The active admins in a roster: role admin and not deactivated.
function activeAdmins(members) {
  if (!Array.isArray(members)) return [];
  return members.filter((m) => m && m.role === 'admin' && m.active === true);
}

/**
 * The number of active admins in a roster. Exported so the UI can show it and
 * decide messaging without re-deriving the rule.
 */
export function activeAdminCount(members) {
  return activeAdmins(members).length;
}

/**
 * Whether the named admin may be demoted to member.
 * Blocked when they are the only active admin left.
 * Returns { allowed, reason }. reason is null when allowed.
 */
export function canDemote({ members, targetUserId } = {}) {
  const target = (Array.isArray(members) ? members : []).find(
    (m) => m && m.userId === targetUserId
  );
  if (!target) return { allowed: false, reason: 'That member could not be found.' };
  if (target.role !== 'admin') {
    return { allowed: false, reason: 'Only an admin can be demoted to member.' };
  }
  // After demotion the target is no longer an active admin. Block when no other
  // active admin would remain.
  const othersActiveAdmin = activeAdmins(members).filter(
    (m) => m.userId !== targetUserId
  );
  if (othersActiveAdmin.length === 0) {
    return { allowed: false, reason: LAST_ADMIN_REASON };
  }
  return { allowed: true, reason: null };
}

/**
 * Whether the named member may be deactivated.
 * Always allowed for a plain member (deactivation frees their seat and leaves
 * their authored work in place). For an admin, blocked when they are the only
 * active admin left.
 * Returns { allowed, reason }. reason is null when allowed.
 */
export function canDeactivate({ members, targetUserId } = {}) {
  const target = (Array.isArray(members) ? members : []).find(
    (m) => m && m.userId === targetUserId
  );
  if (!target) return { allowed: false, reason: 'That member could not be found.' };
  if (target.active !== true) {
    return { allowed: false, reason: 'That member is already deactivated.' };
  }
  if (target.role === 'admin') {
    const othersActiveAdmin = activeAdmins(members).filter(
      (m) => m.userId !== targetUserId
    );
    if (othersActiveAdmin.length === 0) {
      return { allowed: false, reason: LAST_ADMIN_REASON };
    }
  }
  return { allowed: true, reason: null };
}

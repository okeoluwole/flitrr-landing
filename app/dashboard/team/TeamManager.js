'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { seatAvailability, canInvite, canReactivate } from '../../../lib/team/seats.js';
import { canDemote, canDeactivate } from '../../../lib/team/adminGuard.js';
import styles from './page.module.css';

/**
 * The team screen. Admin only (the page gates it server-side). It lists members
 * and pending invites, shows the seat count, and runs the admin actions:
 * invite, cancel an invite, promote, demote, deactivate, reactivate.
 *
 * The members and pending lists come straight from server props; after each
 * action the server data is re-read with router.refresh(), so the screen always
 * reflects the database rather than an optimistic local copy. The seat cap and
 * the last-admin guard are checked here with the shared pure functions so a
 * blocked action is disabled and explained without a round trip, and enforced
 * authoritatively by the server (the invite route, the reactivate function, and
 * the last-admin database trigger).
 */

function memberName(m) {
  if (m.full_name && m.full_name.trim()) return m.full_name.trim();
  if (m.email) return m.email.split('@')[0];
  return 'Member';
}

// The invitation created_at timestamp shown at day granularity. Pinned to UTC
// so the invited day reads the same for every viewer and the server-rendered
// HTML matches the client.
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TeamManager({
  currentUserId,
  organisationName,
  seatLimit,
  initialMembers,
  initialPending,
}) {
  const router = useRouter();
  const supabase = createClient();

  const members = Array.isArray(initialMembers) ? initialMembers : [];
  const pending = Array.isArray(initialPending) ? initialPending : [];

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteNotice, setInviteNotice] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [actionError, setActionError] = useState(null);

  const activeMembers = members.filter((m) => m.deactivated_at === null).length;
  const pendingCount = pending.length;
  const seats = seatAvailability({
    seatLimit,
    activeMembers,
    pendingInvites: pendingCount,
  });
  const inviteGate = canInvite({
    seatLimit,
    activeMembers,
    pendingInvites: pendingCount,
  });
  const reactivateGate = canReactivate({
    seatLimit,
    activeMembers,
    pendingInvites: pendingCount,
  });

  // Normalised roster for the pure guards.
  const guardMembers = members.map((m) => ({
    userId: m.user_id,
    role: m.role,
    active: m.deactivated_at === null,
  }));

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError(null);
    setInviteNotice(null);
    const email = inviteEmail.trim();
    if (!email) {
      setInviteError('Enter an email address.');
      return;
    }
    if (!inviteGate.allowed) {
      setInviteError(inviteGate.reason);
      return;
    }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(json.error || 'Could not send the invite.');
      } else {
        setInviteEmail('');
        setInviteNotice(`Invite sent to ${json.email || email}.`);
        router.refresh();
      }
    } catch {
      setInviteError('Could not send the invite. Please try again.');
    } finally {
      setInviteBusy(false);
    }
  }

  async function runRpc(fn, targetUserId, key) {
    setActionError(null);
    setBusyKey(key);
    try {
      const { error } = await supabase.rpc(fn, { target_user_id: targetUserId });
      if (error) {
        setActionError(error.message || 'Could not complete that action.');
      } else {
        router.refresh();
      }
    } catch {
      setActionError('Could not complete that action. Please try again.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCancelInvite(invitationId, key) {
    setActionError(null);
    setBusyKey(key);
    try {
      const res = await fetch('/api/team/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json.error || 'Could not cancel the invite.');
      } else {
        router.refresh();
      }
    } catch {
      setActionError('Could not cancel the invite. Please try again.');
    } finally {
      setBusyKey(null);
    }
  }

  function handleDeactivate(m) {
    const gate = canDeactivate({ members: guardMembers, targetUserId: m.user_id });
    if (!gate.allowed) {
      setActionError(gate.reason);
      return;
    }
    const ok = window.confirm(
      `Deactivate ${memberName(m)}? They keep their account and everything they have authored stays in place, but they lose access and free their seat. You can reactivate them later.`
    );
    if (!ok) return;
    runRpc('deactivate_member', m.user_id, `deactivate-${m.user_id}`);
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.heading}>Team</h1>
          <p className={styles.sub}>
            Manage who can reach {organisationName}.
          </p>
        </div>
        <div className={styles.seatBox} aria-label="Seats used">
          <span className={`${styles.seatCount} tnum`}>
            {seats.used} of {seats.limit}
          </span>
          <span className={styles.seatLabel}>seats used</span>
        </div>
      </header>

      {/* Invite a member */}
      <section className={styles.card} aria-labelledby="invite-h">
        <h2 id="invite-h" className={styles.cardTitle}>
          Invite a member
        </h2>
        <p className={styles.cardLead}>
          They set their own password from the email and join your organisation
          as a member.
        </p>
        <form className={styles.inviteForm} onSubmit={handleInvite} noValidate>
          <div className={styles.inviteField}>
            <label htmlFor="invite-email" className={styles.srOnly}>
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              className={styles.input}
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoComplete="off"
              disabled={inviteBusy}
            />
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={inviteBusy || !inviteGate.allowed}
            >
              {inviteBusy ? 'Sending…' : 'Invite'}
            </button>
          </div>
          {!inviteGate.allowed && (
            <p className={styles.inlineNote}>{inviteGate.reason}</p>
          )}
          {inviteError && (
            <p className={styles.error} role="alert">
              {inviteError}
            </p>
          )}
          {inviteNotice && (
            <p className={styles.notice} role="status">
              {inviteNotice}
            </p>
          )}
        </form>
      </section>

      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <section className={styles.card} aria-labelledby="pending-h">
          <h2 id="pending-h" className={styles.cardTitle}>
            Pending invites
          </h2>
          <ul className={styles.list}>
            {pending.map((inv) => {
              const key = `cancel-${inv.id}`;
              const busy = busyKey === key;
              return (
                <li key={inv.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowName}>{inv.email}</span>
                    <span className={styles.rowMeta}>
                      Invited {formatDate(inv.created_at)}
                    </span>
                  </div>
                  <div className={styles.rowTags}>
                    <span className={`${styles.pill} ${styles.pillPending}`}>
                      Pending
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => handleCancelInvite(inv.id, key)}
                      disabled={busy}
                    >
                      {busy ? 'Cancelling…' : 'Cancel invite'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Members */}
      <section className={styles.card} aria-labelledby="members-h">
        <h2 id="members-h" className={styles.cardTitle}>
          Members
        </h2>
        <ul className={styles.list}>
          {members.map((m) => {
            const isYou = m.user_id === currentUserId;
            const active = m.deactivated_at === null;
            const isAdmin = m.role === 'admin';
            const demoteGate = canDemote({
              members: guardMembers,
              targetUserId: m.user_id,
            });
            const deactivateGate = canDeactivate({
              members: guardMembers,
              targetUserId: m.user_id,
            });
            const promoteKey = `promote-${m.user_id}`;
            const demoteKey = `demote-${m.user_id}`;
            const deactivateKey = `deactivate-${m.user_id}`;
            const reactivateKey = `reactivate-${m.user_id}`;
            const rowBusy =
              busyKey === promoteKey ||
              busyKey === demoteKey ||
              busyKey === deactivateKey ||
              busyKey === reactivateKey;

            return (
              <li
                key={m.user_id}
                className={`${styles.row} ${active ? '' : styles.rowMuted}`}
              >
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>
                    {memberName(m)}
                    {isYou && <span className={styles.youTag}>You</span>}
                  </span>
                  <span className={styles.rowMeta}>{m.email}</span>
                </div>
                <div className={styles.rowTags}>
                  <span
                    className={`${styles.pill} ${
                      isAdmin ? styles.pillAdmin : styles.pillMember
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'Member'}
                  </span>
                  {!active && (
                    <span className={`${styles.pill} ${styles.pillDeactivated}`}>
                      Deactivated
                    </span>
                  )}
                </div>
                <div className={styles.rowActions}>
                  {active ? (
                    <>
                      {isAdmin ? (
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() =>
                            runRpc('demote_member', m.user_id, demoteKey)
                          }
                          disabled={rowBusy || !demoteGate.allowed}
                          title={!demoteGate.allowed ? demoteGate.reason : undefined}
                        >
                          {busyKey === demoteKey ? 'Working…' : 'Make member'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() =>
                            runRpc('promote_member', m.user_id, promoteKey)
                          }
                          disabled={rowBusy}
                        >
                          {busyKey === promoteKey ? 'Working…' : 'Make admin'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => handleDeactivate(m)}
                        disabled={rowBusy || !deactivateGate.allowed}
                        title={
                          !deactivateGate.allowed ? deactivateGate.reason : undefined
                        }
                      >
                        {busyKey === deactivateKey ? 'Working…' : 'Deactivate'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryBtnSm}
                      onClick={() =>
                        runRpc('reactivate_member', m.user_id, reactivateKey)
                      }
                      disabled={rowBusy || !reactivateGate.allowed}
                      title={
                        !reactivateGate.allowed ? reactivateGate.reason : undefined
                      }
                    >
                      {busyKey === reactivateKey ? 'Working…' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {!reactivateGate.allowed && members.some((m) => m.deactivated_at !== null) && (
          <p className={styles.inlineNote}>{reactivateGate.reason}</p>
        )}
      </section>
    </div>
  );
}

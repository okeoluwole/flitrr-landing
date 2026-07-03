'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import styles from './GateReview.module.css';

/**
 * GateReview - the interactive Gate 1 to 2 screen (M5).
 *
 * Renders the stage-specific checklist and the constant objective lens
 * (framework Sections 5 and 6), and the confirm action that advances the
 * project to Stage 2. The page (server) has already done the evaluation and
 * passes plain values in:
 *   - fundingPresent    the live funding-structure check (the one stage-list
 *                       item that can be outstanding here; everything else is
 *                       guaranteed by the lock, so it is shown as met)
 *   - overConstrained   read from the locked snapshot. When true, the gate
 *                       does not block: it requires an explicit acknowledgement
 *                       before confirm enables.
 *   - decision          non-null when the gate has already passed, which makes
 *                       this a read-only record with no second advance.
 *
 * The gate is deterministic. It advances state, not features: confirming
 * writes the decision and moves current_stage to Stage 2. It builds no Stage 2
 * workspace.
 */

const STAGE_2 = 2;

const FUNDING_OUTSTANDING =
  'Funding structure is not set. Add it in Step 1 Project Definition, then re-lock the Brief.';

const OVER_CONSTRAINT_ACK =
  'This project has no flexible objective. With nothing able to flex, the project is at structural risk of being undeliverable. Tick to acknowledge and proceed.';

const CONFIRM_ERROR =
  'We could not record the gate decision. Please check your connection and try again, or email hello@flitrr.com.';

// The passed_at timestamp shown at day granularity. Pinned to UTC so the
// recorded day reads the same for every viewer and the server-rendered HTML
// matches the client.
function formatLongDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function CheckIcon() {
  return (
    <svg
      className={styles.iconMet}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutstandingIcon() {
  return (
    <svg
      className={styles.iconOut}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.6v4.2M8 11.1v0.05"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A plain checklist row: met (deep-blue check) or outstanding (amber caution
// mark with a pointer to resolve it).
function Item({ label, met, outstanding }) {
  return (
    <li className={`${styles.item} ${met ? styles.itemMet : styles.itemOut}`}>
      {met ? <CheckIcon /> : <OutstandingIcon />}
      <div className={styles.itemText}>
        <span className={styles.itemLabel}>{label}</span>
        {!met && outstanding && (
          <span className={styles.itemDetail}>{outstanding}</span>
        )}
      </div>
    </li>
  );
}

export default function GateReview({
  projectId,
  userId,
  projectName,
  briefHref,
  fundingPresent,
  overConstrained,
  decision,
  deciderName,
  canEdit = true,
  adminContact = null,
}) {
  const supabase = createClient();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Set on a successful confirm so the screen flips to the recorded decision
  // without a navigation. Pre-seeded from the server when already passed.
  const [passed, setPassed] = useState(decision);

  const ackValue = overConstrained ? acknowledged : false;
  // Confirm enables when every stage checklist item is met (only funding can
  // be outstanding here) and, if over-constrained, the acknowledgement is
  // ticked. The lock guarantees the rest.
  const canConfirm = fundingPresent && (!overConstrained || acknowledged);

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    setError(null);

    const nowIso = new Date().toISOString();

    // Write the decision first, then advance the stage. If the advance fails
    // after the decision is written, the project stays at Stage 1 and the
    // confirm can be retried safely (both writes are idempotent on the values).
    const { error: gateErr } = await supabase
      .from('project_stage_gates')
      .update({
        gate_status: 'passed',
        passed_at: nowIso,
        decided_by: userId,
        over_constraint_acknowledged: ackValue,
        objective_lens_confirmed: true,
      })
      .eq('project_id', projectId)
      .eq('stage', 1);
    if (gateErr) {
      setBusy(false);
      setError(CONFIRM_ERROR);
      return;
    }

    const { error: projErr } = await supabase
      .from('projects')
      .update({ current_stage: STAGE_2 })
      .eq('id', projectId);
    if (projErr) {
      setBusy(false);
      setError(CONFIRM_ERROR);
      return;
    }

    setBusy(false);
    setPassed({
      passedAt: nowIso,
      deciderName: deciderName ?? null,
      overConstraintAcknowledged: ackValue,
    });
  };

  const Header = (
    <>
      <Link href={briefHref} className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M9 11L5 7l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to the brief
      </Link>
      <p className={styles.eyebrow}>Stage 1 to 2 gate</p>
      <h1 className={styles.title}>
        Gate 1 to 2: Objectives and Funding to Consultant Appointment
      </h1>
      <p className={styles.projectName}>{projectName}</p>
      {!canEdit && (
        <div className={styles.viewOnly}>
          <ViewOnlyBadge adminContact={adminContact} />
        </div>
      )}
    </>
  );

  // ── Already passed: the recorded decision, read-only, no second advance ──
  if (passed) {
    const passedOn = formatLongDate(passed.passedAt);
    const by = passed.deciderName;
    return (
      <main className={`container ${styles.page}`} id="main-content">
        {Header}
        <div className={`${styles.passedCard} riseIn`}>
          <div className={`${styles.passedBadge} ${styles.badgePop}`}>
            <CheckIcon />
            <span>Gate passed</span>
          </div>
          <p className={styles.passedLine}>
            Gate 1 to 2 passed
            {passedOn ? ` on ${passedOn}` : ''}
            {by ? ` by ${by}` : ''}.
          </p>
          {passed.overConstraintAcknowledged && (
            <p className={styles.passedAck}>Over-constraint acknowledged.</p>
          )}
          <p className={styles.passedStage}>
            This project is now at Stage 2: Consultant Appointment.
          </p>
        </div>
        <div className={styles.afterActions}>
          <Link href={briefHref} className={styles.secondaryCta}>
            Back to the brief
          </Link>
          <Link href="/pulse/app" className={styles.tertiaryLink}>
            Return to projects
          </Link>
        </div>
      </main>
    );
  }

  // ── Actionable: evaluate and confirm ──
  return (
    <main className={`container ${styles.page}`} id="main-content">
      {Header}
      <p className={styles.intro}>
        This is the go decision that closes Stage 1 and opens Stage 2. It is
        read from the locked baseline. Confirming advances the project to Stage
        2 and records the decision. It does not change the baseline.
      </p>

      <div className={styles.groups}>
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Stage checklist</h2>
          <ul className={styles.list}>
            <Item label="Initiation flow complete" met />
            <Item label="Baseline Brief version-locked" met />
            <Item
              label="Funding structure confirmed"
              met={fundingPresent}
              outstanding={FUNDING_OUTSTANDING}
            />
          </ul>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Objective lens</h2>
          <ul className={styles.list}>
            <Item label="Objectives classified and ranked" met />
            {overConstrained ? (
              <li className={`${styles.item} ${styles.itemCaution}`}>
                <OutstandingIcon />
                <div className={styles.itemText}>
                  <span className={styles.itemLabel}>
                    Project not over-constrained
                  </span>
                  {canEdit ? (
                    <label className={styles.ack}>
                      <input
                        type="checkbox"
                        className={styles.ackBox}
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                      />
                      <span className={styles.ackLabel}>
                        {OVER_CONSTRAINT_ACK}
                      </span>
                    </label>
                  ) : (
                    // Read-only for a member: the caution without the tick to
                    // acknowledge, which only an admin can do.
                    <span className={styles.itemDetail}>
                      This project has no flexible objective. With nothing able
                      to flex, the project is at structural risk of being
                      undeliverable.
                    </span>
                  )}
                </div>
              </li>
            ) : (
              <Item label="Project not over-constrained" met />
            )}
          </ul>
        </section>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {canEdit ? (
        <div className={styles.confirmBar}>
          {!fundingPresent && (
            <span className={styles.confirmHint}>
              Funding structure must be confirmed before this gate can pass.
            </span>
          )}
          {fundingPresent && overConstrained && !acknowledged && (
            <span className={styles.confirmHint}>
              Acknowledge the over-constraint caution to proceed.
            </span>
          )}
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
          >
            {busy ? 'Confirming…' : 'Confirm gate and advance to Stage 2'}
          </button>
        </div>
      ) : (
        // The gate decision is an admin action. A member sees the checklist
        // read-only with one sparse line in place of the confirm bar.
        <p className={styles.memberNote}>Only an admin can confirm this gate.</p>
      )}
    </main>
  );
}

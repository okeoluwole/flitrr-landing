'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { assembleBrief } from './briefModel';
import { checkCompleteness } from './briefCompleteness';
import { LENSES, DEFAULT_LENS } from './briefLens';
import BriefDocument from './BriefDocument';
import wizard from './InitiationWizard.module.css';
import styles from './Brief.module.css';

/**
 * Step 9, Generated Brief. The keystone of initiation: it assembles the
 * brief from the project's data, renders it under a selectable audience
 * lens, and locks it as the version-controlled baseline.
 *
 * This step is more self-contained than Steps 1 to 7: it reads everything
 * the earlier steps produced (passed in as the wizard's live state) and
 * writes only to project_briefs and the project's status. So it owns its own
 * lock state and persistence here, rather than threading it through the
 * shell.
 *
 *   - The live preview is assembled from the wizard's current in-memory
 *     state, so it reflects edits to earlier steps immediately.
 *   - On lock, the assembled model is snapshotted as JSON into
 *     project_briefs (version incremented, is_locked true), and the project
 *     moves from draft to active. current_stage is untouched here: advancing
 *     to Stage 2 is the Stage 1 to 2 gate's decision (the gate screen, M5),
 *     not the lock.
 *   - A locked brief renders its stored snapshot read-only until unlocked.
 *     Unlock flips the latest row's lock flag and returns to the live
 *     preview; re-locking writes the next version, preserving history. Once
 *     the Stage 1 to 2 gate has passed (the project is at Stage 2), unlock is
 *     blocked: revising a committed baseline is a re-baseline (not yet built).
 *   - The lens (order, summary, financial gating) applies to both the live
 *     preview and the locked rendering.
 */

const LOCK_ERROR =
  'We could not lock the baseline. Please check your connection and try again, or email hello@flitrr.com.';
const STATUS_ERROR =
  'The baseline was locked, but we could not set the project to active. It is safe to lock again, or email hello@flitrr.com.';
const UNLOCK_ERROR =
  'We could not unlock the brief. Please check your connection and try again.';

export default function StepGeneratedBrief({
  projectId,
  supabase,
  def,
  ctx,
  objectives,
  rankOrder,
  lists,
  scope,
  org,
  stakeholders,
  financial,
  gates,
  currentStage = 1,
}) {
  const [lens, setLens] = useState(DEFAULT_LENS);
  const [briefRow, setBriefRow] = useState(null);
  const [briefStatus, setBriefStatus] = useState('idle'); // idle | loading | loaded | error
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const loadStartedRef = useRef(null);

  // The live brief, assembled from the wizard's current state. Recomputed
  // only when a source changes, so switching lenses is free.
  const liveModel = useMemo(
    () =>
      assembleBrief({
        def,
        ctx,
        objectives,
        rankOrder,
        lists,
        scope,
        org,
        stakeholders,
        financial,
        gates,
      }),
    [def, ctx, objectives, rankOrder, lists, scope, org, stakeholders, financial, gates]
  );

  // Completeness gate (M3.6): decides whether the brief may be locked. It runs
  // on the same live state the preview is built from, but it gates only the
  // lock action. Drafting and the live preview stay permissive.
  const completeness = useMemo(
    () => checkCompleteness({ def, ctx, objectives, rankOrder, lists }),
    [def, ctx, objectives, rankOrder, lists]
  );
  const canLock = completeness.canLock;
  const requiredMissing = completeness.required.filter((r) => !r.ok);
  const recommendedMissing = completeness.recommended.filter((r) => !r.ok);

  // Load the latest brief row (the highest version) to learn the lock state.
  const loadBrief = async () => {
    if (!projectId) return;
    setBriefStatus('loading');
    const { data, error: selErr } = await supabase
      .from('project_briefs')
      .select('id, version, content, is_locked, generated_at')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) {
      setBriefStatus('error');
      return;
    }
    setBriefRow(data ?? null);
    setBriefStatus('loaded');
  };

  useEffect(() => {
    if (!projectId) return;
    if (loadStartedRef.current === projectId) return;
    loadStartedRef.current = projectId;
    loadBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const locked = briefRow?.is_locked === true;

  // Once the Stage 1 to 2 gate has passed, the project sits at Stage 2. Past
  // that point the baseline is committed: unlock is blocked (a re-baseline is
  // not yet built), and the gate entry point opens the recorded decision.
  const postGate = currentStage >= 2;

  // What renders: the locked snapshot when locked, otherwise the live model.
  const model = locked ? briefRow.content : liveModel;
  const lockState = locked
    ? { locked: true, version: briefRow.version, generatedAt: briefRow.generated_at }
    : { locked: false, version: briefRow?.version ?? null, generatedAt: null };

  const lockBaseline = async () => {
    // Belt-and-braces: the control is already disabled while the spine is
    // incomplete. The gate sits on the lock action only.
    if (!canLock) return;
    setBusy(true);
    setError(null);

    // Read the current max version fresh, so a second tab cannot make us
    // reuse a version (the unique constraint would otherwise reject it).
    const { data: maxRow, error: maxErr } = await supabase
      .from('project_briefs')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      setBusy(false);
      setError(LOCK_ERROR);
      return;
    }

    const nextVersion = (maxRow?.version ?? 0) + 1;
    const generatedAt = new Date().toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('project_briefs')
      .insert({
        project_id: projectId,
        version: nextVersion,
        content: liveModel,
        is_locked: true,
        generated_at: generatedAt,
      })
      .select('id, version, content, is_locked, generated_at')
      .single();
    if (insErr || !inserted) {
      setBusy(false);
      setError(LOCK_ERROR);
      return;
    }

    // Move the project from draft to active. A failure here should not strand
    // the successfully written baseline, so we keep the locked brief and only
    // surface a soft notice.
    const { error: updErr } = await supabase
      .from('projects')
      .update({ status: 'active' })
      .eq('id', projectId);

    setBriefRow(inserted);
    setBusy(false);
    if (updErr) setError(STATUS_ERROR);
  };

  const unlockToRevise = async () => {
    if (!briefRow) return;
    setBusy(true);
    setError(null);
    const { error: updErr } = await supabase
      .from('project_briefs')
      .update({ is_locked: false })
      .eq('id', briefRow.id);
    if (updErr) {
      setBusy(false);
      setError(UNLOCK_ERROR);
      return;
    }
    setBriefRow({ ...briefRow, is_locked: false });
    setBusy(false);
  };

  // Export the brief as a PDF via the browser's print-to-PDF. The print
  // stylesheet hides the app chrome and prints the document only, exactly as
  // shown, so the export reflects the current lens and its figure gating and
  // whether it is the locked baseline or the live preview. document.title is
  // set first so the saved file gets a sensible name, then restored after.
  const handleDownloadPdf = () => {
    if (typeof window === 'undefined') return;
    const lensLabel = LENSES.find((l) => l.key === lens)?.label ?? 'Brief';
    const name = (model?.identity?.name || 'PULSE brief').trim();
    const previousTitle = document.title;
    document.title = `${name}, ${lensLabel} brief`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const Header = (
    <>
      <p className={wizard.panelEyebrow}>Step 9 of 9</p>
      <h2 className={wizard.panelHeading}>Generated Brief</h2>
    </>
  );

  if (briefStatus === 'idle' || briefStatus === 'loading') {
    return (
      <>
        {Header}
        <p className={styles.loading}>Assembling the brief…</p>
      </>
    );
  }

  if (briefStatus === 'error') {
    return (
      <>
        {Header}
        <p className={styles.intro}>
          We could not load this brief. Please check your connection and try
          again.
        </p>
        <button
          type="button"
          className={`${styles.lockBtn} ${styles.unlockBtn}`}
          onClick={() => {
            loadStartedRef.current = null;
            loadBrief();
          }}
        >
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      {Header}
      <p className={styles.intro}>
        This is the baseline brief, assembled from everything you have set.
        Switch the audience lens to see how it reframes for a lender, a JV
        partner, or a design consultant. Lock it to set the version-controlled
        baseline that governs every later stage.
      </p>

      <div className={styles.controlBar}>
        <div className={styles.lens}>
          <span className={styles.lensLabel}>View as</span>
          <div className={styles.seg} role="group" aria-label="Brief audience">
            {LENSES.map((l) => (
              <button
                key={l.key}
                type="button"
                className={`${styles.segBtn} ${lens === l.key ? styles.segBtnActive : ''}`}
                aria-pressed={lens === l.key}
                onClick={() => setLens(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={handleDownloadPdf}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2.5v6.5M5 6l3 3 3-3M3.5 13h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
        </div>

        <div className={styles.actions}>
          {locked && postGate ? (
            // Post-gate: the baseline is committed, so unlock is blocked.
            <span className={styles.lockHint}>
              The baseline is committed. Revising a committed baseline is a
              re-baseline, which is not yet available.
            </span>
          ) : (
            <>
              <span className={styles.lockHint}>
                {locked
                  ? 'Unlock to revise earlier steps, then lock again to save a new version.'
                  : canLock
                    ? 'Locking writes a version-controlled baseline and sets the project active.'
                    : 'Some required items are missing. Complete the checklist below to lock.'}
              </span>
              <button
                type="button"
                className={`${styles.lockBtn} ${locked ? styles.unlockBtn : ''}`}
                onClick={locked ? unlockToRevise : lockBaseline}
                disabled={busy || (!locked && !canLock)}
              >
                {busy
                  ? locked
                    ? 'Unlocking…'
                    : 'Locking…'
                  : locked
                    ? 'Unlock to revise'
                    : 'Lock baseline'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stage 1 to 2 gate entry point. Sits with the lock controls. Disabled
          until the baseline is locked; active once it is; and a link to the
          recorded decision once the gate has passed. */}
      <div className={styles.gateEntry}>
        <div className={styles.gateEntryText}>
          <span className={styles.gateEntryTitle}>Stage 1 to 2 gate</span>
          <span className={styles.gateEntryNote}>
            {!locked
              ? 'Lock the Brief to open the Stage 1 to 2 gate.'
              : postGate
                ? 'Gate passed. This project is at Stage 2: Consultant Appointment.'
                : 'The baseline is locked. Open the gate to advance to Stage 2.'}
          </span>
        </div>
        {locked ? (
          <Link
            href={`/pulse/app/gate?project=${projectId}`}
            className={styles.gateEntryBtn}
          >
            {postGate
              ? 'View the Stage 1 to 2 gate decision'
              : 'Open the Stage 1 to 2 gate'}
          </Link>
        ) : (
          <span
            className={`${styles.gateEntryBtn} ${styles.gateEntryBtnDisabled}`}
            aria-disabled="true"
          >
            Open the Stage 1 to 2 gate
          </span>
        )}
      </div>

      {!locked && (
        <div className={styles.gate}>
          {requiredMissing.length > 0 ? (
            <div className={styles.gateSection}>
              <div className={styles.gateSectionHead}>
                <span className={`${styles.gateBadge} ${styles.gateBadgeReq}`}>
                  Required to lock
                </span>
                <span className={styles.gateNote}>
                  Complete these to lock the baseline.
                </span>
              </div>
              <ul className={styles.gateList}>
                {requiredMissing.map((item) => (
                  <li key={item.key} className={styles.gateItem}>
                    <svg
                      className={styles.gateIconReq}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                    >
                      <circle cx="7" cy="7" r="3.25" fill="currentColor" />
                    </svg>
                    <span className={styles.gateLabel}>
                      {item.label}
                      {item.detail ? (
                        <span className={styles.gateDetail}> ({item.detail})</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.gateSatisfied}>
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                The required spine is complete. You can lock the baseline.
              </span>
            </div>
          )}

          {recommendedMissing.length > 0 && (
            <div className={styles.gateSection}>
              <div className={styles.gateSectionHead}>
                <span className={`${styles.gateBadge} ${styles.gateBadgeRec}`}>
                  Recommended
                </span>
                <span className={styles.gateNote}>
                  Optional. These do not block locking.
                </span>
              </div>
              <ul className={styles.gateList}>
                {recommendedMissing.map((item) => (
                  <li key={item.key} className={styles.gateItem}>
                    <svg
                      className={styles.gateIconRec}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      aria-hidden="true"
                    >
                      <circle
                        cx="7"
                        cy="7"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className={styles.gateLabel}>
                      {item.label}
                      {item.detail ? (
                        <span className={styles.gateDetail}> ({item.detail})</span>
                      ) : null}
                      {item.note ? (
                        <span className={styles.gateItemNote}>{item.note}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={styles.briefError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.scroll}>
        <BriefDocument model={model} lens={lens} lockState={lockState} />
      </div>
    </>
  );
}

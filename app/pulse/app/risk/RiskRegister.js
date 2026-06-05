'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import {
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
  STATUS_OPTIONS,
  deriveSeverity,
  sortRisks,
  isCritical,
} from './riskModel';
import styles from './RiskRegister.module.css';

/**
 * RiskRegister (M6.1) - the living register, the default view of the Risk
 * section. Lists the project's risks, each scored in plain language, given a
 * status and a one-line response, reviewed, and closed.
 *
 * Every developer action (scoring, status, note) writes to project_risks and
 * stamps last_reviewed_at to now (M6.2 reads that timestamp). Writes are
 * optimistic: the change shows immediately and reverts on a failure. Severity
 * is derived, never stored. The critical count reuses the Brief's definition
 * (the criticality column) so it agrees with the Brief's Critical risks KPI.
 *
 * Out of scope here (M6.2): the attention surface, the posture read, the
 * triggers, the all-quiet state, the starter proposal. This is the substrate.
 */

const LIKELIHOOD_QUESTION = 'How likely is this, really?';
const IMPACT_QUESTION = 'If it happened, how bad?';
const NOTE_PLACEHOLDER = 'Add a one-line response.';

const SAVE_ERROR =
  'We could not save that change. Please check your connection and try again.';

const CRITICALITY_LABEL = { critical: 'Critical', standard: 'Standard' };

const SEVERITY_CLASS = {
  serious: 'sevSerious',
  moderate: 'sevModerate',
  minor: 'sevMinor',
  unscored: 'sevUnscored',
};

function formatReviewed(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// A plain-language segmented control. One option active, single select.
function Segmented({ options, value, onSelect, ariaLabel }) {
  return (
    <div className={styles.seg} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.segBtn} ${value === o.value ? styles.segBtnActive : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onSelect(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SeverityChip({ severity }) {
  return (
    <span className={`${styles.sev} ${styles[SEVERITY_CLASS[severity.key]]}`}>
      {severity.label}
    </span>
  );
}

export default function RiskRegister({
  projectId,
  projectName,
  workspaceHref,
  initialRisks,
  objectivesById,
}) {
  const supabase = createClient();
  const [risks, setRisks] = useState(initialRisks);
  const [noteDrafts, setNoteDrafts] = useState(() =>
    Object.fromEntries(initialRisks.map((r) => [r.id, r.response_note ?? '']))
  );
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState(null);

  // Critical count is over the whole set (including closed), by the Brief's
  // definition, so it equals the Brief's Critical risks KPI.
  const criticalCount = risks.filter(isCritical).length;

  const active = sortRisks(risks.filter((r) => r.status !== 'closed'));
  const closed = sortRisks(risks.filter((r) => r.status === 'closed'));

  // Optimistic write: apply locally, stamp last_reviewed_at, persist, revert
  // on failure. Every action routes through here so the review stamp is never
  // forgotten.
  const applyUpdate = async (id, patch) => {
    const prev = risks.find((r) => r.id === id);
    if (!prev) return;
    const nowIso = new Date().toISOString();
    const stamped = { ...patch, last_reviewed_at: nowIso };
    setRisks((rs) => rs.map((r) => (r.id === id ? { ...r, ...stamped } : r)));
    setError(null);

    const { error: updErr } = await supabase
      .from('project_risks')
      .update(stamped)
      .eq('id', id);
    if (updErr) {
      setRisks((rs) => rs.map((r) => (r.id === id ? prev : r)));
      setError(SAVE_ERROR);
    }
  };

  const setLikelihood = (id, value) => applyUpdate(id, { likelihood: value });
  const setImpact = (id, value) => applyUpdate(id, { impact: value });
  const setStatus = (id, value) => applyUpdate(id, { status: value });

  const onNoteChange = (id, value) =>
    setNoteDrafts((d) => ({ ...d, [id]: value }));

  const saveNote = (id) => {
    const clean = (noteDrafts[id] ?? '').trim();
    setNoteDrafts((d) => ({ ...d, [id]: clean }));
    applyUpdate(id, { response_note: clean === '' ? null : clean });
  };

  const renderCard = (r) => {
    const critical = isCritical(r);
    const severity = deriveSeverity(r.likelihood, r.impact);
    const objective = r.linked_objective_id
      ? objectivesById[r.linked_objective_id]?.name ?? 'Unlinked'
      : 'Unlinked';
    const reviewed = formatReviewed(r.last_reviewed_at);
    const noteDirty = (noteDrafts[r.id] ?? '') !== (r.response_note ?? '');

    return (
      <article
        key={r.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <span
              className={`${styles.crit} ${critical ? styles.critCritical : styles.critStandard}`}
            >
              {CRITICALITY_LABEL[r.criticality] ?? 'Standard'}
            </span>
            <span className={styles.objective}>
              {objective === 'Unlinked' ? 'Unlinked' : `vs ${objective}`}
            </span>
          </div>
          <SeverityChip severity={severity} />
        </div>

        <p className={styles.riskName}>{r.description}</p>

        <div className={styles.scoring}>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>{LIKELIHOOD_QUESTION}</span>
            <Segmented
              options={LIKELIHOOD_OPTIONS}
              value={r.likelihood}
              onSelect={(v) => setLikelihood(r.id, v)}
              ariaLabel={`Likelihood for ${r.description}`}
            />
          </div>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>{IMPACT_QUESTION}</span>
            <Segmented
              options={IMPACT_OPTIONS}
              value={r.impact}
              onSelect={(v) => setImpact(r.id, v)}
              ariaLabel={`Impact for ${r.description}`}
            />
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Status</span>
            <Segmented
              options={STATUS_OPTIONS}
              value={r.status}
              onSelect={(v) => setStatus(r.id, v)}
              ariaLabel={`Status for ${r.description}`}
            />
          </div>
          <div className={styles.controlRow}>
            <label className={styles.controlLabel} htmlFor={`note-${r.id}`}>
              Response
            </label>
            <div className={styles.noteField}>
              <input
                id={`note-${r.id}`}
                type="text"
                className={styles.noteInput}
                value={noteDrafts[r.id] ?? ''}
                onChange={(e) => onNoteChange(r.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveNote(r.id);
                  }
                }}
                placeholder={NOTE_PLACEHOLDER}
                autoComplete="off"
                maxLength={200}
              />
              {noteDirty && (
                <button
                  type="button"
                  className={styles.noteSave}
                  onClick={() => saveNote(r.id)}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cardFoot}>
          <span className={styles.reviewed}>
            {reviewed ? `Last reviewed ${reviewed}` : 'Not yet reviewed'}
          </span>
        </div>
      </article>
    );
  };

  return (
    <main className={`container ${styles.page}`} id="main-content">
      <Link href={workspaceHref} className={styles.backLink}>
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
        Back to the project
      </Link>
      <p className={styles.eyebrow}>Risk module</p>
      <h1 className={styles.title}>Risk register</h1>
      <p className={styles.projectName}>{projectName}</p>

      <div className={styles.summary}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{active.length}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.statCritical}`}>
            {criticalCount}
          </span>
          <span className={styles.statLabel}>Critical</span>
        </div>
        {closed.length > 0 && (
          <button
            type="button"
            className={styles.closedToggle}
            aria-pressed={showClosed}
            onClick={() => setShowClosed((v) => !v)}
          >
            {showClosed
              ? `Hide closed (${closed.length})`
              : `Show closed (${closed.length})`}
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {risks.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No risks captured yet. Risks added in the initiation flow appear
            here for monitoring.
          </p>
        </div>
      ) : active.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Every risk is closed. Use Show closed to review them.
          </p>
        </div>
      ) : (
        <div className={styles.list}>{active.map(renderCard)}</div>
      )}

      {showClosed && closed.length > 0 && (
        <section className={styles.closedSection}>
          <h2 className={styles.closedHeading}>Closed</h2>
          <div className={styles.list}>{closed.map(renderCard)}</div>
        </section>
      )}
    </main>
  );
}

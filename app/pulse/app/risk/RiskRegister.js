'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import {
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
  STATUS_OPTIONS,
  sortRisks,
  isCritical,
} from './riskModel';
import { deriveSeverity } from '../../../../lib/engine/severity';
import {
  splitProposals,
  buildRiskFromPlay,
} from '../../../../lib/playbook/playbookModel';
import styles from './RiskRegister.module.css';

/**
 * RiskRegister (M6.1 + M7.4) - the living register, the default view of the
 * Risk section. Lists the project's risks, each scored in plain language,
 * given a status and a one-line response, reviewed, and closed.
 *
 * Every developer action (scoring, status, note) writes to project_risks and
 * stamps last_reviewed_at to now (M6.2 reads that timestamp). Writes are
 * optimistic: the change shows immediately and reverts on a failure. Severity
 * is derived, never stored. The critical count reuses the Brief's definition
 * (the criticality column) so it agrees with the Brief's Critical risks KPI.
 *
 * M7.4 adds the suggestions area: curated risk plays for the current stage,
 * each derived critical or standard by this project's own classification,
 * with Add to register and Dismiss. An accepted play becomes an ordinary
 * register row (medium and medium by the register's default convention, not
 * yet reviewed) and behaves as any risk from there, including qualifying for
 * the Action Log's needs-your-response band. The register's own behaviour is
 * otherwise untouched.
 *
 * Out of scope here (M6.2): the attention surface, the posture read, the
 * triggers, the all-quiet state, the starter proposal. This is the substrate.
 */

const LIKELIHOOD_QUESTION = 'How likely is this, really?';
const IMPACT_QUESTION = 'If it happened, how bad?';
const NOTE_PLACEHOLDER = 'Add a one-line response.';

const SAVE_ERROR =
  'We could not save that change. Please check your connection and try again.';
const ACCEPT_PLAY_ERROR =
  'We could not add that suggestion. Please check your connection and try again.';
const DISMISS_PLAY_ERROR =
  'We could not dismiss that suggestion. Please check your connection and try again.';

const CRITICALITY_LABEL = { critical: 'Critical', standard: 'Standard' };

// The columns the page select returns; an accepted suggestion's returning
// row carries the same shape so it renders as any other risk card.
const RISK_COLUMNS =
  'id, description, criticality, linked_objective_id, likelihood, impact, status, last_reviewed_at, response_note';

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
  playSuggestions,
}) {
  const supabase = createClient();
  const [risks, setRisks] = useState(initialRisks);
  const [noteDrafts, setNoteDrafts] = useState(() =>
    Object.fromEntries(initialRisks.map((r) => [r.id, r.response_note ?? '']))
  );
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState(null);

  // The suggestions area (M7.4): plays acted on this session leave the area
  // immediately; the server already excluded previously acted pairs.
  const [actedPlayIds, setActedPlayIds] = useState(() => new Set());
  const [actingPlayId, setActingPlayId] = useState(null);
  const [showAllPlays, setShowAllPlays] = useState(false);

  const livePlays = (playSuggestions ?? []).filter(
    (s) => !actedPlayIds.has(s.playId)
  );
  const { top: topPlays, rest: restPlays } = splitProposals(livePlays);
  const visiblePlays = showAllPlays ? livePlays : topPlays;

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

  // Add to register (M7.4): accept a suggested risk play. The new row lands
  // at the register's default convention (medium and medium, watching, not
  // yet reviewed) and the suggestion leaves the area in the same
  // interaction. Deliberately NOT routed through applyUpdate: accepting a
  // suggestion is not a review, so last_reviewed_at stays null.
  const acceptPlay = async (suggestion) => {
    if (actingPlayId) return;
    setActingPlayId(suggestion.playId);
    setError(null);

    const { data, error: insErr } = await supabase
      .from('project_risks')
      .insert(buildRiskFromPlay(suggestion, projectId))
      .select(RISK_COLUMNS)
      .single();

    if (insErr || !data) {
      setError(ACCEPT_PLAY_ERROR);
      setActingPlayId(null);
      return;
    }

    const { error: stateErr } = await supabase
      .from('project_playbook_state')
      .insert({
        project_id: projectId,
        play_id: suggestion.playId,
        state: 'accepted',
      });
    if (stateErr) setError(SAVE_ERROR);

    setRisks((rs) => [...rs, data]);
    setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    setActingPlayId(null);
  };

  // Dismiss (M7.4): records dismissed for this project. Dismissed stays
  // dismissed; no re-nagging.
  const dismissPlay = async (suggestion) => {
    if (actingPlayId) return;
    setActingPlayId(suggestion.playId);
    setError(null);

    const { error: stateErr } = await supabase
      .from('project_playbook_state')
      .insert({
        project_id: projectId,
        play_id: suggestion.playId,
        state: 'dismissed',
      });

    if (stateErr) {
      setError(DISMISS_PLAY_ERROR);
    } else {
      setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    }
    setActingPlayId(null);
  };

  // One suggested risk play: the title, the why line in full (never
  // truncated), a Critical chip when this project's classification derives
  // it critical, and the two one-tap responses.
  const renderPlaySuggestion = (s) => {
    const acting = actingPlayId === s.playId;

    return (
      <article key={s.playId} className={styles.playItem}>
        {s.criticality === 'critical' && (
          <div className={styles.playTags}>
            <span className={`${styles.crit} ${styles.critCritical}`}>
              Critical
            </span>
          </div>
        )}
        <p className={styles.playTitle}>{s.title}</p>
        <p className={styles.why}>{s.why}</p>
        <div className={styles.playActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => acceptPlay(s)}
            disabled={actingPlayId !== null}
            aria-label={`Add to register: ${s.title}`}
          >
            {acting ? 'Adding' : 'Add to register'}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => dismissPlay(s)}
            disabled={actingPlayId !== null}
            aria-label={`Dismiss: ${s.title}`}
          >
            Dismiss
          </button>
        </div>
      </article>
    );
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
        id={`risk-${r.id}`}
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
                  className={`${styles.noteSave} riseInSm`}
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

      {/* The suggestions area (M7.4): stage-keyed curated risk plays, top
          five up front. When none remain it is simply gone: suggestions are
          offered knowledge, not a status. */}
      {livePlays.length > 0 && (
        <section
          className={styles.suggestBand}
          aria-labelledby="pulse-suggests"
        >
          <h2 id="pulse-suggests" className={styles.bandHeading}>
            PULSE suggests
          </h2>
          <div className={styles.bandList}>
            {visiblePlays.map(renderPlaySuggestion)}
          </div>
          {!showAllPlays && restPlays.length > 0 && (
            <button
              type="button"
              className={`${styles.ghostBtn} ${styles.showAll}`}
              onClick={() => setShowAllPlays(true)}
            >
              Show all ({livePlays.length})
            </button>
          )}
        </section>
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

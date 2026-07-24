'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import {
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
  STATUS_OPTIONS,
  sortRisks,
  isLiveCritical,
} from './riskModel';
import { deriveSeverity, severityLegend } from '../../../../lib/engine/severity';
import { assessRisks } from '../../../../lib/engine/monitor';
import {
  escalationsByRisk,
  buildScoredEvent,
} from '../../../../lib/engine/riskEvents';
import {
  statusLine,
  escalationLine,
  queueHeading,
  riskProvenance,
  isFromBrief,
  objectiveRelation,
  ATTENTION_QUIET,
} from './registerRead';
import {
  splitProposals,
  buildRiskFromPlay,
  confirmedPlayCriticality,
} from '../../../../lib/playbook/playbookModel';
import { toStoredCriticality } from '../../../../lib/engine/criticality';
import {
  recordTriageDecision,
  TRIAGE_DECISIONS,
  TRIAGE_SURFACES,
} from '../actions/triageDecisionStore';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import CriticalityChip from '../components/CriticalityChip';
import styles from './RiskRegister.module.css';

/**
 * RiskRegister (M6.1 + M7.4) - the living register, the default view of the
 * Risk section. Lists the project's risks, each scored in plain language,
 * given a status and a one-line response, reviewed, and closed.
 *
 * Every developer action (scoring, status, note) writes to project_risks and
 * stamps last_reviewed_at to now (M6.2 reads that timestamp). Writes are
 * optimistic: the change shows immediately and reverts on a failure. Severity
 * is derived, never stored. Criticality is derived live from each risk's linked
 * objective (B1), so the chip, the critical count, and the order all follow the
 * current classification rather than the snapshot stamped at the wizard.
 *
 * M7.4 adds the suggestions area: curated risk plays for the current stage,
 * each derived critical or standard by this project's own classification,
 * with Add to register and Dismiss. An accepted play becomes an ordinary
 * register row (medium and medium by the register's default convention, not
 * yet reviewed) and behaves as any risk from there, including qualifying for
 * the Action Log's needs-your-response band. The register's own behaviour is
 * otherwise untouched.
 *
 * B2 wires the monitor in (lib/engine/monitor.js): the first-review queue at
 * the top renders the risks the monitor flags, each with its severity and its
 * live criticality. The verdicts are computed by assessRisks (unchanged from
 * A7) from the same live `risks` state that drives the list, ordered most
 * urgent first by the engine, and collapse to one calm line when nothing is
 * flagged. Proportional monitoring stays quiet when things are fine; it does
 * not nag.
 *
 * WHAT NOTE 19 CHANGED, AND WHAT IT DID NOT. No derivation moved. The triggers,
 * the windows, ESCALATION_CONFIG, the severity bands and the criticality kernel
 * are all exactly as they were, and the six assessments still match the Brief's
 * matrix. Three things about the telling changed:
 *
 *   THE NARRATIVE IS EVENT-SOURCED. Five of six cards read "Severity has
 *   escalated." on a register that had never been reviewed and recorded no
 *   change at all. That sentence came from a LEVEL trigger worded as a CHANGE.
 *   The level is still worth saying and is now said as a level; the escalation
 *   sentence renders only from a recorded band-raising event in
 *   project_risk_events, citing from, to, when and who. On the seeded register
 *   it renders nowhere, which is the correct answer.
 *
 *   ONE STATUS LINE PER CARD. The panel stacked every fired trigger as its own
 *   bullet, so three lines said one thing. registerRead.statusLine picks the
 *   single most actionable fact. The panel is headed as what it is, a queue of
 *   risks awaiting first review, with the provenance of what is in it.
 *
 *   AN HONEST SUGGESTION. A play wears no criticality chip until the developer
 *   confirms the objective it threatens, because criticality derives from that
 *   link; it states its basis instead. Add to register and Dismiss both record
 *   a decision with who and when.
 *
 * The assessment card itself is deliberately untouched: the two questions, the
 * status vocabulary and the one-line Response are the reference interaction,
 * preserved for the later design sweep.
 */

const LIKELIHOOD_QUESTION = 'How likely is this, really?';
const IMPACT_QUESTION = 'If it happened, how bad?';
const NOTE_PLACEHOLDER = 'Add a one-line response.';
const DISMISS_REASON_PLACEHOLDER = 'Why are you setting this aside?';

const SAVE_ERROR =
  'We could not save that change. Please check your connection and try again.';
const ACCEPT_PLAY_ERROR =
  'We could not add that suggestion. Please check your connection and try again.';
const DISMISS_PLAY_ERROR =
  'We could not dismiss that suggestion. Please check your connection and try again.';

// The columns the page select returns; an accepted suggestion's returning
// row carries the same shape so it renders as any other risk card.
const RISK_COLUMNS =
  'id, description, criticality, linked_objective_id, likelihood, impact, status, last_reviewed_at, response_note, source, source_id';

const LEGEND = severityLegend();

const SEVERITY_CLASS = {
  serious: 'sevSerious',
  moderate: 'sevModerate',
  minor: 'sevMinor',
  unscored: 'sevUnscored',
};

// The display label for a segmented value, for the read-only member card where
// the segmented control is replaced by the settled value.
function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? null;
}

// The last_reviewed_at timestamp shown at day granularity. Pinned to UTC so
// the reviewed day reads the same for every viewer and the server-rendered
// HTML matches the client.
function formatReviewed(iso) {
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

// The status line and the escalation sentence both live in registerRead.js, so
// the copy is pure and unit-testable rather than only reviewable by eye. The
// band label map is passed to escalationLine, keeping display strings out of
// the engine.
const BAND_LABEL = {
  serious: 'Serious',
  moderate: 'Worth watching',
  minor: 'Minor',
  unscored: 'Not yet scored',
};

// The severity legend: the derivation stated once, so the bands read rather
// than have to be learned. Built from the engine, so it cannot drift from the
// rule it explains.
function SeverityLegend() {
  return (
    <p className={styles.legend}>
      <span className={styles.legendLead}>{LEGEND.lead}</span>
      {LEGEND.bands.map((b) => (
        <span key={b.key} className={styles.legendBand}>
          {b.label} {b.range}
        </span>
      ))}
    </p>
  );
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

/**
 * The objective link select for the Add to register confirmation. Each option
 * carries the objective's classification, so the developer sees at the moment
 * of linking what the cascade will make of it. The same idiom the Action Log
 * uses, so confirming a suggestion reads the same on both surfaces.
 */
function ObjectiveSelect({ value, onChange, options, ariaLabel }) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">No objective</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
          {o.classification === 'non_negotiable'
            ? ' (Non-negotiable)'
            : ' (Flexible)'}
        </option>
      ))}
    </select>
  );
}

/**
 * The read-only criticality line in the Add to register confirmation (Note 19.3).
 * Criticality is derived from the objective a risk threatens and is never
 * chosen, so the confirmation states it rather than offering it.
 */
function inheritedCriticalityLine(criticality, objectiveName, alwaysCritical) {
  if (alwaysCritical) return 'Critical on every project at this stage.';
  const label = criticality === 'critical' ? 'Critical' : 'Standard';
  return objectiveName
    ? `${label}, inherited from ${objectiveName}.`
    : 'Standard. No objective linked.';
}

export default function RiskRegister({
  projectId,
  projectName,
  workspaceHref,
  initialRisks,
  objectivesById,
  playSuggestions,
  riskEvents = [],
  actorNames = {},
  userId = null,
  now,
  canEdit = true,
  adminContact = null,
}) {
  const supabase = createClient();
  const [risks, setRisks] = useState(initialRisks);

  // The recorded changes (Note 19). Seeded from the server read and appended to
  // as the developer rescores, so an escalation shows on the card in the same
  // interaction that recorded it. A register that has recorded nothing holds an
  // empty list, and no escalation line renders anywhere.
  const [events, setEvents] = useState(riskEvents);
  const escalations = escalationsByRisk(events);
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

  // The Add to register confirmation and the Dismiss reason (Note 18's grammar,
  // applied here by Note 19.3). Criticality is never chosen in the confirm step;
  // it derives from the objective the developer agrees the play threatens.
  const [confirmingPlayId, setConfirmingPlayId] = useState(null);
  const [playObjectiveId, setPlayObjectiveId] = useState('');
  const [dismissingPlayId, setDismissingPlayId] = useState(null);
  const [dismissReason, setDismissReason] = useState('');

  const livePlays = (playSuggestions ?? []).filter(
    (s) => !actedPlayIds.has(s.playId)
  );
  const { top: topPlays, rest: restPlays } = splitProposals(livePlays);
  const visiblePlays = showAllPlays ? livePlays : topPlays;

  // Critical count is over the whole set (including closed), derived live from
  // each risk's linked objective (B1), so it tracks the current classification.
  const criticalCount = risks.filter((r) =>
    isLiveCritical(r, objectivesById)
  ).length;

  const active = sortRisks(
    risks.filter((r) => r.status !== 'closed'),
    objectivesById
  );
  const closed = sortRisks(
    risks.filter((r) => r.status === 'closed'),
    objectivesById
  );

  // The needs-attention surface (B2): the monitor's verdicts over the live
  // rows, with the clock the server supplied. Recomputed every render from the
  // same `risks` state that drives the list and its chips, so the panel and the
  // list never disagree and an edit that clears a trigger (a review, a
  // response, closing it) drops the row at once. assessRisks already orders
  // most urgent first (compareAssessments); the filter keeps that order and
  // drops closed risks, which the monitor never flags.
  const needsAttention = assessRisks(risks, objectivesById, now).filter(
    (v) => v.assessment.needsAttention
  );

  // What the queue actually holds, for its heading (Note 19.2). Both counts are
  // read off the queue itself rather than assumed: how many are waiting on a
  // first review, and how many came out of the Brief (migration 032). A
  // first-run register is six Brief risks nobody has looked at yet, which is a
  // queue to work through, not six problems.
  const awaitingFirstReview = needsAttention.filter(
    (v) => !v.risk.last_reviewed_at
  ).length;
  const queueFromBrief = needsAttention.filter((v) => isFromBrief(v.risk)).length;
  const queueLine = queueHeading({
    total: needsAttention.length,
    awaitingFirstReview,
    fromBrief: queueFromBrief,
  });

  // The objectives a suggestion can be linked to, in the shape the confirm
  // step's select needs, from the index the page already built.
  const objectiveOptions = Object.entries(objectivesById).map(([id, o]) => ({
    id,
    name: o.name,
    classification: o.classification,
  }));

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

  /**
   * Rescoring (Note 19). The score is saved as before, and if the change moved
   * the severity BAND an event is appended recording the move, with who and
   * when. That row is the only thing that can ever make the register say a risk
   * escalated, which is why the write exists: before it, nothing in the system
   * recorded a change, and the sentence claiming one was rendered from a level
   * test. A rescore that leaves the band where it was writes no event, because
   * there is no movement to record.
   *
   * The event is written after the score lands and is deliberately not reverted
   * with it: the log is append-only, and a failed score simply leaves no event,
   * since buildScoredEvent is fed the state the update actually applied.
   */
  const rescore = async (id, patch) => {
    const before = risks.find((r) => r.id === id);
    if (!before) return;
    await applyUpdate(id, patch);

    const event = buildScoredEvent({
      projectId,
      riskId: id,
      before,
      after: { ...before, ...patch },
      actorId: userId,
    });
    if (!event) return;

    const { data, error: evtErr } = await supabase
      .from('project_risk_events')
      .insert(event)
      .select('id, risk_id, event_type, from_value, to_value, occurred_at, actor_id')
      .single();
    if (!evtErr && data) setEvents((es) => [data, ...es]);
  };

  const setLikelihood = (id, value) => rescore(id, { likelihood: value });
  const setImpact = (id, value) => rescore(id, { impact: value });
  const setStatus = (id, value) => applyUpdate(id, { status: value });

  const onNoteChange = (id, value) =>
    setNoteDrafts((d) => ({ ...d, [id]: value }));

  const saveNote = (id) => {
    const clean = (noteDrafts[id] ?? '').trim();
    setNoteDrafts((d) => ({ ...d, [id]: clean }));
    applyUpdate(id, { response_note: clean === '' ? null : clean });
  };

  // Add to register opens the confirmation (Note 19.3) rather than writing
  // straight away: which objective the risk threatens is the developer's call,
  // and criticality derives from it. The play's own objective is the default,
  // because that is what selected it, but it is a default and not a decision
  // already taken for them.
  const startAddPlay = (suggestion) => {
    setDismissingPlayId(null);
    setPlayObjectiveId(suggestion.linkedObjectiveId ?? '');
    setConfirmingPlayId(suggestion.playId);
  };

  const cancelAddPlay = () => {
    setConfirmingPlayId(null);
    setPlayObjectiveId('');
  };

  const startDismissPlay = (suggestion) => {
    setConfirmingPlayId(null);
    setDismissReason('');
    setDismissingPlayId(suggestion.playId);
  };

  const cancelDismissPlay = () => {
    setDismissingPlayId(null);
    setDismissReason('');
  };

  // Add to register (M7.4, confirmed and recorded under Note 19.3): accept a
  // suggested risk play. The new row lands at the register's default convention
  // (medium and medium, watching, not yet reviewed) with the objective the
  // developer confirmed and the criticality that derives from it, carries the
  // source columns that record it came from a play rather than the Brief, and
  // the decision is recorded with who and when. Deliberately NOT routed through
  // applyUpdate: accepting a suggestion is not a review, so last_reviewed_at
  // stays null.
  const acceptPlay = async (suggestion) => {
    if (actingPlayId) return;
    setActingPlayId(suggestion.playId);
    setError(null);

    const linkedObjectiveId = playObjectiveId || null;
    const criticality = confirmedPlayCriticality(suggestion, linkedObjectiveId, (id) =>
      toStoredCriticality(id, objectivesById)
    );

    const { data, error: insErr } = await supabase
      .from('project_risks')
      .insert(
        buildRiskFromPlay(suggestion, projectId, {
          linkedObjectiveId,
          criticality,
        })
      )
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

    await recordTriageDecision(supabase, {
      projectId,
      itemKind: 'play',
      itemId: suggestion.playId,
      itemName: suggestion.title ?? null,
      surface: TRIAGE_SURFACES.RISK_REGISTER,
      decision: TRIAGE_DECISIONS.ADDED,
      createdRiskId: data.id,
      decidedBy: userId,
    });

    setRisks((rs) => [...rs, data]);
    setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    setConfirmingPlayId(null);
    setPlayObjectiveId('');
    setActingPlayId(null);
  };

  // Dismiss (M7.4, recorded under Note 19.3): records dismissed for this
  // project, with the reason, the decider and the timestamp. Dismissed stays
  // dismissed; no re-nagging. Declining curated knowledge is a judgement about
  // this project, so it is recorded as one.
  const dismissPlay = async (suggestion) => {
    const reason = dismissReason.trim();
    if (!reason || actingPlayId) return;
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
      setActingPlayId(null);
      return;
    }

    await recordTriageDecision(supabase, {
      projectId,
      itemKind: 'play',
      itemId: suggestion.playId,
      itemName: suggestion.title ?? null,
      surface: TRIAGE_SURFACES.RISK_REGISTER,
      decision: TRIAGE_DECISIONS.DISMISSED,
      reason,
      decidedBy: userId,
    });

    setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    setDismissingPlayId(null);
    setDismissReason('');
    setActingPlayId(null);
  };

  // One suggested risk play (M7.4, reworked under Note 19.3): the title, the
  // why line in full (never truncated), the basis it was selected on, and the
  // two responses.
  //
  // IT WEARS NO CRITICALITY CHIP. Criticality derives from the objective an
  // item threatens, and a suggestion threatens none yet: the developer has not
  // agreed to take it on. The chip it used to carry was classifying a risk that
  // did not exist. Add to register confirms the link first and the criticality
  // follows it, read-only. What it says instead is its basis, which is the
  // honest version of what the chip was gesturing at.
  const renderPlaySuggestion = (s) => {
    const acting = actingPlayId === s.playId;
    const confirming = confirmingPlayId === s.playId;
    const dismissing = dismissingPlayId === s.playId;
    const confirmedCriticality = confirmedPlayCriticality(
      s,
      playObjectiveId || null,
      (id) => toStoredCriticality(id, objectivesById)
    );

    return (
      <article key={s.playId} className={styles.playItem}>
        <p className={styles.playTitle}>{s.title}</p>
        <p className={styles.why}>{s.why}</p>
        <p className={styles.basis}>{s.basis}</p>

        {confirming ? (
          <div className={styles.triageForm}>
            <span className={styles.controlLabel}>
              Which objective does this threaten?
            </span>
            <ObjectiveSelect
              value={playObjectiveId}
              onChange={setPlayObjectiveId}
              options={objectiveOptions}
              ariaLabel={`Objective threatened by ${s.title}`}
            />
            <p className={styles.basis}>
              {inheritedCriticalityLine(
                confirmedCriticality,
                objectivesById[playObjectiveId]?.name ?? null,
                s.alwaysCritical
              )}
            </p>
            <div className={styles.playActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => acceptPlay(s)}
                disabled={actingPlayId !== null}
              >
                {acting ? 'Adding' : 'Add to register'}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={cancelAddPlay}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : dismissing ? (
          <div className={styles.triageForm}>
            <input
              type="text"
              className={styles.noteInput}
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder={DISMISS_REASON_PLACEHOLDER}
              aria-label={`Reason for dismissing ${s.title}`}
              autoComplete="off"
              maxLength={200}
            />
            <div className={styles.playActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => dismissPlay(s)}
                disabled={dismissReason.trim() === '' || actingPlayId !== null}
              >
                {acting ? 'Recording' : 'Dismiss'}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={cancelDismissPlay}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.playActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => startAddPlay(s)}
              disabled={actingPlayId !== null}
              aria-label={`Add to register: ${s.title}`}
            >
              Add to register
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => startDismissPlay(s)}
              disabled={actingPlayId !== null}
              aria-label={`Dismiss: ${s.title}`}
            >
              Dismiss
            </button>
          </div>
        )}
      </article>
    );
  };

  // One row in the first-review queue (B2, reworked under Note 19): the live
  // criticality chip and severity (the same reads the card below shows, so the
  // two surfaces agree), the objective it threatens, where it came from, the
  // risk itself as a jump link to its full card, and ONE accurate status line.
  //
  // The escalation line renders under it only when a recorded band-raising
  // event exists for this risk, and then it names from, to, when and who. On a
  // register that has recorded no change, it renders on no card at all, which
  // is the point: the platform says a risk escalated only when its own data can
  // show that it did.
  const renderAttnRow = ({ risk, assessment }) => {
    const critical = isLiveCritical(risk, objectivesById);
    const objective = risk.linked_objective_id
      ? objectivesById[risk.linked_objective_id]?.name ?? null
      : null;
    const status = statusLine(assessment, risk, now);
    const escalated = escalationLine(escalations.get(risk.id) ?? null, {
      bandLabel: (k) => BAND_LABEL[k] ?? k,
      actorName: (id) => actorNames[id] ?? null,
      formatDate: formatReviewed,
    });

    return (
      <article
        key={risk.id}
        className={`${styles.attnItem} ${critical ? styles.attnItemCritical : ''}`}
      >
        <div className={styles.attnTags}>
          <CriticalityChip critical={critical} />
          <SeverityChip severity={assessment.severity} />
          <span className={styles.objective}>
            {objectiveRelation(objective)}
          </span>
          <span className={styles.provenance}>{riskProvenance(risk)}</span>
        </div>
        <a className={styles.attnName} href={`#risk-${risk.id}`}>
          {risk.description}
        </a>
        {status && <p className={styles.attnStatus}>{status}</p>}
        {escalated && <p className={styles.attnEscalation}>{escalated}</p>}
      </article>
    );
  };

  const renderCard = (r) => {
    const critical = isLiveCritical(r, objectivesById);
    const severity = deriveSeverity(r.likelihood, r.impact);
    const objective = r.linked_objective_id
      ? objectivesById[r.linked_objective_id]?.name ?? null
      : null;
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
            <CriticalityChip critical={critical} />
            <span className={styles.objective}>
              {objectiveRelation(objective)}
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

  // The read-only card a member sees: the same record, with the scoring, status
  // and response controls replaced by their settled values. No control that
  // would write, so nothing reads as broken.
  const renderReadOnlyCard = (r) => {
    const critical = isLiveCritical(r, objectivesById);
    const severity = deriveSeverity(r.likelihood, r.impact);
    const objective = r.linked_objective_id
      ? objectivesById[r.linked_objective_id]?.name ?? null
      : null;
    const reviewed = formatReviewed(r.last_reviewed_at);
    const likelihoodLabel = labelFor(LIKELIHOOD_OPTIONS, r.likelihood);
    const impactLabel = labelFor(IMPACT_OPTIONS, r.impact);
    const statusLabel = labelFor(STATUS_OPTIONS, r.status);
    const response = (r.response_note ?? '').trim();

    return (
      <article
        key={r.id}
        id={`risk-${r.id}`}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <CriticalityChip critical={critical} />
            <span className={styles.objective}>
              {objectiveRelation(objective)}
            </span>
          </div>
          <SeverityChip severity={severity} />
        </div>

        <p className={styles.riskName}>{r.description}</p>

        <dl className={styles.roDetail}>
          <div className={styles.roRow}>
            <dt className={styles.roLabel}>Likelihood</dt>
            <dd className={styles.roValue}>{likelihoodLabel ?? 'Not rated'}</dd>
          </div>
          <div className={styles.roRow}>
            <dt className={styles.roLabel}>Impact</dt>
            <dd className={styles.roValue}>{impactLabel ?? 'Not rated'}</dd>
          </div>
          <div className={styles.roRow}>
            <dt className={styles.roLabel}>Status</dt>
            <dd className={styles.roValue}>{statusLabel ?? 'Not set'}</dd>
          </div>
          <div className={styles.roRow}>
            <dt className={styles.roLabel}>Response</dt>
            <dd className={styles.roValue}>
              {response || 'No response recorded.'}
            </dd>
          </div>
        </dl>

        <div className={styles.cardFoot}>
          <span className={styles.reviewed}>
            {reviewed ? `Last reviewed ${reviewed}` : 'Not yet reviewed'}
          </span>
        </div>
      </article>
    );
  };

  // One card renderer, chosen by access: the interactive card for an admin, the
  // read-only record for a member.
  const cardRenderer = canEdit ? renderCard : renderReadOnlyCard;

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
      {!canEdit && (
        <div className={styles.viewOnly}>
          <ViewOnlyBadge adminContact={adminContact} />
        </div>
      )}

      {/* The first-review queue (B2, reframed under Note 19.2): the risks the
          monitor flags, most urgent first, each with ONE accurate status line
          and its provenance. It used to be headed "Needs attention" and stack
          three boilerplate lines per card, so six Brief risks nobody had opened
          yet read as six failures. When nothing is flagged it collapses to one
          calm line: monitoring stays quiet when things are fine. */}
      {needsAttention.length > 0 ? (
        <section className={styles.attnBand} aria-labelledby="first-review">
          <h2 id="first-review" className={styles.bandHeading}>
            Your review queue
          </h2>
          {queueLine && <p className={styles.bandIntro}>{queueLine}</p>}
          <SeverityLegend />
          <div className={styles.attnList}>
            {needsAttention.map(renderAttnRow)}
          </div>
        </section>
      ) : (
        <p className={styles.bandQuiet}>{ATTENTION_QUIET}</p>
      )}

      <div className={styles.summary}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{active.length}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.stat}>
          {/* Amber is criticality only, and only when it exists: a zero
              count reads monochrome. */}
          <span
            className={`${styles.statValue} ${criticalCount > 0 ? styles.statCritical : ''}`}
          >
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
          offered knowledge, not a status. Adding or dismissing a play writes,
          so the whole area is hidden from a member. */}
      {canEdit && livePlays.length > 0 && (
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
        <div className={styles.list}>{active.map(cardRenderer)}</div>
      )}

      {showClosed && closed.length > 0 && (
        <section className={styles.closedSection}>
          <h2 className={styles.closedHeading}>Closed</h2>
          <div className={styles.list}>{closed.map(cardRenderer)}</div>
        </section>
      )}
    </main>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import { CLASSIFICATION_LABELS } from '../components/objectiveMeta';
import { cascadeCriticality } from '../components/listStepConfig';
import {
  STATUS_OPTIONS,
  OUTCOME_OPTIONS,
  CRITICALITY,
  objectivesById,
  derivedCriticality,
  hasDownwardOverride,
  effectiveCriticality,
  isCritical,
  isDone,
  isLessonCaptured,
  sortActions,
  gateReadiness,
  provenanceLabel,
} from './actionModel';
import {
  deriveResponseFeed,
  buildTrackedActionFromRisk,
  buildTrackedActionFromRaid,
} from './actionFeed';
import {
  splitProposals,
  buildActionFromPlay,
} from '../../../../lib/playbook/playbookModel';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import styles from './ActionLog.module.css';

/**
 * ActionLog (M7.1 + M7.2) - the central attention home. The
 * needs-your-response band at the top holds the risk and RAID items that need a
 * response, computed live (actionFeed.js); below it, the tracked list: the
 * project's actions critical-first, with an inline add flow, one-tap status,
 * editing, and delete behind a confirm. Criticality is derived live from the
 * linked objective, with a constrained downward override. A gate-readiness
 * panel (A3) surfaces the open actions bearing on the current stage's gate, and
 * a closed action captures its outcome and any variance (A7), the
 * lessons-learnt input.
 *
 * The band's items are suggestions awaiting a response, never rows: Track
 * this promotes one into a real tracked action in the same interaction (the
 * dedupe then suppresses the item), and Review in register navigates to the
 * risk, because risk status changes happen there, not here. The band
 * recomputes from local state, so promoting, deleting, or completing a
 * tracked action moves the item out of or back into the band immediately.
 *
 * Criticality is LIVE (A2): an action inherits the classification of the
 * objective it serves, read from that objective's current state, so the log
 * orders critical-first by what the baseline protects. The link is the only
 * lever; an action with no link reads "needs a link", never a silent standard.
 * The one change the developer makes by hand is a downward override, which
 * reduces a derived-critical action to standard with a recorded reason and can
 * never raise it. The derivation is always shown, even when overridden. The
 * stored criticality column is now only the baseline snapshot set at creation.
 *
 * Writes are optimistic: the change shows immediately and reverts on a
 * failure. Adds, promotions, and deletes wait for the database (an insert
 * needs its row back; a delete is destructive), with the controls disabled
 * in flight.
 *
 * Out of scope here (M7.3): the notification layer. Everything surfaced is
 * deterministic.
 */

const DESCRIPTION_PLACEHOLDER = 'Describe the action.';
const NOTE_PLACEHOLDER = 'Add a one-line note.';
const VARIANCE_PLACEHOLDER = 'What varied from plan? (optional)';
const NO_OBJECTIVE = 'No objective';

const ADD_ERROR =
  'We could not log that action. Please check your connection and try again.';
const SAVE_ERROR =
  'We could not save that change. Please check your connection and try again.';
const DELETE_ERROR =
  'We could not delete that action. Please check your connection and try again.';
const TRACK_ERROR =
  'We could not track that risk. Please check your connection and try again.';
const ACCEPT_PLAY_ERROR =
  'We could not add that suggestion. Please check your connection and try again.';
const DISMISS_PLAY_ERROR =
  'We could not dismiss that suggestion. Please check your connection and try again.';

const CRITICALITY_LABEL = { critical: 'Critical', standard: 'Standard' };
const NEEDS_LINK_LABEL = 'Needs a link';
const OVERRIDE_REASON_PLACEHOLDER = 'Why reduce this to standard?';

// The read-only line shown to a member where the inline add flow sits for an
// admin. One sparse line at the genuine action point, never greyed controls.
const MEMBER_NO_ADD = 'Only an admin can log actions here.';

// The display label for a segmented value, for a member's read-only card where
// the segmented control is replaced by the settled value.
function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? null;
}

// The RAID kinds the feed surfaces (A5), for the band's kind label.
const KIND_LABEL = {
  assumption: 'Assumption',
  constraint: 'Constraint',
  dependency: 'Dependency',
};

// The final lifecycle stage; beyond it there is no onward gate.
const LAST_STAGE = 7;

const ACTION_COLUMNS =
  'id, description, linked_objective_id, criticality, criticality_override, override_reason, stage, reason, outcome, variance, status, note, source, source_id, created_at';

function formatLogged(iso) {
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

// The objective link select, shared by the add flow and the edit form. Each
// option carries the objective's classification so the developer can see,
// at the moment of linking, what the cascade will make of it.
function ObjectiveSelect({ id, value, onChange, objectives, ariaLabel }) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">{NO_OBJECTIVE}</option>
      {objectives.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} ({CLASSIFICATION_LABELS[o.classification] ?? o.classification})
        </option>
      ))}
    </select>
  );
}

export default function ActionLog({
  projectId,
  projectName,
  workspaceHref,
  registerHref,
  currentStage,
  initialActions,
  objectives,
  risks,
  assumptions,
  constraints,
  dependencies,
  playSuggestions,
  canEdit = true,
  adminContact = null,
}) {
  const supabase = createClient();
  const [actions, setActions] = useState(initialActions);

  // Objectives indexed by id, so criticality is derived live from the linked
  // objective (A2). Stable for the life of the page.
  const byId = useMemo(() => objectivesById(objectives), [objectives]);

  // Promotion in flight (one at a time; the band is a response surface, not
  // a bulk tool).
  const [promotingId, setPromotingId] = useState(null);

  // The PULSE suggests band (M7.4): plays acted on this session leave the
  // band immediately; the server already excluded previously acted pairs.
  const [actedPlayIds, setActedPlayIds] = useState(() => new Set());
  const [actingPlayId, setActingPlayId] = useState(null);
  const [showAllPlays, setShowAllPlays] = useState(false);

  // The inline add flow.
  const [draftDescription, setDraftDescription] = useState('');
  const [draftObjectiveId, setDraftObjectiveId] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [adding, setAdding] = useState(false);

  // Per-card edit mode (one card at a time) and the delete confirm step.
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  // The downward criticality override (A2): one action at a time in the
  // reason-tagged reduce flow.
  const [overridingId, setOverridingId] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');

  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState(null);

  const open = sortActions(
    actions.filter((a) => !isDone(a)),
    byId
  );
  const done = sortActions(actions.filter(isDone), byId);

  // The attention stat: critical actions still open, by live criticality. Done
  // criticals are completed work, not open attention.
  const criticalOpenCount = actions.filter(
    (a) => !isDone(a) && isCritical(a, byId)
  ).length;

  // Gate readiness (A3): the open actions bearing on the current stage's gate,
  // and how many are critical. The operational headline that frames the log
  // against the gate the developer is working toward.
  const gate = gateReadiness(actions, byId, currentStage);
  const nextStage = currentStage + 1;
  const gateLabel =
    nextStage <= LAST_STAGE
      ? `the gate into Stage ${nextStage}`
      : `the close of Stage ${currentStage}`;

  // The needs-your-response feed (A5): the qualifying risks plus the RAID items
  // that threaten a must-hold objective, recomputed from the live source rows
  // and the current actions every render, so promoting (or deleting or
  // completing) a tracked action moves an item out of or back into the band
  // without a reload. Risk status changes and RAID edits happen elsewhere, so
  // those arrive on the next visit.
  const needsResponse = deriveResponseFeed({
    risks,
    assumptions,
    constraints,
    dependencies,
    actions,
    objectivesById: byId,
  });

  // The live suggestions: the server's proposals minus the ones acted on
  // this session, top five up front, the rest behind Show all.
  const livePlays = (playSuggestions ?? []).filter(
    (s) => !actedPlayIds.has(s.playId)
  );
  const { top: topPlays, rest: restPlays } = splitProposals(livePlays);
  const visiblePlays = showAllPlays ? livePlays : topPlays;

  // What the cascade will default a new action to, shown in the add flow at
  // the moment of linking. The default at creation only; never re-applied.
  const draftCriticality = cascadeCriticality(
    draftObjectiveId || null,
    objectives
  );

  const addAction = async () => {
    const description = draftDescription.trim();
    if (!description || adding) return;
    setAdding(true);
    setError(null);

    const note = draftNote.trim();
    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert({
        project_id: projectId,
        description,
        linked_objective_id: draftObjectiveId || null,
        criticality: draftCriticality,
        stage: currentStage,
        note: note === '' ? null : note,
      })
      .select(ACTION_COLUMNS)
      .single();

    if (insErr || !data) {
      setError(ADD_ERROR);
    } else {
      setActions((as) => [data, ...as]);
      setDraftDescription('');
      setDraftObjectiveId('');
      setDraftNote('');
    }
    setAdding(false);
  };

  // Track this (M7.2, A5): promote a pushed feed entry (a risk or a RAID item)
  // into a real tracked action in one interaction, pre-filled by its kind
  // (actionFeed's deterministic templates) and editable after. No confirmation
  // dialog. The insert waits for its row back; as it lands, the dedupe
  // suppresses the pushed item.
  const trackItem = async (entry) => {
    if (promotingId) return;
    setPromotingId(entry.row.id);
    setError(null);

    const insert =
      entry.kind === 'risk'
        ? buildTrackedActionFromRisk(entry.row, projectId, currentStage, byId)
        : buildTrackedActionFromRaid(
            entry.row,
            projectId,
            currentStage,
            entry.kind
          );

    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert(insert)
      .select(ACTION_COLUMNS)
      .single();

    if (insErr || !data) {
      setError(TRACK_ERROR);
    } else {
      setActions((as) => [data, ...as]);
    }
    setPromotingId(null);
  };

  // Add to log (M7.4): accept a suggested play. The tracked action lands
  // and the suggestion leaves the band in the same interaction; the state
  // row is what keeps it gone on the next visit. One at a time, like
  // promotion.
  const acceptPlay = async (suggestion) => {
    if (actingPlayId) return;
    setActingPlayId(suggestion.playId);
    setError(null);

    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert(buildActionFromPlay(suggestion, projectId))
      .select(ACTION_COLUMNS)
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

    // The action exists either way; surface a save problem rather than
    // leaving the developer guessing why the suggestion may return later.
    if (stateErr) setError(SAVE_ERROR);

    setActions((as) => [data, ...as]);
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

  // Optimistic write: apply locally, persist, revert on failure. Status,
  // the criticality toggle, and edit saves all route through here.
  const applyUpdate = async (id, patch) => {
    const prev = actions.find((a) => a.id === id);
    if (!prev) return;
    setActions((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setError(null);

    const { error: updErr } = await supabase
      .from('project_actions')
      .update(patch)
      .eq('id', id);
    if (updErr) {
      setActions((as) => as.map((a) => (a.id === id ? prev : a)));
      setError(SAVE_ERROR);
    }
  };

  // Marking an action done reveals the Done section, so the outcome capture is
  // offered right at close (A7); the close itself stays permissive.
  const setStatus = (id, value) => {
    if (value === 'done') setShowDone(true);
    applyUpdate(id, { status: value });
  };

  // Outcome and variance capture on close (A7), the lessons-learnt input. The
  // outcome is a one-tap on the done card; variance is an optional note saved
  // on blur. Both write straight through applyUpdate; neither blocks the close.
  const setOutcome = (id, value) => applyUpdate(id, { outcome: value });

  const saveVariance = (id, value) => {
    const prev = actions.find((a) => a.id === id);
    if (!prev) return;
    const next = value.trim() === '' ? null : value.trim();
    if ((prev.variance ?? null) === next) return;
    applyUpdate(id, { variance: next });
  };

  // The downward override (A2): reduce a derived-critical action to standard
  // with a recorded reason. Opening it closes any edit or delete-confirm on the
  // same card, so only one inline flow is ever open.
  const startOverride = (a) => {
    setConfirmingId(null);
    setEditingId(null);
    setEditDraft(null);
    setOverrideReason('');
    setOverridingId(a.id);
  };

  const cancelOverride = () => {
    setOverridingId(null);
    setOverrideReason('');
  };

  // Reason is required, so this is reached only with a non-empty reason. It
  // writes the override and its reason; the derived criticality is never
  // touched, so the derivation is kept and can be restored.
  const saveOverride = (id) => {
    const reason = overrideReason.trim();
    if (!reason) return;
    setOverridingId(null);
    setOverrideReason('');
    applyUpdate(id, {
      criticality_override: 'standard',
      override_reason: reason,
    });
  };

  // Restore: clear the override, returning the action to its derived critical.
  const restoreCriticality = (id) =>
    applyUpdate(id, { criticality_override: null, override_reason: null });

  const startEdit = (a) => {
    setConfirmingId(null);
    setOverridingId(null);
    setOverrideReason('');
    setEditingId(a.id);
    setEditDraft({
      description: a.description,
      linked_objective_id: a.linked_objective_id ?? '',
      note: a.note ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  // Saves description, objective link, and note. Deliberately never
  // criticality: re-linking must not re-flip it.
  const saveEdit = (id) => {
    const description = (editDraft?.description ?? '').trim();
    if (!description) return;
    const note = (editDraft?.note ?? '').trim();
    const patch = {
      description,
      linked_objective_id: editDraft.linked_objective_id || null,
      note: note === '' ? null : note,
    };
    setEditingId(null);
    setEditDraft(null);
    applyUpdate(id, patch);
  };

  const requestDelete = (id) => {
    setEditingId(null);
    setEditDraft(null);
    setOverridingId(null);
    setConfirmingId(id);
  };

  const confirmDelete = async (id) => {
    const prev = actions;
    setActions((as) => as.filter((a) => a.id !== id));
    setConfirmingId(null);
    setError(null);

    const { error: delErr } = await supabase
      .from('project_actions')
      .delete()
      .eq('id', id);
    if (delErr) {
      setActions(prev);
      setError(DELETE_ERROR);
    }
  };

  const objectiveName = (id) =>
    id ? objectives.find((o) => o.id === id)?.name ?? null : null;

  // One pushed item in the needs-your-response band (A5): a risk or a RAID
  // item (assumption, constraint, dependency). Its description, the objective
  // it bears on, why it surfaced as plain chips, its provenance, and Track this
  // (plus Review in register for a risk, which keeps its own controls there).
  // Unmistakably a suggestion, never mixed with tracked actions.
  const renderPushItem = (entry) => {
    const { kind, row, reasons } = entry;
    const isRisk = kind === 'risk';
    const linkedName = objectiveName(row.linked_objective_id);
    const promoting = promotingId === row.id;

    return (
      <article key={`${kind}-${row.id}`} className={styles.pushItem}>
        <div className={styles.pushTags}>
          {reasons.critical && (
            <span className={`${styles.chip} ${styles.chipCritical}`}>
              Critical
            </span>
          )}
          {reasons.serious && (
            <span className={`${styles.chip} ${styles.chipSerious}`}>
              Serious
            </span>
          )}
          {!isRisk && <span className={styles.kind}>{KIND_LABEL[kind]}</span>}
          <span className={styles.objective}>
            {linkedName ? `vs ${linkedName}` : 'Unlinked'}
          </span>
          <span className={styles.provenance}>{provenanceLabel(kind)}</span>
        </div>
        <p className={styles.pushName}>{row.description}</p>
        {/* Track this promotes a feed item into a tracked action (a write), so
            it is admin only. Review in register is read-only navigation and
            stays for everyone. The row shows no action bar when neither
            applies. */}
        {(canEdit || isRisk) && (
          <div className={styles.pushActions}>
            {canEdit && (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => trackItem(entry)}
                disabled={promotingId !== null}
                aria-label={`Track this: ${row.description}`}
              >
                {promoting ? 'Tracking' : 'Track this'}
              </button>
            )}
            {isRisk && (
              <Link
                href={`${registerHref}#risk-${row.id}`}
                className={styles.ghostBtn}
                aria-label={`Review ${row.description} in the register`}
              >
                Review in register
              </Link>
            )}
          </div>
        )}
      </article>
    );
  };

  // One suggested play in the PULSE suggests band (M7.4): the title, the
  // why line in full (the why is the knowledge transfer; never truncated),
  // a Critical chip when this project's classification derives it critical,
  // and the two one-tap responses.
  const renderPlaySuggestion = (s) => {
    const acting = actingPlayId === s.playId;

    return (
      <article key={s.playId} className={styles.pushItem}>
        <div className={styles.pushTags}>
          {s.criticality === 'critical' && (
            <span className={`${styles.chip} ${styles.chipCritical}`}>
              Critical
            </span>
          )}
          <span className={styles.provenance}>
            {provenanceLabel('playbook')}
          </span>
        </div>
        <p className={styles.playTitle}>{s.title}</p>
        <p className={styles.why}>{s.why}</p>
        <div className={styles.pushActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => acceptPlay(s)}
            disabled={actingPlayId !== null}
            aria-label={`Add to log: ${s.title}`}
          >
            {acting ? 'Adding' : 'Add to log'}
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

  // The criticality detail under an action: the derivation in plain language
  // and the one allowed change. Shown only when there is something to say or
  // do; a plain derived-standard action needs neither.
  const renderCritDetail = (a, { overridden, critical, unlinked, linkedName }) => {
    const overriding = overridingId === a.id;

    // Unlinked: the link is the only lever, so point at it.
    if (unlinked) {
      return (
        <div className={styles.critDetail}>
          <p className={styles.critCaption}>
            Link an objective to set this action's criticality.
          </p>
          <button
            type="button"
            className={styles.footBtn}
            onClick={() => startEdit(a)}
          >
            Link an objective
          </button>
        </div>
      );
    }

    // Overridden: show the derivation (never erased) and the recorded reason,
    // with the way back.
    if (overridden) {
      return (
        <div className={styles.critDetail}>
          <p className={styles.critCaption}>
            Reduced to standard. {linkedName} is non-negotiable, so this is
            critical by default.
          </p>
          {a.override_reason && (
            <p className={styles.critReason}>Reason: {a.override_reason}</p>
          )}
          <button
            type="button"
            className={styles.footBtn}
            onClick={() => restoreCriticality(a.id)}
          >
            Restore to critical
          </button>
        </div>
      );
    }

    // Derived critical: explain why, and offer the downward override. The
    // reason form opens in place when reducing.
    if (critical) {
      return (
        <div className={styles.critDetail}>
          <p className={styles.critCaption}>
            Critical because {linkedName} is non-negotiable.
          </p>
          {overriding ? (
            <div className={styles.overrideForm}>
              <input
                type="text"
                className={styles.input}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={OVERRIDE_REASON_PLACEHOLDER}
                aria-label={`Reason for reducing ${a.description} to standard`}
                autoComplete="off"
                maxLength={200}
              />
              <div className={styles.overrideActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => saveOverride(a.id)}
                  disabled={overrideReason.trim() === ''}
                >
                  Reduce to standard
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={cancelOverride}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.footBtn}
              onClick={() => startOverride(a)}
            >
              Reduce to standard
            </button>
          )}
        </div>
      );
    }

    // Derived standard from a flexible objective: the head chip says it, and
    // there is nothing to change (standard is the floor; criticality is never
    // raised here).
    return null;
  };

  const renderCard = (a) => {
    const derived = derivedCriticality(a, byId);
    const overridden = hasDownwardOverride(a, byId);
    const critical = effectiveCriticality(a, byId) === CRITICALITY.CRITICAL;
    const unlinked = derived === CRITICALITY.UNLINKED;
    const linkedName = objectiveName(a.linked_objective_id);
    const logged = formatLogged(a.created_at);
    const editing = editingId === a.id;
    const confirming = confirmingId === a.id;

    // The head chip states the live criticality, or the needs-a-link gap.
    // Static, not a control: criticality follows the objective now.
    let critClass = styles.critStandard;
    let critLabel = CRITICALITY_LABEL.standard;
    if (unlinked) {
      critClass = styles.critUnlinked;
      critLabel = NEEDS_LINK_LABEL;
    } else if (critical) {
      critClass = styles.critCritical;
      critLabel = CRITICALITY_LABEL.critical;
    }

    return (
      <article
        key={a.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <span className={`${styles.crit} ${critClass}`}>{critLabel}</span>
            {linkedName && (
              <span className={styles.objective}>for {linkedName}</span>
            )}
            {a.source === 'risk' && (
              <Link
                href={
                  a.source_id
                    ? `${registerHref}#risk-${a.source_id}`
                    : registerHref
                }
                className={styles.fromRisk}
                title="Raised from a risk in your register"
              >
                {provenanceLabel('risk')}
              </Link>
            )}
            {a.source === 'playbook' && (
              <span className={styles.provenance}>
                {provenanceLabel('playbook')}
              </span>
            )}
            {(a.source === 'assumption' ||
              a.source === 'constraint' ||
              a.source === 'dependency') && (
              <span className={styles.provenance}>
                {provenanceLabel(a.source)}
              </span>
            )}
          </div>
        </div>

        {editing ? (
          <div className={styles.editForm}>
            <input
              type="text"
              className={styles.input}
              value={editDraft?.description ?? ''}
              onChange={(e) =>
                setEditDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder={DESCRIPTION_PLACEHOLDER}
              aria-label={`Description for ${a.description}`}
              autoComplete="off"
              maxLength={240}
            />
            <div className={styles.editMeta}>
              <ObjectiveSelect
                value={editDraft?.linked_objective_id ?? ''}
                onChange={(v) =>
                  setEditDraft((d) => ({ ...d, linked_objective_id: v }))
                }
                objectives={objectives}
                ariaLabel={`Objective served by ${a.description}`}
              />
              <input
                type="text"
                className={`${styles.input} ${styles.noteInput}`}
                value={editDraft?.note ?? ''}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, note: e.target.value }))
                }
                placeholder={NOTE_PLACEHOLDER}
                aria-label={`Note for ${a.description}`}
                autoComplete="off"
                maxLength={200}
              />
            </div>
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => saveEdit(a.id)}
                disabled={(editDraft?.description ?? '').trim() === ''}
              >
                Save
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.description}>{a.description}</p>
            {a.note && <p className={styles.noteText}>{a.note}</p>}
            {a.reason && <p className={styles.reasonLine}>{a.reason}</p>}
            {renderCritDetail(a, { overridden, critical, unlinked, linkedName })}
          </>
        )}

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Status</span>
            <Segmented
              options={STATUS_OPTIONS}
              value={a.status}
              onSelect={(v) => setStatus(a.id, v)}
              ariaLabel={`Status for ${a.description}`}
            />
          </div>
        </div>

        {/* Outcome capture on close (A7): how the action closed and what
            varied, the lessons-learnt input. Offered on done cards only, and
            never forced; the variance note appears once an outcome is set. */}
        {isDone(a) && (
          <div className={styles.outcome}>
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Outcome</span>
              <Segmented
                options={OUTCOME_OPTIONS}
                value={a.outcome ?? ''}
                onSelect={(v) => setOutcome(a.id, v)}
                ariaLabel={`Outcome for ${a.description}`}
              />
            </div>
            {isLessonCaptured(a) && (
              <input
                type="text"
                className={`${styles.input} ${styles.varianceInput}`}
                defaultValue={a.variance ?? ''}
                placeholder={VARIANCE_PLACEHOLDER}
                aria-label={`Variance for ${a.description}`}
                onBlur={(e) => saveVariance(a.id, e.target.value)}
                autoComplete="off"
                maxLength={240}
              />
            )}
          </div>
        )}

        <div className={styles.cardFoot}>
          <span className={styles.logged}>{logged ? `Logged ${logged}` : ''}</span>
          {confirming ? (
            <div className={styles.confirm}>
              <span className={styles.confirmText}>Delete this action?</span>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => confirmDelete(a.id)}
              >
                Delete
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setConfirmingId(null)}
              >
                Keep
              </button>
            </div>
          ) : (
            !editing && (
              <div className={styles.footActions}>
                <button
                  type="button"
                  className={styles.footBtn}
                  onClick={() => startEdit(a)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${styles.footBtn} ${styles.footBtnDanger}`}
                  onClick={() => requestDelete(a.id)}
                >
                  Delete
                </button>
              </div>
            )
          )}
        </div>
      </article>
    );
  };

  // The read-only card a member sees: the same record, with the criticality
  // controls, the status control, the outcome capture, and the edit and delete
  // actions replaced by their settled values. No control that would write.
  const renderReadOnlyCard = (a) => {
    const derived = derivedCriticality(a, byId);
    const overridden = hasDownwardOverride(a, byId);
    const critical = effectiveCriticality(a, byId) === CRITICALITY.CRITICAL;
    const unlinked = derived === CRITICALITY.UNLINKED;
    const linkedName = objectiveName(a.linked_objective_id);
    const logged = formatLogged(a.created_at);
    const statusLabel = labelFor(STATUS_OPTIONS, a.status);
    const outcomeLabel = labelFor(OUTCOME_OPTIONS, a.outcome);
    const variance = (a.variance ?? '').trim();

    let critClass = styles.critStandard;
    let critLabel = CRITICALITY_LABEL.standard;
    if (unlinked) {
      critClass = styles.critUnlinked;
      critLabel = NEEDS_LINK_LABEL;
    } else if (critical) {
      critClass = styles.critCritical;
      critLabel = CRITICALITY_LABEL.critical;
    }

    return (
      <article
        key={a.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <span className={`${styles.crit} ${critClass}`}>{critLabel}</span>
            {linkedName && (
              <span className={styles.objective}>for {linkedName}</span>
            )}
            {a.source === 'risk' && (
              <Link
                href={
                  a.source_id
                    ? `${registerHref}#risk-${a.source_id}`
                    : registerHref
                }
                className={styles.fromRisk}
                title="Raised from a risk in your register"
              >
                {provenanceLabel('risk')}
              </Link>
            )}
            {a.source === 'playbook' && (
              <span className={styles.provenance}>
                {provenanceLabel('playbook')}
              </span>
            )}
            {(a.source === 'assumption' ||
              a.source === 'constraint' ||
              a.source === 'dependency') && (
              <span className={styles.provenance}>
                {provenanceLabel(a.source)}
              </span>
            )}
          </div>
        </div>

        <p className={styles.description}>{a.description}</p>
        {a.note && <p className={styles.noteText}>{a.note}</p>}
        {a.reason && <p className={styles.reasonLine}>{a.reason}</p>}

        {overridden ? (
          <div className={styles.critDetail}>
            <p className={styles.critCaption}>
              Reduced to standard. {linkedName} is non-negotiable, so this is
              critical by default.
            </p>
            {a.override_reason && (
              <p className={styles.critReason}>Reason: {a.override_reason}</p>
            )}
          </div>
        ) : critical ? (
          <div className={styles.critDetail}>
            <p className={styles.critCaption}>
              Critical because {linkedName} is non-negotiable.
            </p>
          </div>
        ) : null}

        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Status</span>
            <span className={styles.roValue}>{statusLabel ?? 'Not set'}</span>
          </div>
        </div>

        {isDone(a) && (
          <div className={styles.outcome}>
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Outcome</span>
              <span className={styles.roValue}>
                {outcomeLabel ?? 'Not recorded'}
              </span>
            </div>
            {variance && (
              <div className={styles.controlRow}>
                <span className={styles.controlLabel}>What varied</span>
                <span className={styles.roValue}>{variance}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.cardFoot}>
          <span className={styles.logged}>{logged ? `Logged ${logged}` : ''}</span>
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
      <p className={styles.eyebrow}>Action Log module</p>
      <h1 className={styles.title}>Action Log</h1>
      <p className={styles.projectName}>{projectName}</p>
      {!canEdit && (
        <div className={styles.viewOnly}>
          <ViewOnlyBadge adminContact={adminContact} />
        </div>
      )}

      {/* The needs-your-response band (M7.2): pushed items derived live
          from the register. When nothing qualifies it collapses to one calm
          line. Quiet is a feature. */}
      {needsResponse.length > 0 ? (
        <section className={styles.band} aria-labelledby="needs-response">
          <h2 id="needs-response" className={styles.bandHeading}>
            Needs your response
          </h2>
          <div className={styles.bandList}>
            {needsResponse.map(renderPushItem)}
          </div>
        </section>
      ) : (
        <p className={styles.bandQuiet}>
          Nothing needs your response right now.
        </p>
      )}

      {/* The PULSE suggests band (M7.4), below needs-your-response:
          stage-keyed curated action plays, top five up front. When none
          remain it is simply gone: suggestions are offered knowledge, not
          a status. Adding or dismissing a play writes, so the whole band is
          hidden from a member. */}
      {canEdit && livePlays.length > 0 && (
        <section
          className={`${styles.band} ${styles.suggestBand}`}
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

      {/* Gate readiness (A3): the open actions bearing on the current stage's
          gate, the operational face of the stage checklist. Scoped to open
          actions; the full deliverables checklist is the Gate module's. */}
      <section className={styles.gateReady} aria-labelledby="gate-readiness">
        <h2 id="gate-readiness" className={styles.bandHeading}>
          Gate readiness
        </h2>
        {gate.open === 0 ? (
          <p className={styles.gateReadyLine}>
            No open actions stand before {gateLabel}.
          </p>
        ) : (
          <p className={styles.gateReadyLine}>
            {gate.open} open{' '}
            {gate.open === 1 ? 'action bears' : 'actions bear'} on {gateLabel}
            {gate.critical > 0 ? (
              <>
                {', '}
                <span className={styles.gateReadyCritical}>
                  {gate.critical} critical
                </span>
              </>
            ) : null}
            .
          </p>
        )}
      </section>

      <div className={styles.summary}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{open.length}</span>
          <span className={styles.statLabel}>Open</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.statCritical}`}>
            {criticalOpenCount}
          </span>
          <span className={styles.statLabel}>Critical</span>
        </div>
        {done.length > 0 && (
          <button
            type="button"
            className={styles.doneToggle}
            aria-pressed={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone
              ? `Hide done (${done.length})`
              : `Show done (${done.length})`}
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/* The inline add flow: a quick log entry, not a long form. It writes, so
          a member sees one sparse line at this action point instead of the
          panel. */}
      {canEdit ? (
      <div className={styles.addPanel}>
        <input
          type="text"
          className={styles.input}
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addAction();
            }
          }}
          placeholder={DESCRIPTION_PLACEHOLDER}
          aria-label="Action description"
          autoComplete="off"
          maxLength={240}
        />
        <div className={styles.addMeta}>
          <ObjectiveSelect
            value={draftObjectiveId}
            onChange={setDraftObjectiveId}
            objectives={objectives}
            ariaLabel="Objective the action serves"
          />
          <input
            type="text"
            className={`${styles.input} ${styles.noteInput}`}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAction();
              }
            }}
            placeholder={NOTE_PLACEHOLDER}
            aria-label="One-line note"
            autoComplete="off"
            maxLength={200}
          />
          {draftCriticality === 'critical' && (
            <span className={`${styles.addHint} riseInSm`}>
              Logs as critical
            </span>
          )}
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.addBtn}`}
            onClick={addAction}
            disabled={adding || draftDescription.trim() === ''}
          >
            {adding ? 'Logging' : 'Log action'}
          </button>
        </div>
      </div>
      ) : (
        <p className={styles.memberNote}>{MEMBER_NO_ADD}</p>
      )}

      {actions.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {canEdit
              ? 'No actions logged yet. Log the first critical action you are working on.'
              : 'No actions have been logged yet.'}
          </p>
        </div>
      ) : open.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Every action is done. Use Show done to review them.
          </p>
        </div>
      ) : (
        <div className={styles.list}>{open.map(cardRenderer)}</div>
      )}

      {showDone && done.length > 0 && (
        <section className={styles.doneSection}>
          <h2 className={styles.doneHeading}>Done</h2>
          <div className={styles.list}>{done.map(cardRenderer)}</div>
        </section>
      )}
    </main>
  );
}

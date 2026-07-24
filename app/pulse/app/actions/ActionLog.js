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
  objectiveRelation,
} from './actionModel';
import {
  deriveResponseFeed,
  buildTrackedActionFromRisk,
  buildTrackedActionFromRaid,
} from './actionFeed';
import {
  itemKey,
  recordTriageDecision,
  TRIAGE_DECISIONS,
  TRIAGE_SURFACES,
} from './triageDecisionStore';
import {
  splitProposals,
  buildActionFromPlay,
  confirmedPlayCriticality,
} from '../../../../lib/playbook/playbookModel';
import { severityLegend } from '../../../../lib/engine/severity';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import CriticalityChip from '../components/CriticalityChip';
import styles from './ActionLog.module.css';

/**
 * ActionLog (M7.1 + M7.2) - the central attention home. The triage queue at the
 * top holds the Critical risk and RAID items from the developer's own Brief,
 * computed live (actionFeed.js); below it, the tracked list: the project's
 * actions critical-first, with an inline add flow, one-tap status, editing, and
 * delete behind a confirm. Criticality is derived live from the linked
 * objective, with a constrained downward override. A gate-readiness panel (A3)
 * surfaces the open actions bearing on the current stage's gate, and a closed
 * action captures its outcome and any variance (A7), the lessons-learnt input.
 *
 * The queue's items are suggestions awaiting a decision, never rows: Track this
 * promotes one into a real tracked action in the same interaction (the dedupe
 * then suppresses the item), Review in register navigates to the risk, because
 * risk status changes happen there, and Dismiss declines it with a recorded
 * reason. The queue recomputes from local state, so promoting, deleting, or
 * completing a tracked action moves the item out of or back into it
 * immediately.
 *
 * WHAT NOTE 18 CHANGED, AND WHAT IT DID NOT. The end-to-end test confirmed the
 * fourteen queued items are exactly the Critical RAID items in the locked Brief:
 * the selection was right. The presentation was not. Four things changed here,
 * none of them touching what is selected or how criticality is derived:
 *
 *   PROVENANCE. Every card states its origin and the document it came out of,
 *   and links to it. The old label read "This project" on every card, which is
 *   true of everything on the screen and so tells the developer nothing.
 *
 *   TRIAGE, NOT ALARM. The queue is headed as what it is, the Critical items
 *   from the Brief arriving to be sorted, rather than as fourteen demands. The
 *   count is unchanged; the claim it makes is not.
 *
 *   AN HONEST SUGGESTION. A PULSE Suggests play wears no criticality chip while
 *   the developer has not yet agreed which objective it serves, because
 *   criticality is derived from that link and there was no link to derive from.
 *   Add to log confirms the link first; the criticality then follows it,
 *   read-only. A RAID-derived card keeps the criticality it already derived,
 *   because that link is real.
 *
 *   A DECLINE PATH. Every queued item can now end in a recorded decision, a
 *   dismiss carrying a one-line reason with who and when, reusing the pattern
 *   the reconcile decisions set (triageDecisionStore.js). Before this the only
 *   two responses both created work, so saying no left no trace.
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

const OVERRIDE_REASON_PLACEHOLDER = 'Why reduce this to standard?';
const DISMISS_REASON_PLACEHOLDER = 'Why are you setting this aside?';

const DISMISS_ERROR =
  'We could not record that decision. Please check your connection and try again.';

// The triage queue's own copy (Note 18). The heading says what the queue holds
// and where it came from, so a correctly completed initiation is not greeted by
// an alarm; the legend under it makes the severity band readable rather than
// asserted.
const TRIAGE_HEADING = 'Critical items from your brief, awaiting triage';
const TRIAGE_QUIET = 'Nothing from your brief is waiting to be triaged.';

const LEGEND = severityLegend();

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

// The created_at timestamp shown at day granularity. Pinned to UTC so the
// logged day reads the same for every viewer and the server-rendered HTML
// matches the client.
function formatLogged(iso) {
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

// The severity band chip's class per band (Note 18). The queue used to show a
// chip only when a risk scored Serious, so Worth watching and Minor read as no
// severity at all and the developer could not tell an unscored item from a mild
// one. Every scored risk now states its band, and the bands step down in weight
// rather than in presence. Severity stays monochrome: amber is criticality only.
const SEVERITY_CLASS = {
  serious: 'chipSerious',
  moderate: 'chipModerate',
  minor: 'chipMinor',
  unscored: 'chipUnscored',
};

function SeverityTag({ severity }) {
  if (!severity) return null;
  return (
    <span className={`${styles.chip} ${styles[SEVERITY_CLASS[severity.key]]}`}>
      {severity.label}
    </span>
  );
}

// The legend that makes the bands readable: the rule, then each band with the
// score range it covers. Derived from the engine (severityLegend), so it can
// never drift from the derivation it explains.
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

/**
 * The read-only criticality line shown wherever criticality is about to be set
 * (Note 18): the add flow, and the Add to log confirmation. It states the value
 * AND where it came from, because criticality is derived from the objective an
 * item serves and is never entered by hand. "No objective" stays a permitted
 * answer; it derives Standard, which is what the column has always stored for
 * an unlinked item.
 */
function inheritedCriticalityLine(criticality, objectiveName, alwaysCritical) {
  if (alwaysCritical) return 'Critical on every project at this stage.';
  const label = criticality === 'critical' ? 'Critical' : 'Standard';
  return objectiveName
    ? `${label}, inherited from ${objectiveName}.`
    : 'Standard. No objective linked.';
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
  briefHref,
  userId = null,
  dismissedKeys = [],
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

  // The items already declined (Note 18). Seeded from the recorded decisions
  // the server read, and added to as the developer dismisses more, so an item
  // leaves the queue in the same interaction that records why.
  const [dismissed, setDismissed] = useState(() => new Set(dismissedKeys));
  const [dismissingKey, setDismissingKey] = useState(null);
  const [dismissReason, setDismissReason] = useState('');

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

  // The Add to log confirmation (Note 18): the play whose objective link the
  // developer is confirming, and the objective they have chosen. Criticality is
  // never chosen here; it derives from this link and is shown read-only.
  const [confirmingPlayId, setConfirmingPlayId] = useState(null);
  const [playObjectiveId, setPlayObjectiveId] = useState('');

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
    dismissed,
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
      // The action is the work; this is the record that a decision was taken on
      // this item, by whom and when. Recorded after the insert so the action id
      // can ride onto it, the order recordReconcileDecisions uses.
      await recordTriageDecision(supabase, {
        projectId,
        itemKind: entry.kind,
        itemId: entry.row.id,
        itemName: entry.row.description ?? null,
        surface: TRIAGE_SURFACES.ACTION_LOG,
        decision: TRIAGE_DECISIONS.TRACKED,
        createdActionId: data.id,
        decidedBy: userId,
      });
    }
    setPromotingId(null);
  };

  // Dismiss (Note 18): the decline path. The item leaves the queue and the
  // reason, the decider and the timestamp are recorded, so a considered
  // rejection is a governance record rather than a disappearance. The reason is
  // required, so this is only reached with a non-empty one, and the write is
  // awaited: a decline that did not persist must not silently empty the queue.
  const dismissItem = async (entry) => {
    const reason = dismissReason.trim();
    if (!reason || promotingId) return;
    const key = itemKey(entry.kind, entry.row.id);
    setPromotingId(entry.row.id);
    setError(null);

    const { error: recErr } = await recordTriageDecision(supabase, {
      projectId,
      itemKind: entry.kind,
      itemId: entry.row.id,
      itemName: entry.row.description ?? null,
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.DISMISSED,
      reason,
      decidedBy: userId,
    });

    if (recErr) {
      setError(DISMISS_ERROR);
    } else {
      setDismissed((keys) => new Set(keys).add(key));
      setDismissingKey(null);
      setDismissReason('');
    }
    setPromotingId(null);
  };

  // Only one inline flow is ever open, so opening a decline closes any
  // suggestion confirmation on the same screen.
  const startDismiss = (entry) => {
    setConfirmingPlayId(null);
    setDismissReason('');
    setDismissingKey(itemKey(entry.kind, entry.row.id));
  };

  const cancelDismiss = () => {
    setDismissingKey(null);
    setDismissReason('');
  };

  // Add to log opens the confirmation (Note 18) rather than writing straight
  // away: the objective link is the developer's to agree, and criticality
  // derives from it. The play's own objective is offered as the default,
  // because that is what selected the play, but it is a default and not a
  // decision already taken on their behalf.
  const startAddPlay = (suggestion) => {
    setDismissingKey(null);
    setPlayObjectiveId(suggestion.linkedObjectiveId ?? '');
    setConfirmingPlayId(suggestion.playId);
  };

  const cancelAddPlay = () => {
    setConfirmingPlayId(null);
    setPlayObjectiveId('');
  };

  // Add to log (M7.4, confirmed under Note 18): accept a suggested play. The
  // tracked action lands with the objective the developer confirmed and the
  // criticality that derives from it, the suggestion leaves the band in the
  // same interaction, and the decision is recorded with who and when. The
  // playbook state row is what keeps it gone on the next visit; the decision row
  // is the trail beside it. One at a time, like promotion.
  const acceptPlay = async (suggestion) => {
    if (actingPlayId) return;
    setActingPlayId(suggestion.playId);
    setError(null);

    const linkedObjectiveId = playObjectiveId || null;
    const criticality = confirmedPlayCriticality(
      suggestion,
      linkedObjectiveId,
      (id) => cascadeCriticality(id, objectives)
    );

    const { data, error: insErr } = await supabase
      .from('project_actions')
      .insert(
        buildActionFromPlay(suggestion, projectId, {
          linkedObjectiveId,
          criticality,
        })
      )
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

    await recordTriageDecision(supabase, {
      projectId,
      itemKind: 'play',
      itemId: suggestion.playId,
      itemName: suggestion.title ?? null,
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.ADDED,
      createdActionId: data.id,
      decidedBy: userId,
    });

    setActions((as) => [data, ...as]);
    setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    setConfirmingPlayId(null);
    setPlayObjectiveId('');
    setActingPlayId(null);
  };

  // Dismiss (M7.4, recorded under Note 18): records dismissed for this project,
  // with the reason, the decider and the timestamp. Dismissed stays dismissed;
  // no re-nagging. Declining curated knowledge is a judgement about this
  // project, so it is recorded as one.
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

    const { error: recErr } = await recordTriageDecision(supabase, {
      projectId,
      itemKind: 'play',
      itemId: suggestion.playId,
      itemName: suggestion.title ?? null,
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.DISMISSED,
      reason,
      decidedBy: userId,
    });
    if (recErr) setError(DISMISS_ERROR);

    setActedPlayIds((ids) => new Set(ids).add(suggestion.playId));
    setDismissingKey(null);
    setDismissReason('');
    setActingPlayId(null);
  };

  const startDismissPlay = (suggestion) => {
    setConfirmingPlayId(null);
    setDismissReason('');
    setDismissingKey(itemKey('play', suggestion.playId));
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

  // One queued item (A5, reworked under Note 18): a risk or a RAID item
  // (assumption, constraint, dependency) from the Brief, awaiting triage.
  //
  // It states what it is, how it relates to the objective it is linked to
  // (a risk THREATENS, a RAID item BEARS ON; "vs Cost" said neither), the
  // severity band where one is scored, and its provenance as a link straight to
  // the source item, so the developer can go and read it before deciding. Then
  // the three responses: track it, review it in the register, or decline it
  // with a recorded reason. Unmistakably a queued suggestion, never mixed with
  // tracked actions.
  const renderPushItem = (entry) => {
    const { kind, row, reasons, severity } = entry;
    const isRisk = kind === 'risk';
    const linkedName = objectiveName(row.linked_objective_id);
    const promoting = promotingId === row.id;
    const key = itemKey(kind, row.id);
    const dismissingThis = dismissingKey === key;
    // The source item itself: a risk lives in the register, a RAID item in the
    // Brief that captured it.
    const sourceHref = isRisk ? `${registerHref}#risk-${row.id}` : briefHref;

    return (
      <article
        key={`${kind}-${row.id}`}
        className={`${styles.pushItem} ${
          reasons.critical ? styles.pushItemCritical : ''
        }`}
      >
        <div className={styles.pushTags}>
          {/* A queued item keeps the criticality it has already derived: its
              objective link is real, unlike a suggestion's. */}
          {reasons.critical && (
            <span className={`${styles.chip} ${styles.chipCritical}`}>
              Critical
            </span>
          )}
          <SeverityTag severity={severity} />
          {!isRisk && <span className={styles.kind}>{KIND_LABEL[kind]}</span>}
          <span className={styles.objective}>
            {objectiveRelation(kind, linkedName)}
          </span>
        </div>
        <p className={styles.pushName}>{row.description}</p>
        <Link
          href={sourceHref}
          className={styles.fromRisk}
          aria-label={`${provenanceLabel(kind)}: open ${row.description}`}
        >
          {provenanceLabel(kind)}
        </Link>
        {/* Track this and Dismiss both write, so they are admin only. Review in
            register is read-only navigation and stays for everyone. The row
            shows no action bar when neither applies. */}
        {(canEdit || isRisk) && (
          <>
            {dismissingThis ? (
              <div className={styles.triageForm}>
                <input
                  type="text"
                  className={styles.input}
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder={DISMISS_REASON_PLACEHOLDER}
                  aria-label={`Reason for dismissing ${row.description}`}
                  autoComplete="off"
                  maxLength={200}
                />
                <div className={styles.pushActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => dismissItem(entry)}
                    disabled={dismissReason.trim() === '' || promotingId !== null}
                  >
                    {promoting ? 'Recording' : 'Dismiss'}
                  </button>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={cancelDismiss}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
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
                {canEdit && (
                  <button
                    type="button"
                    className={styles.footBtn}
                    onClick={() => startDismiss(entry)}
                    disabled={promotingId !== null}
                    aria-label={`Dismiss: ${row.description}`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    );
  };

  // One suggested play in the PULSE suggests band (M7.4, reworked under Note
  // 18): the title, the why line in full (the why is the knowledge transfer;
  // never truncated), the basis on which it was selected, and the two
  // responses.
  //
  // IT WEARS NO CRITICALITY CHIP. Criticality is derived from the objective an
  // item serves, and a suggestion serves none yet: the developer has not agreed
  // to take it on. The chip it used to carry was classifying an item that did
  // not exist. Add to log confirms the link first, and the criticality follows
  // it, read-only. What the card does say is its BASIS, which is the honest
  // version of what the chip was gesturing at: the stage it belongs to, and the
  // objective classification that put it in front of this developer.
  const renderPlaySuggestion = (s) => {
    const acting = actingPlayId === s.playId;
    const confirming = confirmingPlayId === s.playId;
    const dismissingThis = dismissingKey === itemKey('play', s.playId);
    const confirmedCriticality = confirmedPlayCriticality(
      s,
      playObjectiveId || null,
      (id) => cascadeCriticality(id, objectives)
    );

    return (
      <article key={s.playId} className={styles.pushItem}>
        <p className={styles.playTitle}>{s.title}</p>
        <p className={styles.why}>{s.why}</p>
        <p className={styles.basis}>{s.basis}</p>

        {confirming ? (
          <div className={styles.triageForm}>
            <span className={styles.controlLabel}>
              Which objective does this serve?
            </span>
            <ObjectiveSelect
              value={playObjectiveId}
              onChange={setPlayObjectiveId}
              objectives={objectives}
              ariaLabel={`Objective served by ${s.title}`}
            />
            <p className={styles.critCaption}>
              {inheritedCriticalityLine(
                confirmedCriticality,
                objectiveName(playObjectiveId || null),
                s.alwaysCritical
              )}
            </p>
            <div className={styles.pushActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => acceptPlay(s)}
                disabled={actingPlayId !== null}
              >
                {acting ? 'Adding' : 'Add to log'}
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
        ) : dismissingThis ? (
          <div className={styles.triageForm}>
            <input
              type="text"
              className={styles.input}
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder={DISMISS_REASON_PLACEHOLDER}
              aria-label={`Reason for dismissing ${s.title}`}
              autoComplete="off"
              maxLength={200}
            />
            <div className={styles.pushActions}>
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
                onClick={cancelDismiss}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.pushActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => startAddPlay(s)}
              disabled={actingPlayId !== null}
              aria-label={`Add to log: ${s.title}`}
            >
              Add to log
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

  // A tracked action's provenance tag (Note 18): where it came from, stated the
  // same way on the interactive card and the read-only one, so the two can
  // never drift. A risk-raised action links back to the risk in the register; a
  // RAID, playbook or programme-raised action names its origin. A hand-logged
  // action has no engine provenance to state and shows nothing.
  const renderSourceTag = (a) => {
    const label = provenanceLabel(a.source);
    if (!label) return null;
    if (a.source === 'risk') {
      return (
        <Link
          href={a.source_id ? `${registerHref}#risk-${a.source_id}` : registerHref}
          className={styles.fromRisk}
          title="Raised from a risk in your register"
        >
          {label}
        </Link>
      );
    }
    return <span className={styles.provenance}>{label}</span>;
  };

  // The criticality detail under an action: the derivation in plain language
  // and the one allowed change. Shown only when there is something to say or
  // do; a plain derived-standard action needs neither.
  const renderCritDetail = (a, { overridden, critical, unlinked, linkedName }) => {
    const overriding = overridingId === a.id;

    // Unlinked: the link is the only lever, so point at it. The caption says
    // where the action stands TODAY as well as what would change it (Note 18):
    // "No objective" is a permitted answer and holds at Standard, which is what
    // the criticality column has always stored for an unlinked item. Saying only
    // "link an objective to set this" implied it had no criticality at all.
    if (unlinked) {
      return (
        <div className={styles.critDetail}>
          <p className={styles.critCaption}>
            No objective linked, so this holds at Standard. Link one to derive
            its criticality.
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
    return (
      <article
        key={a.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <CriticalityChip critical={critical} unlinked={unlinked} />
            {linkedName && (
              <span className={styles.objective}>for {linkedName}</span>
            )}
            {renderSourceTag(a)}
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

    return (
      <article
        key={a.id}
        className={`${styles.card} ${critical ? styles.cardCritical : ''}`}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTags}>
            <CriticalityChip critical={critical} unlinked={unlinked} />
            {linkedName && (
              <span className={styles.objective}>for {linkedName}</span>
            )}
            {renderSourceTag(a)}
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
            <span className={styles.roLabel}>Status</span>
            <span className={styles.roValue}>{statusLabel ?? 'Not set'}</span>
          </div>
        </div>

        {isDone(a) && (
          <div className={styles.outcome}>
            <div className={styles.controlRow}>
              <span className={styles.roLabel}>Outcome</span>
              <span className={styles.roValue}>
                {outcomeLabel ?? 'Not recorded'}
              </span>
            </div>
            {variance && (
              <div className={styles.controlRow}>
                <span className={styles.roLabel}>What varied</span>
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

      {/* The triage queue (M7.2, reframed under Note 18): the Critical items
          the developer wrote into their own Brief, derived live, arriving to be
          sorted. The heading says exactly that, because the same list under
          "Needs your response" read as a list of failures on a project where
          nothing had yet gone wrong. When nothing qualifies it collapses to one
          calm line. Quiet is a feature. */}
      {needsResponse.length > 0 ? (
        <section className={styles.band} aria-labelledby="triage-queue">
          <h2 id="triage-queue" className={styles.bandHeading}>
            {TRIAGE_HEADING}
          </h2>
          <p className={styles.bandIntro}>
            {needsResponse.length}{' '}
            {needsResponse.length === 1 ? 'item' : 'items'} to sort. Track what
            you will act on, or dismiss it with a reason.
          </p>
          <SeverityLegend />
          <div className={styles.bandList}>
            {needsResponse.map(renderPushItem)}
          </div>
        </section>
      ) : (
        <p className={styles.bandQuiet}>{TRIAGE_QUIET}</p>
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
          {/* The amber read is gated on a live count: a zero never glows. */}
          <span
            className={`${styles.statValue} ${
              criticalOpenCount > 0 ? styles.statCritical : ''
            }`}
          >
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
          {/* The criticality this will log at, read-only (Note 18). It is
              derived from the objective link and is never chosen here, so the
              form states it rather than offering it. "No objective" stays a
              permitted answer and derives Standard; linking one derives it per
              the cascade. It used to appear only when the answer was Critical,
              which left the developer to infer the rest. */}
          <span
            className={`${styles.addHint} ${
              draftCriticality === 'critical' ? styles.addHintCritical : ''
            }`}
          >
            {inheritedCriticalityLine(
              draftCriticality,
              objectiveName(draftObjectiveId || null),
              false
            )}
          </span>
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

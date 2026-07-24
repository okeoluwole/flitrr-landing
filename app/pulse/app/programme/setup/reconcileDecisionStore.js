/**
 * Reconcile decision store (Note 14).
 *
 * The read and write layer for the decision a developer records on every
 * flagged Brief date at Programme set-up. Every outcome of the one decision
 * grammar (accepted, kept, amended, verified, deferred) ends here as a row in
 * project_reconcile_decisions (migration 029), carrying what was decided, the
 * operational date it set, who decided, and when.
 *
 * WHY THIS IS THE BRIEF'S APPROVALS TRAIL. A reconcile decision is a
 * baseline-setting decision, so every row is stamped with the locked Brief
 * version it was taken against (source_brief_id) alongside its decider and
 * timestamp, exactly as the Brief lock and the stage gates are. It joins that
 * governance history rather than sitting beside it as UI state. THE LOCKED
 * BRIEF IS NEVER MUTATED: an amend sets the OPERATIONAL date on the baseline
 * and is recorded here as a variance from the Brief's target, which is what
 * lets the lock-time reconciliation check
 * (lib/engine/programmeReconciliation.js) read the gap as explained rather than
 * as a blocking mismatch.
 *
 * THE OPEN VERIFICATION ACTION. A deferred decision (verify later) proceeds on
 * the developer's own date and owes a check, so it raises a real action on the
 * Action Log with the citable reason it was raised, the stage it bears on, and
 * a link to the objective the point serves so the Action Log derives its
 * criticality the way it derives every other one. The action's id rides back
 * onto the decision row, so the record and the outstanding work stay tied.
 *
 * APPEND ONLY. One row per decision event. Re-deciding a point (stepping back
 * to reconcile and changing an answer) appends a new row and the current
 * decision is the latest by decided_at; nothing is edited and nothing is
 * deleted. The write path is idempotent against a re-proceed: a decision that
 * has not changed writes nothing, and a point already carrying a live deferral
 * does not raise a second action.
 *
 * The pure decision logic (latestDecisionsByKey, decisionRowFrom,
 * verificationActionFrom, planDecisionWrites) carries the rules and is unit
 * tested in isolation. The two async functions wrap it in the repo's Supabase
 * convention: the caller passes its already-awaited client, and each returns
 * its rows alongside Supabase's { error } (null on error).
 */

import { toStoredCriticality } from '../../../../../lib/engine/criticality.js';
import {
  RECONCILE_DECISIONS,
  softEpoch,
  toDateInputValue,
} from './reconcileModel.js';

const { KEPT, AMENDED, DEFERRED } = RECONCILE_DECISIONS;

// The columns a decision row carries, read in one place so the reads stay in
// step. snake_case as the database holds them.
export const DECISION_COLUMNS =
  'id, project_id, source_brief_id, point_key, point_kind, point_name, stage, tier, decision, brief_date, recommended_date, agreed_date, note, action_id, decided_by, decided_at';

// The columns an action row is read back with after a verification action is
// raised, matching the Action Log's own read so the row drops straight into it.
const ACTION_COLUMNS =
  'id, description, linked_objective_id, criticality, criticality_override, status, stage, source, source_id, reason, created_at';

/**
 * The latest decision per point key from a set of rows, the current decision for
 * each point. Append-only means a point can carry several rows; the newest by
 * decided_at wins, with the row order as the tiebreak so the result is
 * deterministic on identical timestamps. Pure; the rows are passed in.
 */
export function latestDecisionsByKey(rows) {
  const byKey = new Map();
  for (const row of rows ?? []) {
    if (row == null || row.point_key == null) continue;
    const held = byKey.get(row.point_key);
    if (held == null) {
      byKey.set(row.point_key, row);
      continue;
    }
    const heldAt = softEpoch(held.decided_at) ?? 0;
    const rowAt = softEpoch(row.decided_at) ?? 0;
    if (rowAt >= heldAt) byKey.set(row.point_key, row);
  }
  return byKey;
}

/**
 * Has this resolution already been recorded? True when the latest row for the
 * point holds the same decision, the same operational date and the same note, so
 * a developer who steps back to the reconcile screen, changes nothing, and
 * proceeds again writes no duplicate. Any real change writes a new row, which is
 * the history.
 */
export function decisionUnchanged(resolution, existingRow) {
  if (existingRow == null) return false;
  if (existingRow.decision !== resolution?.decision) return false;
  if (
    toDateInputValue(existingRow.agreed_date) !==
    toDateInputValue(resolution?.agreedDate)
  ) {
    return false;
  }
  const heldNote = existingRow.note ?? null;
  const newNote = resolution?.note ?? null;
  return heldNote === newNote;
}

/**
 * One decision row from one resolution. Pure row shaping: no clock (decided_at
 * is the database's NOW() default) and no id invention. actionId is attached by
 * the caller once a verification action has been raised for a deferral.
 */
export function decisionRowFrom(resolution, { projectId, sourceBriefId, decidedBy, actionId = null }) {
  return {
    project_id: projectId,
    source_brief_id: sourceBriefId ?? null,
    point_key: resolution.key,
    point_kind: resolution.kind,
    point_name: resolution.name ?? null,
    stage: resolution.stage ?? null,
    tier: resolution.tier,
    decision: resolution.decision,
    brief_date: toDateInputValue(resolution.developerDate) || null,
    recommended_date: toDateInputValue(resolution.recommendedDate) || null,
    agreed_date: toDateInputValue(resolution.agreedDate) || null,
    note: resolution.note ?? null,
    action_id: actionId,
    decided_by: decidedBy ?? null,
  };
}

/**
 * The citable one-line why a verification action was raised, stored on the
 * action so the trace survives the flow that created it. Named for the point so
 * the developer can act on it weeks later without opening set-up again.
 */
export function verificationReason(resolution) {
  const name = resolution?.name ?? resolution?.key ?? 'a programme date';
  return `Raised at Programme set-up: the date for ${name} was not verified locally.`;
}

/**
 * The project_actions row a deferred decision raises: an open verification
 * action on the Action Log. It follows the promoted-item shape
 * (actionFeed.buildTrackedActionFromRisk): a plain description, the objective
 * the point serves so criticality DERIVES rather than being entered, the stage
 * it bears on for gate readiness, the citable reason, and the programme source.
 *
 * objectivesById is the criticality kernel's index, so the baseline criticality
 * stamped at creation is the cascade value the kernel would stamp on any other
 * item (toStoredCriticality, the only derivation that writes). A gate serves no
 * single objective, so it carries no link and the Action Log surfaces it as
 * needing one, which is honest rather than a silent standard.
 */
export function verificationActionFrom(
  resolution,
  { projectId, linkedObjectiveId = null, objectivesById = {}, currentStage = null }
) {
  const name = resolution?.name ?? resolution?.key ?? 'a programme date';
  return {
    project_id: projectId,
    description: `Verify locally: the date for ${name}`,
    linked_objective_id: linkedObjectiveId,
    criticality: toStoredCriticality(linkedObjectiveId, objectivesById),
    stage: resolution?.stage ?? currentStage ?? null,
    reason: verificationReason(resolution),
    source: 'programme',
  };
}

/**
 * The write plan for a proceed: which decisions to record, and which deferrals
 * still need an open verification action raised. Pure and deterministic.
 *
 *   resolutions       the resolution set from buildResolutions
 *   existingRows      the project's decision rows already recorded
 *   objectiveIdFor    a function from a resolution to the id of the objective
 *                     the point serves, or null
 *
 * Returns { toRecord, toRaise }:
 *   toRecord  the resolutions whose decision has changed, so they get a row
 *   toRaise   the subset of those that are deferrals not already carrying a
 *             live deferral, so each raises exactly one action
 *
 * A resolution with no decision at all is skipped: the screen gates proceed on
 * canProceed, so this only ever guards a caller that did not.
 */
export function planDecisionWrites({ resolutions, existingRows, objectiveIdFor = () => null }) {
  const latest = latestDecisionsByKey(existingRows);
  const toRecord = [];
  const toRaise = [];

  for (const resolution of resolutions ?? []) {
    if (resolution == null || resolution.decision == null) continue;
    const held = latest.get(resolution.key) ?? null;
    if (decisionUnchanged(resolution, held)) continue;
    toRecord.push(resolution);
    // One open action per deferral. A point already sitting on a deferral that
    // raised an action does not raise a second one when the note is edited.
    if (resolution.decision === DEFERRED) {
      const alreadyDeferred =
        held != null && held.decision === DEFERRED && held.action_id != null;
      if (!alreadyDeferred) {
        toRaise.push({
          resolution,
          linkedObjectiveId: objectiveIdFor(resolution) ?? null,
        });
      }
    }
  }

  return { toRecord, toRaise };
}

/**
 * Load a project's recorded reconcile decisions, newest first. Returns
 * { decisions, error }.
 */
export async function loadReconcileDecisions(supabase, projectId) {
  const { data, error } = await supabase
    .from('project_reconcile_decisions')
    .select(DECISION_COLUMNS)
    .eq('project_id', projectId)
    .order('decided_at', { ascending: false });
  if (error) return { decisions: null, error };
  return { decisions: data ?? [], error: null };
}

/**
 * Record the decisions taken on a proceed, raising an open verification action
 * for each new deferral first so its id can ride onto the decision row.
 *
 * The order matters: the action is the outstanding work and the decision row is
 * the record of it, so the action is created first and referenced second. If an
 * action fails to insert, the decision is still recorded (with a null action_id)
 * and the failure is returned, because a decision that was made must not be lost
 * because a downstream write faltered.
 *
 * Returns { decisions, actions, error }: the written decision rows, the raised
 * action rows, and the first error encountered (null when everything landed).
 */
export async function recordReconcileDecisions(
  supabase,
  {
    projectId,
    sourceBriefId = null,
    decidedBy = null,
    resolutions,
    objectiveIdFor = () => null,
    objectivesById = {},
    currentStage = null,
  }
) {
  const { data: existingRows, error: readErr } = await supabase
    .from('project_reconcile_decisions')
    .select(DECISION_COLUMNS)
    .eq('project_id', projectId);
  if (readErr) return { decisions: [], actions: [], error: readErr };

  const { toRecord, toRaise } = planDecisionWrites({
    resolutions,
    existingRows: existingRows ?? [],
    objectiveIdFor,
  });
  if (toRecord.length === 0) {
    return { decisions: [], actions: [], error: null };
  }

  // Raise the open verification actions first, so each decision row can carry
  // its action id.
  let firstError = null;
  const actionIdByKey = new Map();
  const actions = [];
  for (const { resolution, linkedObjectiveId } of toRaise) {
    const { data, error } = await supabase
      .from('project_actions')
      .insert(
        verificationActionFrom(resolution, {
          projectId,
          linkedObjectiveId,
          objectivesById,
          currentStage,
        })
      )
      .select(ACTION_COLUMNS)
      .single();
    if (error || !data) {
      firstError = firstError ?? error;
      continue;
    }
    actionIdByKey.set(resolution.key, data.id);
    actions.push(data);
  }

  const rows = toRecord.map((resolution) =>
    decisionRowFrom(resolution, {
      projectId,
      sourceBriefId,
      decidedBy,
      actionId: actionIdByKey.get(resolution.key) ?? null,
    })
  );

  const { data: written, error: insErr } = await supabase
    .from('project_reconcile_decisions')
    .insert(rows)
    .select(DECISION_COLUMNS);
  if (insErr) return { decisions: [], actions, error: insErr };

  return { decisions: written ?? [], actions, error: firstError };
}

// The decision vocabulary as the review screen and the frozen baseline read it,
// one label per outcome. Kept here so the record and its rendering cannot drift.
export const DECISION_LABEL = Object.freeze({
  accepted: 'Accepted the recommendation',
  kept: 'Kept your date, with the reason recorded',
  amended: 'Amended the date',
  verified: 'Confirmed, verified locally',
  deferred: 'Verify later, an open action was raised',
});

/**
 * One recorded decision as a plain sentence for the review screen, so the
 * decision set reads before the lock rather than only after it. Names the point,
 * the outcome and the operational date it set.
 */
export function describeDecision(resolution) {
  const name = resolution?.name ?? resolution?.key ?? 'A programme point';
  const stagePart = resolution?.stage != null ? ` (Stage ${resolution.stage})` : '';
  const label = DECISION_LABEL[resolution?.decision] ?? 'Decision recorded';
  if (resolution?.decision === KEPT || resolution?.decision === AMENDED) {
    const reason = resolution?.note ? `: ${resolution.note}` : '';
    return `${name}${stagePart}: ${label}${reason}.`;
  }
  return `${name}${stagePart}: ${label}.`;
}

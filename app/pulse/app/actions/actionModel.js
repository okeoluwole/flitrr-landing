/**
 * Action Log model (M7.1, re-rooted in Phase 2 A2). Pure, deterministic helpers
 * shared by the server page, the client log, and the workspace tile. No AI, no
 * state, no side effects, so the same inputs always give the same verdict.
 *
 * CRITICALITY IS LIVE (A2). An action's criticality is derived from the
 * objective it serves, read from that objective's CURRENT classification, the
 * same pattern riskMonitor.js uses for risks (read the locked baseline, derive
 * each item's criticality from the objective it serves, flag proportionally):
 *   - linked to a non-negotiable objective -> critical
 *   - linked to a flexible objective       -> standard
 *   - linked to nothing                    -> unlinked, surfaced as "needs a
 *     link", never a silent standard, because the link is the only lever.
 * project_actions.criticality is now only the baseline snapshot stamped at
 * creation (mirroring project_risks.criticality); no live decision reads it.
 *
 * THE OVERRIDE IS DOWNWARD ONLY (A2). A derived-critical action may be reduced
 * to standard with a recorded reason (criticality_override = 'standard' plus
 * override_reason). It can never be raised: to make an action critical, link it
 * to a non-negotiable objective. The override is honoured ONLY while the
 * derivation is critical, so it can only ever lower critical to standard, never
 * lift standard or unlinked, and a stale override left on an action whose link
 * later moved to a flexible objective falls inert rather than silently demoting.
 * The derived value is always kept and shown alongside the override; the
 * derivation is never erased.
 *
 * Status is the log's own small lifecycle (action_status enum):
 *   to_do -> doing -> done
 * Done actions leave the default list but stay on the table; delete is for
 * mistakes, done is for completed work.
 */

import {
  CRITICALITY,
  CRITICALITY_RANK,
  buildObjectiveIndex,
  deriveCriticality,
  applyDownwardOverride,
  effectiveCriticality as kernelEffectiveCriticality,
} from '../../../../lib/engine/criticality.js';

// The criticality vocabulary, the attention ranking, the live derivation and
// the downward-only override all live in the engine kernel now (A3); this model
// is the Action Log's thin, action-shaped face over them. CRITICALITY is
// re-exported because ActionLog and the tests import it from here;
// CRITICALITY_RANK stays internal to the sort below.
export { CRITICALITY };

// isDone, actionStage, isCritical, and gateReadiness moved down into the engine
// (A8, lib/engine/readiness.js) so lib/digest depends only on lib/engine and no
// longer reaches up into app/. They are re-exported here so ActionLog and the
// workspace keep importing them from this model unchanged; isCritical and
// gateReadiness defer to the criticality kernel exactly as the inline versions
// did, so behaviour is unchanged.
export {
  isDone,
  actionStage,
  isCritical,
  gateReadiness,
} from '../../../../lib/engine/readiness.js';

// Status (action_status enum), in lifecycle order for the one-tap control.
export const STATUS_OPTIONS = [
  { value: 'to_do', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

// Outcome (action_outcome enum, A7), captured when an action is closed: the
// lessons-learnt input. delivered: done as planned. partial: done with a
// compromise worth noting. not_delivered: closed without delivering.
export const OUTCOME_OPTIONS = [
  { value: 'delivered', label: 'Delivered' },
  { value: 'partial', label: 'Partial' },
  { value: 'not_delivered', label: 'Not delivered' },
];

// The log's locked-state copy is no longer this module's (Note 13). All three
// monitoring modules are gated by the same fixed sequence and share one honest
// line, workspace/sequenceModel.js moduleLockedLine, which the tile and the
// page's own guard both read.

/**
 * Index objectives by id so the derivation can read the linked objective's
 * current classification. A thin wrapper over the kernel's buildObjectiveIndex,
 * returning just the by-id map the Action Log's consumers expect. Accepts
 * anything carrying id and classification: the page's objectiveOptions and the
 * workspace's project_objectives rows both qualify.
 */
export function objectivesById(objectives) {
  return buildObjectiveIndex(objectives).byId;
}

/**
 * The action's criticality as its linked objective classifies it, before any
 * override. Delegates to the kernel by the action's linked_objective_id;
 * 'unlinked' when there is no link or the link does not resolve: a governance
 * gap surfaced as "needs a link", never a silent standard.
 */
export function derivedCriticality(action, byId) {
  return deriveCriticality(action?.linked_objective_id, byId);
}

/**
 * Whether a downward override is in force: true only when the kernel's
 * downward-only rule actually lowers the derived value (a derived-critical
 * action carrying criticality_override = 'standard'). Asking the kernel keeps
 * the override rule in one place and inert once the link is no longer critical.
 */
export function hasDownwardOverride(action, byId) {
  const derived = derivedCriticality(action, byId);
  return (
    applyDownwardOverride(derived, action?.criticality_override) !== derived
  );
}

/**
 * The criticality every live decision reads: the derived value, lowered to
 * standard only by an active downward override. Never raised. Delegates to the
 * kernel with the action's link and override.
 */
export function effectiveCriticality(action, byId) {
  return kernelEffectiveCriticality(
    action?.linked_objective_id,
    byId,
    action?.criticality_override
  );
}

// A lesson is captured once an outcome is recorded on a closed action (A7).
// variance is optional, so the outcome alone counts; capture stays permissive.
export function isLessonCaptured(action) {
  return action?.outcome != null;
}

/**
 * Sort for the log: by live criticality band (critical, then unlinked, then
 * standard), and within each band most recent first. CRITICALITY_RANK is the
 * kernel's shared attention order (critical, then the unlinked governance gap,
 * then standard, mirroring the risk monitor). created_at is an ISO timestamp in
 * one consistent format, so string comparison orders it correctly without Date
 * parsing.
 */
export function sortActions(actions, byId) {
  return [...actions].sort((a, b) => {
    const ra = CRITICALITY_RANK[effectiveCriticality(a, byId)];
    const rb = CRITICALITY_RANK[effectiveCriticality(b, byId)];
    if (ra !== rb) return ra - rb;
    if (a.created_at === b.created_at) return 0;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/**
 * The engine knowledge source a surfaced or engine-raised item is labelled by
 * (A4), derived from its source. Only the sources that exist today carry a
 * label: a risk or a RAID item (assumption, constraint, dependency) is an
 * observation from this project, a playbook item is a draw from PULSE's curated
 * knowledge. External reference and the network are not built, so nothing is
 * ever labelled with a source PULSE cannot stand behind, and a hand-logged
 * action (the developer's own) has no engine provenance.
 */
export const PROVENANCE = {
  risk: 'This project',
  assumption: 'This project',
  constraint: 'This project',
  dependency: 'This project',
  playbook: 'Playbook library',
};

export function provenanceLabel(source) {
  return PROVENANCE[source] ?? null;
}

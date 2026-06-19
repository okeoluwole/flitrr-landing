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

// Live criticality values. 'critical' and 'standard' are the binary scheme;
// 'unlinked' is the derived-only governance gap, never stored.
export const CRITICALITY = {
  CRITICAL: 'critical',
  STANDARD: 'standard',
  UNLINKED: 'unlinked',
};

// Status (action_status enum), in lifecycle order for the one-tap control.
export const STATUS_OPTIONS = [
  { value: 'to_do', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

/**
 * Index objectives by id so the derivation can read the linked objective's
 * current classification. Accepts anything carrying id and classification: the
 * page's objectiveOptions and the workspace's project_objectives rows both
 * qualify.
 */
export function objectivesById(objectives) {
  const byId = {};
  for (const o of objectives ?? []) {
    if (o && o.id) byId[o.id] = o;
  }
  return byId;
}

/**
 * The action's criticality as its linked objective classifies it, before any
 * override. 'unlinked' when there is no link or the link does not resolve: a
 * governance gap surfaced as "needs a link", never a silent standard.
 */
export function derivedCriticality(action, byId) {
  const id = action?.linked_objective_id;
  const objective = id ? byId?.[id] : null;
  if (!objective) return CRITICALITY.UNLINKED;
  return objective.classification === 'non_negotiable'
    ? CRITICALITY.CRITICAL
    : CRITICALITY.STANDARD;
}

/**
 * Whether a downward override is in force. True only for a derived-critical
 * action carrying criticality_override = 'standard'. Every other case ignores
 * the override column, which is what keeps the override strictly downward and
 * makes a stale override inert once the link is no longer critical.
 */
export function hasDownwardOverride(action, byId) {
  return (
    derivedCriticality(action, byId) === CRITICALITY.CRITICAL &&
    action?.criticality_override === CRITICALITY.STANDARD
  );
}

/**
 * The criticality every live decision reads: the derived value, lowered to
 * standard only by an active downward override. Never raised.
 */
export function effectiveCriticality(action, byId) {
  const derived = derivedCriticality(action, byId);
  return hasDownwardOverride(action, byId) ? CRITICALITY.STANDARD : derived;
}

// An action is critical when its effective criticality is critical. The log
// orders, counts, and styles by this, not by the stored snapshot.
export function isCritical(action, byId) {
  return effectiveCriticality(action, byId) === CRITICALITY.CRITICAL;
}

// Done actions leave the default list and sit under the done filter.
export function isDone(action) {
  return action.status === 'done';
}

// Attention order by live criticality: critical first, then unlinked (a
// governance gap that can hide a critical action, so it sits above standard),
// then standard. Mirrors riskMonitor's ranking so the modules order alike.
const CRITICALITY_RANK = {
  [CRITICALITY.CRITICAL]: 0,
  [CRITICALITY.UNLINKED]: 1,
  [CRITICALITY.STANDARD]: 2,
};

/**
 * Sort for the log: by live criticality band (critical, then unlinked, then
 * standard), and within each band most recent first. created_at is an ISO
 * timestamp in one consistent format, so string comparison orders it correctly
 * without Date parsing.
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

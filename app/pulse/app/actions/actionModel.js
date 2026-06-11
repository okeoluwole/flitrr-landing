/**
 * Action Log model (M7.1). Pure, deterministic helpers shared by the server
 * page and the client log. No AI, no state, no side effects.
 *
 * Criticality is the one product-wide definition reused verbatim: an action
 * is critical when its `criticality` column is 'critical' (the shared
 * criticality_level enum the milestones, workstreams, and risks also carry).
 * The cascade that defaults it at creation lives in cascadeCriticality
 * (listStepConfig.js), the same helper the wizard uses, so the Action Log
 * never computes a second definition.
 *
 * Status is the log's own small lifecycle (action_status enum):
 *   to_do -> doing -> done
 * Done actions leave the default list but stay on the table; delete is for
 * mistakes, done is for completed work.
 */

// Status (action_status enum), in lifecycle order for the one-tap control.
export const STATUS_OPTIONS = [
  { value: 'to_do', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

// An action is critical by the product-wide definition: its criticality
// column.
export function isCritical(action) {
  return action.criticality === 'critical';
}

// Done actions leave the default list and sit under the done filter.
export function isDone(action) {
  return action.status === 'done';
}

/**
 * Sort for the log: critical actions above standard, and within each band,
 * most recent first. created_at is an ISO timestamp in one consistent
 * format, so string comparison orders it correctly without Date parsing.
 */
export function sortActions(actions) {
  return [...actions].sort((a, b) => {
    const ca = isCritical(a) ? 0 : 1;
    const cb = isCritical(b) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    if (a.created_at === b.created_at) return 0;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/**
 * Action feed model (M7.2). Pure, deterministic aggregation logic for the
 * Action Log's needs-your-response band. No DB, no React, no network: every
 * input is passed in, so the same inputs always give the same items and the
 * whole module is unit-testable in isolation.
 *
 * It sits beside actionModel.js and REUSES the risk model's derivations
 * (deriveSeverity, isCritical) rather than duplicating them, so the log and
 * the register can never disagree about what is Serious or what is Critical.
 * The explicit .js on those imports keeps this module runnable under Node
 * (Vitest) as well as under the Next bundler.
 *
 * THE TRIGGER RULE (M7.2 spec, A2). A risk generates a pushed item while ALL
 * three hold:
 *   1. the risk is critical (its criticality column, the register's own chip
 *      and the Brief's definition) OR its derived severity is Serious, and
 *   2. its status is watching or acting, and
 *   3. it has no open tracked action linked to it (source = risk, source_id =
 *      the risk id, status not done).
 * The item clears when the risk is set to accepted or closed, or when it is
 * promoted. A risk set to acting with nothing tracked keeps its item: the
 * platform is saying, track the work or formally accept the risk.
 *
 * THE DEDUPE is rule 3 read both ways: promoting a risk suppresses its item,
 * and marking that tracked action done (or deleting it) while the risk still
 * qualifies brings the item back. That return is correct behaviour, not a
 * bug; done is for completed work, and a still-qualifying risk still needs a
 * response.
 *
 * Items are NEVER rows in project_actions. They are computed at read time
 * from project_risks, which is why a register status change is all it takes
 * to clear one.
 */

import { deriveSeverity, isCritical, SEVERITY_RANK } from '../risk/riskModel.js';

// Register statuses that keep a risk live in the feed. accepted and closed
// are the developer's formal answers, so they clear the item.
const LIVE_STATUSES = new Set(['watching', 'acting']);

// An open tracked action is one not yet done. Done and deleted both lift the
// dedupe, by design.
function isOpenAction(action) {
  return action.status !== 'done';
}

/**
 * The set of risk ids that currently have an open tracked action promoted
 * from them (source = risk). One pass over the actions, reused by the feed
 * derivation and by anything that needs the dedupe answer alone.
 */
export function trackedRiskIds(actions) {
  const ids = new Set();
  for (const a of actions ?? []) {
    if (a.source === 'risk' && a.source_id && isOpenAction(a)) {
      ids.add(a.source_id);
    }
  }
  return ids;
}

/**
 * Derive the needs-your-response items from the live register rows and the
 * tracked actions. Returns items sorted for the band: critical first, then
 * Serious, then most recently flagged (updated_at, newest first).
 *
 * Each item carries what the band shows and what promotion needs:
 *   risk        the source row, untouched
 *   reasons     { critical, serious }, the plain chips explaining why it
 *               surfaced (one or both are true by the trigger rule)
 *   severity    { key, label } from deriveSeverity, the register's own read
 */
export function deriveRiskItems(risks, actions) {
  const tracked = trackedRiskIds(actions);

  const items = [];
  for (const risk of risks ?? []) {
    if (!LIVE_STATUSES.has(risk.status)) continue;
    if (tracked.has(risk.id)) continue;

    const severity = deriveSeverity(risk.likelihood, risk.impact);
    const critical = isCritical(risk);
    const serious = severity.key === 'serious';
    if (!critical && !serious) continue;

    items.push({ risk, reasons: { critical, serious }, severity });
  }

  return items.sort(compareRiskItems);
}

// Band order: critical first, then Serious, then most recently flagged.
// Array.sort is stable, so full ties keep their incoming order.
function compareRiskItems(a, b) {
  const ca = a.reasons.critical ? 0 : 1;
  const cb = b.reasons.critical ? 0 : 1;
  if (ca !== cb) return ca - cb;
  const sa = SEVERITY_RANK[a.severity.key];
  const sb = SEVERITY_RANK[b.severity.key];
  if (sa !== sb) return sa - sb;
  return parseTime(b.risk.updated_at) - parseTime(a.risk.updated_at);
}

// updated_at as epoch milliseconds, 0 when missing or unparseable, so the
// sort never throws on a partial row.
function parseTime(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Promote-to-track (M7.2 spec, A4): the project_actions row a pushed item
 * creates, pre-filled from its risk and editable after. Deterministic
 * template for the description; objective and criticality inherited from the
 * risk; source columns carry the link that makes the dedupe work. No
 * confirmation dialog, no extra fields.
 */
export function buildTrackedActionFromRisk(risk, projectId) {
  return {
    project_id: projectId,
    description: `Mitigate: ${risk.description}`,
    linked_objective_id: risk.linked_objective_id ?? null,
    criticality: risk.criticality,
    source: 'risk',
    source_id: risk.id,
  };
}

/**
 * The Action Log tile's live summary (M7.2 spec, A5). Counts of items
 * needing a response and open critical tracked actions, composed into one
 * calm line; the all-quiet zero state when both are zero.
 *   (2, 3) -> "2 need your response, 3 critical actions open"
 *   (1, 1) -> "1 needs your response, 1 critical action open"
 *   (0, 0) -> "All quiet. Nothing needs you right now."
 */
export function formatActionLogSummary(needsResponseCount, openCriticalCount) {
  const parts = [];
  if (needsResponseCount > 0) {
    parts.push(
      `${needsResponseCount} need${needsResponseCount === 1 ? 's' : ''} your response`
    );
  }
  if (openCriticalCount > 0) {
    parts.push(
      `${openCriticalCount} critical action${openCriticalCount === 1 ? '' : 's'} open`
    );
  }
  if (parts.length === 0) return 'All quiet. Nothing needs you right now.';
  return parts.join(', ');
}

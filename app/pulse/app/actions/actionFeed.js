/**
 * Action feed model (M7.2). Pure, deterministic aggregation logic for the
 * Action Log's needs-your-response band. No DB, no React, no network: every
 * input is passed in, so the same inputs always give the same items and the
 * whole module is unit-testable in isolation.
 *
 * It sits beside actionModel.js and REUSES the shared derivations (deriveSeverity
 * from the engine, and the criticality kernel's deriveCriticality for live
 * criticality) rather than duplicating them, so the log and the register can
 * never disagree about what is Serious or what is Critical. The explicit .js on
 * those imports keeps this module runnable under Node (Vitest) as well as under
 * the Next bundler.
 *
 * THE TRIGGER RULE (M7.2 spec, A2). A risk generates a pushed item while ALL
 * three hold:
 *   1. the risk is critical (derived live from the objective it threatens, the
 *      register's own chip) OR its derived severity is Serious, and
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
 * from project_risks and the RAID tables (A5), which is why a register status
 * change, or tracking the item, is all it takes to clear one.
 */

import { deriveSeverity, SEVERITY_RANK } from '../../../../lib/engine/severity.js';
import {
  CRITICALITY,
  deriveCriticality,
} from '../../../../lib/engine/criticality.js';

// Register statuses that keep a risk live in the feed. accepted and closed
// are the developer's formal answers, so they clear the item.
const LIVE_STATUSES = new Set(['watching', 'acting']);

// An open tracked action is one not yet done. Done and deleted both lift the
// dedupe, by design.
function isOpenAction(action) {
  return action.status !== 'done';
}

/**
 * The set of source-row ids that currently have an open tracked action of a
 * given source (risk, assumption, constraint, dependency). One pass over the
 * actions, reused by each feed derivation and by the dedupe.
 */
export function trackedSourceIds(actions, source) {
  const ids = new Set();
  for (const a of actions ?? []) {
    if (a.source === source && a.source_id && isOpenAction(a)) {
      ids.add(a.source_id);
    }
  }
  return ids;
}

// The risk-specific dedupe set, kept for the risk feed and its callers.
export function trackedRiskIds(actions) {
  return trackedSourceIds(actions, 'risk');
}

/**
 * Derive the needs-your-response items from the live register rows and the
 * tracked actions. Returns items sorted for the band: critical first, then
 * Serious, then most recently flagged (updated_at, newest first).
 *
 * Criticality is derived live from each risk's linked objective (B1) via the
 * kernel, the same read the register's chip now uses, so the band judges risks
 * and RAID alike against the current classification. objectivesById is the
 * project's objective index (id -> { classification }).
 *
 * Each item carries what the band shows and what promotion needs:
 *   risk        the source row, untouched
 *   reasons     { critical, serious }, the plain chips explaining why it
 *               surfaced (one or both are true by the trigger rule)
 *   severity    { key, label } from deriveSeverity, the register's own read
 */
export function deriveRiskItems(risks, actions, objectivesById) {
  const tracked = trackedRiskIds(actions);

  const items = [];
  for (const risk of risks ?? []) {
    if (!LIVE_STATUSES.has(risk.status)) continue;
    if (tracked.has(risk.id)) continue;

    const severity = deriveSeverity(risk.likelihood, risk.impact);
    const critical =
      deriveCriticality(risk.linked_objective_id, objectivesById) ===
      CRITICALITY.CRITICAL;
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
 * RAID feed (A5). The assumptions, constraints, and dependencies that threaten
 * a must-hold objective and are not yet tracked. Unlike a risk, a RAID item has
 * no severity score and no status: it surfaces purely because it bears on a
 * non-negotiable objective, derived live from the linked objective's current
 * classification, and the one response is to track it (there is no accept or
 * close as for a risk). `kind` is the source value: assumption, constraint, or
 * dependency. Each entry matches the unified feed shape below.
 */
export function deriveRaidItems(items, actions, objectivesById, kind) {
  const tracked = trackedSourceIds(actions, kind);
  const out = [];
  for (const item of items ?? []) {
    if (tracked.has(item.id)) continue;
    // Surfaces only when the item bears on a must-hold objective, classified
    // live by the kernel from the linked objective's current classification.
    if (
      deriveCriticality(item.linked_objective_id, objectivesById) !==
      CRITICALITY.CRITICAL
    ) {
      continue;
    }
    out.push({
      kind,
      row: item,
      reasons: { critical: true, serious: false },
      severity: null,
      updatedAt: item.updated_at,
    });
  }
  return out;
}

// Within the unified feed a risk carries its severity; a RAID item has none, so
// it ranks after serious risks but stays in the critical band.
function feedSeverityRank(entry) {
  return entry.severity
    ? SEVERITY_RANK[entry.severity.key]
    : Number.MAX_SAFE_INTEGER;
}

// Unified band order: critical first, then by severity (Serious soonest), then
// most recently flagged. Stable, so full ties keep their incoming order.
function compareFeedEntries(a, b) {
  const ca = a.reasons.critical ? 0 : 1;
  const cb = b.reasons.critical ? 0 : 1;
  if (ca !== cb) return ca - cb;
  const sa = feedSeverityRank(a);
  const sb = feedSeverityRank(b);
  if (sa !== sb) return sa - sb;
  return parseTime(b.updatedAt) - parseTime(a.updatedAt);
}

/**
 * The full needs-your-response feed (A5): the qualifying risks (the M7.2
 * trigger) and the must-hold-threatening RAID items, as one sorted list of
 * unified entries. Each entry is { kind, row, reasons, severity, updatedAt },
 * where kind is 'risk' | 'assumption' | 'constraint' | 'dependency'. The band
 * and the workspace tile both read this, so they never disagree.
 */
export function deriveResponseFeed({
  risks,
  assumptions,
  constraints,
  dependencies,
  actions,
  objectivesById,
}) {
  const entries = [];
  for (const { risk, reasons, severity } of deriveRiskItems(
    risks,
    actions,
    objectivesById
  )) {
    entries.push({
      kind: 'risk',
      row: risk,
      reasons,
      severity,
      updatedAt: risk.updated_at,
    });
  }
  const groups = [
    ['assumption', assumptions],
    ['constraint', constraints],
    ['dependency', dependencies],
  ];
  for (const [kind, items] of groups) {
    for (const entry of deriveRaidItems(items, actions, objectivesById, kind)) {
      entries.push(entry);
    }
  }
  return entries.sort(compareFeedEntries);
}

/**
 * The citable reason a promoted risk action was raised (A4): why it surfaced,
 * its criticality (derived live from the linked objective via the kernel, B1)
 * and whether its score is Serious, the same trigger the band reads. Captured
 * onto the tracked action at promotion so the engine's trace survives, even if
 * the risk later changes or closes. objectivesById is the project's objective
 * index (id -> { classification }).
 */
export function riskRaiseReason(risk, objectivesById) {
  const critical =
    deriveCriticality(risk?.linked_objective_id, objectivesById) ===
    CRITICALITY.CRITICAL;
  const serious = deriveSeverity(risk?.likelihood, risk?.impact).key === 'serious';
  if (critical && serious) return 'Raised from a critical risk scored serious.';
  if (critical) return 'Raised from a critical risk.';
  if (serious) return 'Raised from a risk scored serious.';
  return 'Raised from your risk register.';
}

/**
 * Promote-to-track (M7.2 spec, A4): the project_actions row a pushed item
 * creates, pre-filled from its risk and editable after. Deterministic
 * template for the description; the objective link and the stored criticality
 * baseline inherited from the risk (the Action Log derives its own live value
 * from the link); source columns carry the link that makes the dedupe work;
 * stamped with the stage the action is raised at (A3) for the gate-readiness
 * view; and the citable reason it was raised (A4, its criticality read live
 * from objectivesById, B1), so its provenance survives promotion. No
 * confirmation dialog, no extra fields.
 */
export function buildTrackedActionFromRisk(risk, projectId, stage, objectivesById) {
  return {
    project_id: projectId,
    description: `Mitigate: ${risk.description}`,
    linked_objective_id: risk.linked_objective_id ?? null,
    criticality: risk.criticality,
    stage,
    reason: riskRaiseReason(risk, objectivesById),
    source: 'risk',
    source_id: risk.id,
  };
}

// The action verb per RAID kind: an assumption is validated, a constraint is
// planned around, a dependency is secured.
const RAID_VERB = {
  assumption: 'Validate',
  constraint: 'Plan around',
  dependency: 'Secure',
};

/**
 * The citable reason a promoted RAID action was raised (A5): it bears on a
 * non-negotiable objective. Stored on the tracked action so the trace survives.
 */
export function raidRaiseReason(kind) {
  const noun =
    {
      assumption: 'an assumption',
      constraint: 'a constraint',
      dependency: 'a dependency',
    }[kind] ?? 'a Brief item';
  return `Raised from ${noun} on a non-negotiable objective.`;
}

/**
 * Promote-to-track a RAID item (A5): the project_actions row Track this creates,
 * the same shape as a promoted risk. A kind-specific verb leads the
 * description; objective and criticality inherited; stage stamped for gate
 * readiness; the citable reason kept; source is the RAID kind and source_id the
 * RAID row id, the polymorphic link the dedupe reads, mirroring risk.
 */
export function buildTrackedActionFromRaid(item, projectId, stage, kind) {
  const verb = RAID_VERB[kind] ?? 'Address';
  return {
    project_id: projectId,
    description: `${verb}: ${item.description}`,
    linked_objective_id: item.linked_objective_id ?? null,
    criticality: item.criticality,
    stage,
    reason: raidRaiseReason(kind),
    source: kind,
    source_id: item.id,
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

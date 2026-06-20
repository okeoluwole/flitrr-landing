/**
 * Risk monitoring model (engine consolidation, Step A7; built as M6.2.1,
 * formerly app/pulse/app/risk/riskMonitor.js). Pure, deterministic monitoring
 * logic shared by the Risk module and, later, Programme and Dashboard. No DB,
 * no React, no network, no system clock: every input is passed in, so the same
 * inputs always give the same verdict and the whole module is unit-testable in
 * isolation.
 *
 * A7 relocated it into lib/engine and de-duplicated it onto the engine: it
 * reads criticality from the kernel (deriveCriticality, CRITICALITY,
 * CRITICALITY_RANK) and severity from the severity module (deriveSeverity,
 * SEVERITY_RANK), rather than keeping its own copy of the criticality
 * vocabulary and ranking or reaching severity through riskModel's re-export.
 * Register, Brief, and monitoring therefore share one criticality and one
 * severity vocabulary, defined once in the engine. The relocation is pure:
 * assessRisk / assessRisks give byte-identical verdicts to the old home, and
 * the monitor stays unwired (no page imports it; wiring its triggers in is a
 * later step). The explicit .js on the engine imports keeps this module
 * runnable under Node (for the truth-table check) as well as under the Next
 * bundler.
 *
 * The pattern (framework: read the locked baseline, derive each item's
 * criticality from the objective it serves, flag proportionally):
 *   1. effectiveCriticality reads the LINKED objective's CURRENT classification.
 *   2. severity comes from deriveSeverity (likelihood x impact).
 *   3. the four triggers fire proportionally: the bar is lower for critical
 *      risks (they escalate sooner and go stale sooner) than for standard ones.
 *
 * BASELINE VS LIVE (D3). project_risks.criticality is the cascade value frozen
 * into the baseline at initiation: it is the baseline SNAPSHOT, and this module
 * never reads it for a live decision. Monitoring derives `effectiveCriticality`
 * live from the linked objective's classification, so if a later re-baseline
 * changes that classification the monitoring follows it. The two are named
 * distinctly on purpose: `criticality` (stored snapshot, owned by riskModel and
 * the Brief) versus `effectiveCriticality` (live, owned here). No code path in
 * this module reads risk.criticality.
 *
 * This is only safe to use live because objective classification can change
 * ONLY through an explicit re-baseline, never an ad hoc edit. M6.2.0 froze the
 * wizard's objective steps post-gate to hold that invariant. Re-baseline itself
 * is a separate milestone, not yet built.
 *
 * Escalation thresholds (D1) live in ONE place, ESCALATION_CONFIG. No threshold
 * number appears anywhere else in this module.
 *
 * DEFERRED (D2): project_risk_events is intentionally NOT created. The four
 * triggers below run off current state plus last_reviewed_at only, so they do
 * not need event history. When trend or dwell language is wanted later (for
 * example "Serious for three weeks", or a rising or falling arrow), add an
 * append-only table, documented here so the schema is not reworked:
 *   project_risk_events
 *     id          uuid primary key
 *     risk_id     uuid references project_risks(id) on delete cascade
 *     event_type  enum: 'scored' | 'status_changed' | 'reviewed' | 'note_set'
 *     from_value  text null   (prior value, e.g. old severity or status)
 *     to_value    text null   (new value)
 *     occurred_at timestamptz
 *     actor_id    uuid references auth.users(id) on delete set null
 *   Append-only, never updated, so it stays a true audit trail and keeps the
 *   reads-are-non-destructive guarantee.
 */

import { deriveSeverity, SEVERITY_RANK } from './severity.js';
import {
  CRITICALITY,
  CRITICALITY_RANK,
  deriveCriticality,
} from './criticality.js';

/**
 * D1: the single source of escalation thresholds. Every tuning number for
 * monitoring lives here; nothing else in this module hardcodes a threshold.
 * Defaults are framework-derived, not per-project (per the locked decision: no
 * per-project escalation store yet). The rule "critical means a lower bar" is
 * itself set at initiation, through the objective's classification.
 *
 *   escalateAtSeverity  the LEAST urgent severity that still escalates, by
 *                       severity key (see SEVERITY_RANK). 'serious' means
 *                       Serious only; 'moderate' means Worth watching and above.
 *   reviewWindowDays    a reviewed risk older than this many days has gone stale.
 *   firstRunPaceCount   how many not-yet-engaged risks the first-run surfacing
 *                       shows at once (used by M6.2.4; kept here so all tuning
 *                       sits in one object).
 */
export const ESCALATION_CONFIG = {
  byCriticality: {
    critical: { escalateAtSeverity: 'moderate', reviewWindowDays: 14 },
    standard: { escalateAtSeverity: 'serious', reviewWindowDays: 30 },
  },
  firstRunPaceCount: 3,
};

/**
 * D3 / D4: a risk's LIVE criticality vocabulary. The monitor no longer defines
 * its own; it re-exports the kernel's CRITICALITY under the historical name, so
 * importers and the parity net keep working unchanged and the values are
 * identical ('critical' | 'standard' | 'unlinked'). 'unlinked' (D4) is the
 * governance gap (no linked objective): "needs a link", never a silent
 * standard. Distinct from the stored project_risks.criticality snapshot, which
 * this module never reads.
 */
export const EFFECTIVE_CRITICALITY = CRITICALITY;

/**
 * A risk's live criticality, derived from the objective it threatens by
 * delegating to the kernel. objectivesById is a map of objective id ->
 * { classification, ... } (the live project_objectives rows), supplied by the
 * caller. Returns 'critical' (objective non-negotiable), 'standard' (objective
 * flexible), or 'unlinked' (no link, or a link that does not resolve). Reads the
 * live classification, never the stored snapshot.
 */
export function effectiveCriticality(risk, objectivesById) {
  return deriveCriticality(risk?.linked_objective_id, objectivesById);
}

/**
 * The four monitoring triggers (D2). Each is a pure predicate over current
 * state plus last_reviewed_at. None reads event history.
 */
export const TRIGGERS = {
  ESCALATED_SEVERITY: 'escalated-severity',
  CRITICAL_UNMANAGED: 'critical-and-unmanaged',
  WENT_STALE: 'went-stale',
  NOT_YET_ENGAGED: 'not-yet-engaged',
};

// Ordering rank by live criticality (critical first, then unlinked, then
// standard) is imported from the kernel; the monitor no longer keeps its own
// copy. It ranks the attention list; it is not a threshold. Final presentation
// order is M6.2.3's call.

// Unit conversion, not a tuning threshold (thresholds live in ESCALATION_CONFIG).
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A text field counts as empty when it is null, undefined, or blank once trimmed.
function isBlank(value) {
  return value == null || String(value).trim() === '';
}

// A severity is "at or above" a threshold when it is at least as urgent.
// SEVERITY_RANK ascends by urgency (serious = 0), so at-or-above is rank <=.
function severityAtOrAbove(severityKey, thresholdKey) {
  return SEVERITY_RANK[severityKey] <= SEVERITY_RANK[thresholdKey];
}

// 1. Escalated severity. Serious for a standard risk; Worth watching and above
// for a critical one. Unlinked risks have no threshold (they are surfaced by
// the needs-a-link state instead), so this never fires for them.
function firesEscalatedSeverity(effective, severityKey) {
  const cfg = ESCALATION_CONFIG.byCriticality[effective];
  if (!cfg) return false;
  return severityAtOrAbove(severityKey, cfg.escalateAtSeverity);
}

// 2. Critical and unmanaged. A critical risk still in 'watching' with no written
// response. 'watching' already excludes 'acting', 'accepted', and 'closed'.
function firesCriticalUnmanaged(effective, risk) {
  return (
    effective === CRITICALITY.CRITICAL &&
    risk.status === 'watching' &&
    isBlank(risk.response_note)
  );
}

// 3. Went stale. A risk that HAS been reviewed but not within the window for its
// criticality. A never-reviewed risk is not stale; it is not-yet-engaged
// (trigger 4). Unlinked risks have no window, so this never fires for them.
function firesWentStale(effective, risk, now) {
  const cfg = ESCALATION_CONFIG.byCriticality[effective];
  if (!cfg) return false;
  if (!risk.last_reviewed_at) return false;
  const reviewedAt = Date.parse(risk.last_reviewed_at);
  if (Number.isNaN(reviewedAt)) return false;
  const ageDays = (now - reviewedAt) / MS_PER_DAY;
  return ageDays > cfg.reviewWindowDays;
}

// 4. Not yet engaged. The developer has never reviewed this risk
// (last_reviewed_at is null). Applies regardless of criticality.
function firesNotYetEngaged(risk) {
  return !risk.last_reviewed_at;
}

/**
 * Assess one risk. Returns the per-risk monitoring verdict:
 *   effectiveCriticality  'critical' | 'standard' | 'unlinked'
 *   needsLink             true when unlinked (D4)
 *   severity              { key, label } from deriveSeverity
 *   firedTriggers         the subset of TRIGGERS that fired
 *   needsAttention        needsLink or any trigger fired
 *   ordering              { criticalityRank, severityRank } for the attention sort
 *
 * A 'closed' risk has left the active register, so it is never flagged for
 * attention: the verdict still carries the derived criticality and severity (so
 * it can be shown or sorted) but no triggers, and needsAttention is false.
 *
 * now: current time as epoch milliseconds, passed in by the caller (the server
 * supplies Date.now()). This module never reads the clock, so it stays pure.
 */
export function assessRisk(risk, objectivesById, now) {
  const effective = effectiveCriticality(risk, objectivesById);
  const severity = deriveSeverity(risk.likelihood, risk.impact);
  const ordering = {
    criticalityRank: CRITICALITY_RANK[effective],
    severityRank: SEVERITY_RANK[severity.key],
  };

  // Closed risks have left the active register: no attention, ever.
  if (risk.status === 'closed') {
    return {
      effectiveCriticality: effective,
      needsLink: false,
      severity,
      firedTriggers: [],
      needsAttention: false,
      ordering,
    };
  }

  const needsLink = effective === CRITICALITY.UNLINKED;
  const firedTriggers = [];
  if (firesEscalatedSeverity(effective, severity.key)) {
    firedTriggers.push(TRIGGERS.ESCALATED_SEVERITY);
  }
  if (firesCriticalUnmanaged(effective, risk)) {
    firedTriggers.push(TRIGGERS.CRITICAL_UNMANAGED);
  }
  if (firesWentStale(effective, risk, now)) {
    firedTriggers.push(TRIGGERS.WENT_STALE);
  }
  if (firesNotYetEngaged(risk)) {
    firedTriggers.push(TRIGGERS.NOT_YET_ENGAGED);
  }

  return {
    effectiveCriticality: effective,
    needsLink,
    severity,
    firedTriggers,
    needsAttention: needsLink || firedTriggers.length > 0,
    ordering,
  };
}

/**
 * Order two verdicts for the attention list: most critical first, then most
 * severe. Stable when used with Array.prototype.sort, so ties keep their
 * incoming order (the server returns risks oldest first).
 */
export function compareAssessments(a, b) {
  if (a.ordering.criticalityRank !== b.ordering.criticalityRank) {
    return a.ordering.criticalityRank - b.ordering.criticalityRank;
  }
  return a.ordering.severityRank - b.ordering.severityRank;
}

/**
 * Assess and order a list of risks. Returns [{ risk, assessment }], sorted for
 * the attention surface. Closed risks are included but always carry
 * needsAttention false, so a consumer that filters by needsAttention drops them
 * naturally while a full-register view can still show them. Programme and
 * Dashboard reuse this so all three modules order identically.
 */
export function assessRisks(risks, objectivesById, now) {
  return (risks ?? [])
    .map((risk) => ({ risk, assessment: assessRisk(risk, objectivesById, now) }))
    .sort((a, b) => compareAssessments(a.assessment, b.assessment));
}

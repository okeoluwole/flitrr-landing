/**
 * The attention assembly (Dashboard module, M9.3, Band 3). The pure logic
 * behind "What needs you now": one ranked, deduplicated list of the things
 * that need the developer, composed across the three monitoring modules. It
 * answers a question Bands 1 and 2 cannot, not "how is each objective" but
 * "what do I do first", ranked across all of them, in one list.
 *
 * IT COMPOSES; IT DOES NOT SCORE. Every input is engine output already built:
 * the risk monitor's flagged assessments (assessRisks), the Action Log's open
 * critical actions and its needs-your-response feed, and the Programme's
 * flagged milestones and gates (deriveRAG, joined to their objective by the
 * M9.1 health engine). This module builds no new severity, criticality, or
 * cadence rule; it reads the ones already computed, dedupes, orders, and caps.
 *
 * Pure and deterministic: no DB, no React, no clock. The surface reads today
 * ONCE and passes its epoch down; assessRisks reads that, never the clock.
 *
 * THE SOURCES, and how each becomes a row.
 *  - Risks come from the monitor's flagged assessments (assessRisks gives both
 *    the flagged set and the shared ordering), plus the Action Log's
 *    needs-your-response risks the monitor did not flag (a critical risk being
 *    acted on but not yet tracked or accepted). One row per risk id.
 *  - Actions come from the open critical tracked actions (live criticality,
 *    the log's own read).
 *  - Milestones and gates come from deriveRAG's flagged list. Milestones are
 *    read off the health engine's per-objective join (it already resolved each
 *    flagged milestone to the objective it serves); gates are read off the
 *    health engine's gates array. A gate serves all five objectives, so it
 *    carries no single objective.
 *
 * THE DEDUPE, and it is not optional. One row per underlying thing. Where a
 * risk and its promoted tracked action would both appear, ONE row shows, the
 * action, and the risk is named on it (the action's stored raise reason). This
 * is the M7.2 rule, reused: trackedRiskIds is the risk-to-action link the
 * needs-your-response feed already dedupes on, and the same set suppresses the
 * risk on the monitor path here. An attention list that double-counts lies
 * about volume, and volume is the one thing it exists to communicate.
 *
 * ACCEPTED RISKS do not appear unless the monitor itself flags them: the
 * needs-your-response feed excludes accepted risks (the developer has decided),
 * and the monitor path includes an accepted risk only when a trigger fires on
 * it. Closed risks and done actions never appear (assessRisks and isDone drop
 * them). UNLINKED items do not appear: Band 3 ranks by the objective framework
 * (protected before flexible), and an item tied to no objective has no place in
 * that ranking; Band 1 already reports the unlinked count, so their absence
 * here is never silent.
 *
 * ONE TRIGGER PER RISK, and it must read true. A risk can fire several monitor
 * triggers; the row shows one, chosen by MONITOR_TRIGGER_PRIORITY. Two of the
 * copy sheet's lines name the risk critical (critical-and-unmanaged, which the
 * monitor fires only for critical risks, and not-yet-engaged). not-yet-engaged
 * fires for any never-reviewed risk, so a standard risk flagged ONLY by it is
 * held back from Band 3: its line would misread it as critical, and a
 * never-reviewed flexible-objective risk is a Risk-register cadence nudge, not
 * a cross-module act-now item. It stays in the register's own read.
 *
 * NAMING THE DEDUPED RISK. A promoted action carries the risk it replaced in
 * its stored raise reason. Only a risk source is named on the row (section
 * 1.6); a playbook or hand-logged action has no risk to name, and its stored
 * rationale is not a "raised from" line.
 *
 * THE ORDER, the framework rendered as a sort:
 *  1. A flagged GATE sorts above everything: it answers to all five objectives.
 *  2. Then everything on a PROTECTED objective, before anything on a flexible
 *     one. A hard rule, no exceptions.
 *  3. Within that, by urgency, using assessRisks' existing ordering. assessRisks
 *     ranks risks (criticality then severity); the risk rows are inserted in
 *     that order and a stable sort preserves it within a band. It defines no
 *     urgency across kinds, so within a band the kinds hold their source order
 *     (risks in assessRisks order, then actions, then milestones) rather than an
 *     invented cross-kind urgency. No second sort is invented.
 *
 * THE CAP holds at five rows. The overflow count is the true total across all
 * three sources, not just the truncated module, so the footer never
 * understates volume; the footer's link points at the module holding the most
 * of that overflow.
 *
 * WHAT THIS MODULE DOES NOT DO. No copy string (dashboardRead.js owns every
 * sentence; this module emits structured triggers only); no href string (the
 * surface builds the module link from the module id and the project); no
 * persistence; no write of any kind.
 */

import { assessRisks, TRIGGERS as MONITOR_TRIGGERS } from '../../../../lib/engine/monitor';
import { deriveRiskItems, trackedRiskIds } from '../actions/actionFeed';
import { isCritical, isDone } from '../actions/actionModel';

// The four kinds of underlying thing a row can be. Frozen so a caller cannot
// mutate the vocabulary.
export const ATTENTION_KINDS = Object.freeze({
  RISK: 'risk',
  ACTION: 'action',
  MILESTONE: 'milestone',
  GATE: 'gate',
});

// The home module each kind routes to, the id the surface turns into a link.
export const ATTENTION_MODULES = Object.freeze({
  RISK: 'risk',
  ACTIONS: 'actions',
  PROGRAMME: 'programme',
});

/**
 * The structured trigger keys, the whole vocabulary of reasons a row can carry.
 * dashboardRead.js turns each into a sentence; a key without a string there
 * throws, never a generic fallback. The four risk keys are the monitor's own
 * TRIGGERS values verbatim, so the two modules share one vocabulary.
 */
export const ATTENTION_TRIGGERS = Object.freeze({
  // From the risk monitor.
  ESCALATED_SEVERITY: MONITOR_TRIGGERS.ESCALATED_SEVERITY,
  CRITICAL_UNMANAGED: MONITOR_TRIGGERS.CRITICAL_UNMANAGED,
  WENT_STALE: MONITOR_TRIGGERS.WENT_STALE,
  NOT_YET_ENGAGED: MONITOR_TRIGGERS.NOT_YET_ENGAGED,
  // From the Action Log.
  OPEN_CRITICAL_ACTION: 'open-critical-action',
  NEEDS_RESPONSE: 'needs-your-response',
  // From the Programme, split by flag so each key maps to exactly one line.
  MILESTONE_RED: 'milestone-red',
  MILESTONE_AMBER: 'milestone-amber',
  GATE_RED: 'gate-red',
  GATE_AMBER: 'gate-amber',
});

// The cap: at most five rows on the surface. Everything beyond is the overflow
// the footer counts.
export const ATTENTION_CAP = 5;

// The order the monitor's fired triggers are read in when a risk fired more
// than one: the most decision-relevant reason leads. critical-and-unmanaged
// and not-yet-engaged both name the risk critical, and critical-and-unmanaged
// fires only for critical risks; escalated-severity and went-stale carry no
// criticality claim. never-reviewed (not-yet-engaged) and reviewed-but-stale
// (went-stale) are mutually exclusive, so their relative rank never decides a
// live row.
const MONITOR_TRIGGER_PRIORITY = [
  MONITOR_TRIGGERS.CRITICAL_UNMANAGED,
  MONITOR_TRIGGERS.ESCALATED_SEVERITY,
  MONITOR_TRIGGERS.WENT_STALE,
  MONITOR_TRIGGERS.NOT_YET_ENGAGED,
];

// The one flagged trigger a risk row shows, chosen from the fired set by the
// priority above. Null when nothing fired (an unlinked risk flagged only by
// the needs-a-link state, which Band 3 excludes anyway).
function primaryMonitorTrigger(firedTriggers) {
  const fired = firedTriggers ?? [];
  for (const key of MONITOR_TRIGGER_PRIORITY) {
    if (fired.includes(key)) return key;
  }
  return null;
}

// The RAG flag colours the Programme rows key on.
const FLAG_RED = 'red';
const FLAG_AMBER = 'amber';

// An objective row is protected when its classification is non-negotiable.
const NON_NEGOTIABLE = 'non_negotiable';

// Resolve the objective an item serves from the shared index, or null when the
// link is absent or does not resolve (an unlinked item, excluded from Band 3).
function resolveObjective(linkedObjectiveId, byId) {
  const objective = linkedObjectiveId ? byId?.[linkedObjectiveId] : null;
  return objective ?? null;
}

function isProtectedObjective(objective) {
  return objective?.classification === NON_NEGOTIABLE;
}

// A risk row: the description, the objective it serves, and its monitor (or
// needs-response) trigger. Protected drives both the tag and the sort.
function riskRow(risk, objective, triggerKey) {
  const isProtected = isProtectedObjective(objective);
  return {
    kind: ATTENTION_KINDS.RISK,
    id: risk.id,
    title: risk.description ?? '',
    objectiveType: objective.type ?? null,
    isProtected,
    stage: null,
    trigger: { key: triggerKey },
    raisedFrom: null,
    module: ATTENTION_MODULES.RISK,
    _order: { isGate: 0, isProtected: isProtected ? 1 : 0 },
  };
}

// An action row: an open critical tracked action. A critical action is linked
// to a non-negotiable objective, so it is always protected. When it was
// promoted from a RISK, its stored raise reason names that risk, which is how
// the deduped action still carries the risk it replaced (the M7.2 rule, section
// 1.6). Only a risk source is named: a playbook or hand-logged action carries
// no risk to name, and its stored rationale is not a "raised from" line.
function actionRow(action, objective) {
  const isProtected = isProtectedObjective(objective);
  const fromRisk = action.source === 'risk';
  return {
    kind: ATTENTION_KINDS.ACTION,
    id: action.id,
    title: action.description ?? '',
    objectiveType: objective?.type ?? null,
    isProtected,
    stage: null,
    trigger: { key: ATTENTION_TRIGGERS.OPEN_CRITICAL_ACTION },
    raisedFrom: fromRisk ? action.reason ?? null : null,
    module: ATTENTION_MODULES.ACTIONS,
    _order: { isGate: 0, isProtected: isProtected ? 1 : 0 },
  };
}

// A milestone row, read off the health engine's per-objective join: the
// objective is already resolved on the row it sits under, and the flag colour
// (red or amber) picks the trigger.
function milestoneRow(milestone, objectiveRow) {
  const isProtected = !!objectiveRow.isProtected;
  return {
    kind: ATTENTION_KINDS.MILESTONE,
    id: milestone.key,
    title: milestone.name ?? '',
    objectiveType: objectiveRow.type ?? null,
    isProtected,
    stage: milestone.stage ?? null,
    trigger: {
      key:
        milestone.flag === FLAG_RED
          ? ATTENTION_TRIGGERS.MILESTONE_RED
          : ATTENTION_TRIGGERS.MILESTONE_AMBER,
    },
    raisedFrom: null,
    module: ATTENTION_MODULES.PROGRAMME,
    _order: { isGate: 0, isProtected: isProtected ? 1 : 0 },
  };
}

// A gate row, read off the health engine's gates array. A gate answers to all
// five objectives, so it carries no single objective and sorts above
// everything via isGate.
function gateRow(gate) {
  return {
    kind: ATTENTION_KINDS.GATE,
    id: gate.key,
    title: gate.name ?? '',
    objectiveType: null,
    isProtected: null,
    stage: gate.stage ?? null,
    trigger: {
      key:
        gate.colour === FLAG_AMBER
          ? ATTENTION_TRIGGERS.GATE_AMBER
          : ATTENTION_TRIGGERS.GATE_RED,
    },
    raisedFrom: null,
    module: ATTENTION_MODULES.PROGRAMME,
    _order: { isGate: 1, isProtected: 1 },
  };
}

// The framework as a comparator: gate first, then protected before flexible.
// Everything finer is the stable insertion order (rule 3, assessRisks urgency
// for risks, source order for the rest).
function compareOrder(a, b) {
  if (a.isGate !== b.isGate) return a.isGate ? -1 : 1;
  if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
  return 0;
}

// The module holding the most of the overflow, ties broken by first appearance
// (the earliest, so most urgent, overflow item's module wins). The footer links
// here.
function largestOverflowModule(overflowRows) {
  const counts = new Map();
  const firstSeen = [];
  for (const row of overflowRows) {
    if (!counts.has(row.module)) firstSeen.push(row.module);
    counts.set(row.module, (counts.get(row.module) ?? 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const module of firstSeen) {
    const count = counts.get(module);
    if (count > bestCount) {
      best = module;
      bestCount = count;
    }
  }
  return best;
}

// Drop the private sort key before the list leaves the module.
function publicRow({ _order, ...row }) {
  return row;
}

/**
 * Assemble the attention list for a project. One call, the whole ranked and
 * deduplicated list, capped, with the true overflow.
 *
 * input:
 *   risks            project_risks rows (the monitor reads status,
 *                    last_reviewed_at, response_note, likelihood, impact, and
 *                    the objective link)
 *   actions          project_actions rows (open critical read live; source,
 *                    source_id, and reason carry the promote link and its
 *                    provenance)
 *   health           deriveObjectiveHealth's output: its per-objective
 *                    milestone join and its gates array are the Programme
 *                    source, and each objective row carries its live protected
 *                    flag and type
 *   objectivesById   the shared objective index (buildObjectiveIndex's byId),
 *                    id -> { type, classification }
 *   nowMs            today as epoch milliseconds, read once by the surface and
 *                    handed down; assessRisks reads it, never the clock
 *
 * Returns, deterministic for the same inputs:
 *   {
 *     items,           the rows to render, at most ATTENTION_CAP, in order,
 *                      each { kind, id, title, objectiveType, isProtected,
 *                      stage, trigger: { key }, raisedFrom, module }
 *     total,           the true count across all sources, before the cap
 *     overflow,        max(0, total - ATTENTION_CAP), the footer's N
 *     overflowModule,  the module holding the most overflow, or null when none
 *   }
 */
export function deriveAttention({ risks, actions, health, objectivesById, nowMs }) {
  const byId = objectivesById ?? {};
  const acts = actions ?? [];

  // The M7.2 dedupe set: risk ids already represented by an open tracked
  // action. On both risk paths the action stands in for the risk.
  const tracked = trackedRiskIds(acts);

  const rows = [];

  // Risks, path one: the monitor's flagged assessments, already in the shared
  // ordering. Unlinked risks are outside the objective framework (excluded);
  // tracked risks are represented by their action (excluded).
  const assessed = assessRisks(risks ?? [], byId, nowMs);
  const riskSeen = new Set();
  for (const { risk, assessment } of assessed) {
    if (!assessment.needsAttention) continue;
    const objective = resolveObjective(risk.linked_objective_id, byId);
    if (objective == null) continue;
    if (tracked.has(risk.id)) continue;
    const triggerKey = primaryMonitorTrigger(assessment.firedTriggers);
    if (triggerKey == null) continue;
    // not-yet-engaged reads "Critical, and not yet looked at": a Band 3
    // statement about a critical risk. A standard risk that has merely never
    // been reviewed is a Risk-register cadence nudge, not a cross-module
    // act-now item, so it does not headline here (and the line would misread it
    // as critical). It fires as the sole trigger only, so nothing else covers
    // it; it stays in the register's own attention read.
    if (
      triggerKey === MONITOR_TRIGGERS.NOT_YET_ENGAGED &&
      !isProtectedObjective(objective)
    ) {
      continue;
    }
    rows.push(riskRow(risk, objective, triggerKey));
    riskSeen.add(risk.id);
  }

  // Risks, path two: the needs-your-response risks the monitor did not flag (a
  // critical risk being acted on but not yet tracked or accepted). The feed
  // already excludes accepted and tracked risks; the objective guard drops any
  // unlinked serious one.
  for (const { risk } of deriveRiskItems(risks ?? [], acts, byId)) {
    if (riskSeen.has(risk.id)) continue;
    if (tracked.has(risk.id)) continue;
    const objective = resolveObjective(risk.linked_objective_id, byId);
    if (objective == null) continue;
    rows.push(riskRow(risk, objective, ATTENTION_TRIGGERS.NEEDS_RESPONSE));
    riskSeen.add(risk.id);
  }

  // Actions: the open critical tracked actions, live criticality.
  for (const action of acts) {
    if (isDone(action)) continue;
    if (!isCritical(action, byId)) continue;
    const objective = resolveObjective(action.linked_objective_id, byId);
    rows.push(actionRow(action, objective));
  }

  // Programme: the flagged milestones (from the health engine's per-objective
  // join) then the flagged gates (from its gates array).
  for (const objectiveRow of health?.objectives ?? []) {
    for (const milestone of objectiveRow.items?.milestones ?? []) {
      if (milestone.flag !== FLAG_RED && milestone.flag !== FLAG_AMBER) continue;
      rows.push(milestoneRow(milestone, objectiveRow));
    }
  }
  for (const gate of health?.gates ?? []) {
    rows.push(gateRow(gate));
  }

  // The order: gate first, protected before flexible, then the stable
  // insertion order (assessRisks urgency for risks, source order across kinds).
  // Decorate with the index so the tiebreak is explicit rather than relying on
  // the engine's sort stability.
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareOrder(a.row._order, b.row._order) || a.index - b.index)
    .map((entry) => entry.row);

  // The cap and the true overflow.
  const total = ordered.length;
  const shown = ordered.slice(0, ATTENTION_CAP);
  const overflowRows = ordered.slice(ATTENTION_CAP);
  const overflow = overflowRows.length;
  const overflowModule = overflow > 0 ? largestOverflowModule(overflowRows) : null;

  return {
    items: shown.map(publicRow),
    total,
    overflow,
    overflowModule,
  };
}

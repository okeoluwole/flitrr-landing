/**
 * The Objective Health engine (Dashboard module, M9.1). The first engine of the
 * Project Dashboard: a pure read and compose layer over the Brief, the Risk
 * register, the Action Log, and the Programme, organised by the five
 * objectives. It takes the objective rows, the risk and action rows, the frozen
 * baseline snapshot, and the Programme engines' outputs, and derives one health
 * state per objective, plus the single project state, under the two-ladder rule
 * below. It computes no page, no component, and no copy: every reason is
 * returned as a structured trigger, and a copy module (M9.2) turns triggers
 * into sentences, the way pulseRead.js already does for the Brief.
 *
 * Pure and deterministic: no DB, no React, no network, no system clock.
 * Everything arrives as input, so the same inputs always give the same
 * verdict and the whole module is unit-testable in isolation. It mutates
 * nothing it is given.
 *
 * CALL, NEVER RECOMPUTE. Severity is read through deriveSeverity
 * (lib/engine/severity.js). Criticality is read through the criticality kernel
 * (lib/engine/criticality.js), including the downward-only override for
 * actions. Programme colour arrives as deriveRAG's flagged list and is joined,
 * never re-derived. Nothing in this file reimplements a sibling's rule.
 *
 * THE JOINS.
 *  - Risks and actions link by row: linked_objective_id resolves to a
 *    project_objectives row by id.
 *  - Milestones link by type: the baseline snapshot bakes `serves` as the
 *    objective type string, and objectives are one row per type per project,
 *    so type-to-row resolution is safe.
 *  - deriveRAG's flagged items do not carry `serves`, so each flagged
 *    milestone is joined by its key back to the milestone of the same key in
 *    the baseline snapshot to find the objective it serves.
 *  - Milestones come ONLY from the frozen baseline snapshot
 *    (programme_baselines.programme). The project_milestones table is dead
 *    and is never read. A stage marked not applicable is excluded, exactly
 *    as the Programme engines exclude it.
 *
 * OPEN means: a risk whose status is not 'closed'; an action whose status is
 * not 'done'. Accepted risks count: accepting a risk does not remove the
 * exposure, so an accepted Serious risk still compromises a protected
 * objective. A closed risk raises no signal, but if it was scored it still
 * counts as scoring evidence: the objective was looked at.
 *
 * THE TWO LADDERS. A protected objective (classification 'non_negotiable')
 * reads holding, under_pressure, or compromised. A flexible objective reads
 * holding, absorbing, or exhausted: absorbing is the design working, the
 * flexible objective taking the strain, and only a proportional threshold
 * (two or more open Serious risks, or a red programme flag) exhausts it. The
 * conditions are evaluated worst state first, and within a state in the order
 * the rules list them, so the first condition that holds is the trigger: the
 * single structured reason the state was set.
 *
 * NOT_SCORED is not a rung on either ladder. Evidence means a SCORED risk
 * tagged to the objective, an OPEN action serving it, or a FLAGGED milestone
 * serving it (flag amber or red). An objective with none of the three has
 * never been looked at, so it reads not_scored, colour neutral, never green.
 * Green must mean we looked and found nothing; it must never mean nothing was
 * entered. A risk tagged to the objective but not yet scored is not evidence:
 * it does not rescue the objective from not_scored, and it is counted in
 * unscoredRiskCount so the blindness is reported. An UNFLAGGED milestone is
 * not evidence either: it is the absence of a signal, and it says something
 * about the calendar, not about the objective. On day one of a real project
 * (risks seeded and unscored, no actions, a baseline locked today so every
 * flag is none) every objective reads not_scored and the project reads
 * no_state, which is the truth. A flagged milestone still counts and still
 * drives state: a red milestone on an objective with no risks and no actions
 * still compromises it.
 *
 * TIME, AND IT HAS TWO GAPS. The Time objective alone also reads a date
 * signal: totalWeeksLate, the exact unrounded weeks from the target
 * completion date to the forecast completion. Protected Time is compromised
 * the moment totalWeeksLate is positive, with no grace band: non-negotiable
 * means no tolerance, that is what the word means. Protected Time on target
 * but within toleranceWeeks of it is under_pressure: you will make it and you
 * have no room left. Flexible Time past the target is absorbing, and NEVER
 * exhausted from the date signal alone: the stated tolerance on the objective
 * row is free text and uncomputable, so the engine cannot know whether the
 * agreed bound was passed, and it says so rather than guessing. The date
 * conditions sit inside the ladders at their listed positions, so Time's
 * final state is the worst of its date signal and its risk, action, and
 * programme signals. The date trigger's detail always carries the
 * decomposition, because the remedies differ: plannedWeeksLate (baseline
 * completion minus target, baked in at lock) and slippedWeeks (forecast minus
 * baseline completion, slipped since; NEGATIVE when the project runs ahead of
 * its own plan), which sum to totalWeeksLate. When the target date is null,
 * or no forecast is supplied, the date test does not run.
 *
 * THE DATE SIGNAL IS ALWAYS CARRIED. `trigger` answers "what set the state";
 * the Time row also answers "what the developer must know", and they are not
 * the same thing: a moderate risk can set the state while the forecast sits
 * fifteen weeks past the target, and that fact must never be invisible to
 * whatever renders the row. So the Time row alone carries a sibling field,
 * dateSignal, populated whenever targetCompletionDate and forecastCompletion
 * both exist, INDEPENDENT of what set the state (including on a not_scored
 * row): the three dates, the two-gap decomposition summing to totalWeeksLate,
 * and a verdict, what the date rule ALONE would say ignoring risks and
 * actions ('past_target' when the forecast is past the target, 'no_room' when
 * on target but within toleranceWeeks of it, 'clear' otherwise). dateSignal
 * is null on the four non-Time objectives, and null on Time when either date
 * is missing. It changes no state: the state rules read the dates exactly as
 * before.
 *
 * GATES carry no `serves` and never attach to an objective, not even Time.
 * Flagged gates are returned in the separate `gates` array.
 *
 * UNLINKED. linked_objective_id is nullable on both risks and actions, and a
 * link that does not resolve to an objective row is the same governance gap.
 * Open unlinked items belong to no objective and are absent from the
 * objectives array; they are returned in `unlinked` so their absence is never
 * silent.
 *
 * CLASSIFICATION DRIFT. Risks and actions derive criticality live; the
 * baseline bakes criticality at lock. If an objective was reclassified after
 * the baseline locked, the two disagree, and the engine detects it by
 * comparing the objective's live criticality (derived from its current
 * classification through the kernel) against the baked criticality on the
 * milestones serving it. Any disagreement sets drift = { live, baked }. Both
 * are reported; the baked value is never re-derived and the two are never
 * averaged.
 *
 * THE PROJECT STATE reads from the scored protected objectives only: red if
 * any is compromised, amber if any is under pressure or any scored flexible
 * objective is exhausted, green only when every scored protected objective is
 * holding and at least one protected objective is scored, and no_state when
 * no protected objective is scored at all. An unscored protected objective
 * pushes the project neither green nor red: blindness is reported, never
 * coloured. sentenceRule is the Band 1 rule number (0 to 5) the state
 * satisfies; the engine picks the rule and M9.2 writes the words.
 *
 * OUT OF SCOPE HERE: no page, no component, no route, no copy string, no
 * persistence, no database, no reading of the baseline from the store, and no
 * reading of the system clock.
 */

import { deriveSeverity, SEVERITY_RANK } from './severity.js';
import {
  CRITICALITY,
  buildObjectiveIndex,
  deriveCriticality,
  effectiveCriticality,
} from './criticality.js';

// The six objective health states: the protected ladder (holding,
// under_pressure, compromised), the flexible ladder (holding, absorbing,
// exhausted), and not_scored, which is not a rung on either. Frozen so a
// caller cannot mutate the vocabulary.
export const HEALTH_STATES = Object.freeze({
  HOLDING: 'holding',
  UNDER_PRESSURE: 'under_pressure',
  COMPROMISED: 'compromised',
  ABSORBING: 'absorbing',
  EXHAUSTED: 'exhausted',
  NOT_SCORED: 'not_scored',
});

// The colour each state carries. Neutral is not_scored's colour and never
// green: green must mean we looked and found nothing.
export const HEALTH_COLOURS = Object.freeze({
  GREEN: 'green',
  AMBER: 'amber',
  RED: 'red',
  NEUTRAL: 'neutral',
});

const STATE_COLOUR = Object.freeze({
  [HEALTH_STATES.HOLDING]: HEALTH_COLOURS.GREEN,
  [HEALTH_STATES.UNDER_PRESSURE]: HEALTH_COLOURS.AMBER,
  [HEALTH_STATES.COMPROMISED]: HEALTH_COLOURS.RED,
  [HEALTH_STATES.ABSORBING]: HEALTH_COLOURS.AMBER,
  [HEALTH_STATES.EXHAUSTED]: HEALTH_COLOURS.RED,
  [HEALTH_STATES.NOT_SCORED]: HEALTH_COLOURS.NEUTRAL,
});

// The single project state. no_state is the honest read when no protected
// objective is scored: blindness reported, never coloured.
export const PROJECT_STATES = Object.freeze({
  GREEN: 'green',
  AMBER: 'amber',
  RED: 'red',
  NO_STATE: 'no_state',
});

// The structured trigger keys, the engine's whole vocabulary of reasons. M9.2
// turns these into sentences; this file holds no copy string.
export const HEALTH_TRIGGERS = Object.freeze({
  // The objective has never been looked at. Detail null.
  NOT_SCORED: 'not_scored',
  // Nothing open threatens the objective. Detail null.
  HOLDING: 'holding',
  // One or more open Serious risks. { count, acceptedCount, riskIds }.
  SERIOUS_RISK: 'serious_risk',
  // Two or more open Serious risks, the flexible proportional threshold.
  // { count, acceptedCount, riskIds }.
  SERIOUS_RISKS: 'serious_risks',
  // The worst open risk is moderate. { count, riskIds }.
  MODERATE_RISK: 'moderate_risk',
  // One or more open critical actions, criticality derived live.
  // { count, actionIds }.
  OPEN_CRITICAL_ACTIONS: 'open_critical_actions',
  // A red-flagged milestone serving the objective. { milestoneKeys }.
  PROGRAMME_RED: 'programme_red',
  // An amber-flagged milestone serving the objective. { milestoneKeys }.
  PROGRAMME_AMBER: 'programme_amber',
  // Time only: the forecast completion is past the target.
  // { totalWeeksLate, plannedWeeksLate, slippedWeeks }.
  DATE_PAST_TARGET: 'date_past_target',
  // Protected Time only: on target but within the tolerance of it.
  // { totalWeeksLate, plannedWeeksLate, slippedWeeks, toleranceWeeks }.
  DATE_WITHIN_TOLERANCE: 'date_within_tolerance',
});

// The date signal's verdicts: what the date rule alone would say, ignoring
// risks and actions. Frozen so a caller cannot mutate the vocabulary.
export const DATE_VERDICTS = Object.freeze({
  PAST_TARGET: 'past_target',
  NO_ROOM: 'no_room',
  CLEAR: 'clear',
});

// The objective_type value the date signal attaches to.
const TIME_TYPE = 'time';

// The status values that close an item. Everything else is open.
const RISK_CLOSED_STATUS = 'closed';
const ACTION_DONE_STATUS = 'done';
const RISK_ACCEPTED_STATUS = 'accepted';

// The severity keys the signals read, from the severity module's vocabulary.
const SEVERITY_SERIOUS = 'serious';
const SEVERITY_MODERATE = 'moderate';
const SEVERITY_UNSCORED = 'unscored';

// The worstRisk and programmeFlag value when nothing raises a signal.
const SIGNAL_NONE = 'none';

// The flagged-item vocabulary the RAG engine emits, read here for the join.
const RAG_KIND_GATE = 'gate';
const RAG_KIND_MILESTONE = 'milestone';
const RAG_RED = 'red';
const RAG_AMBER = 'amber';

// One week in milliseconds. Weeks are whole seven-day spans, so measuring
// them in epoch milliseconds is exact and timezone-neutral. The same
// convention as programmeRAG.js and programmeForecast.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Soft parse to epoch milliseconds, or null. Accepts a Date, an ISO date
// string (a plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
// Mirrors programmeRAG.softEpoch and programmeForecast.softEpoch.
function softEpoch(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isNaN(epoch) ? null : epoch;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const epoch = Date.parse(trimmed);
    return Number.isNaN(epoch) ? null : epoch;
  }
  return null;
}

// The distance between two epochs in weeks, exact and unrounded, signed.
// Display rounding is the surface's concern.
function weeksBetween(fromEpoch, toEpoch) {
  return (toEpoch - fromEpoch) / MS_PER_WEEK;
}

/**
 * Walk the frozen baseline snapshot and index its milestones: one entry per
 * keyed milestone in an applicable stage, carrying the baked fields the
 * dashboard reads ({ key, name, stage, serves, criticality, baselineDate })
 * plus a flag slot the RAG join fills. Stages marked not applicable are
 * excluded entirely, exactly as the Programme engines exclude them. Gates are
 * not milestones and are never indexed here. Returns { byKey, byType }.
 */
function indexBaselineMilestones(baseline) {
  const byKey = {};
  const byType = {};
  for (const stage of baseline?.stages ?? []) {
    if (stage?.applicable === false) continue;
    for (const activity of stage?.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key == null) continue;
        const entry = {
          key: milestone.key,
          name: milestone.name ?? null,
          stage: stage?.stage ?? null,
          serves: milestone.serves ?? null,
          criticality: milestone.criticality ?? null,
          baselineDate: milestone.baselineDate ?? null,
          flag: null,
        };
        byKey[entry.key] = entry;
        if (entry.serves != null) {
          (byType[entry.serves] ??= []).push(entry);
        }
      }
    }
  }
  return { byKey, byType };
}

/**
 * The Time date signal, or null when it cannot run (no target date, or no
 * forecast to compare it with). totalWeeksLate is the exact unrounded weeks
 * from the target to the forecast completion, positive when late. The
 * decomposition rides with it: plannedWeeksLate, the gap baked in at lock
 * (baseline completion minus target), and slippedWeeks, the gap opened since
 * (forecast minus baseline completion). They sum to totalWeeksLate. With no
 * baseline completion supplied the split cannot be made, so both parts are
 * null while the total still reads.
 */
function timeDateSignal(forecastCompletion, baselineCompletion, targetCompletionDate) {
  const targetEpoch = softEpoch(targetCompletionDate);
  const forecastEpoch = softEpoch(forecastCompletion);
  if (targetEpoch == null || forecastEpoch == null) return null;
  const baselineEpoch = softEpoch(baselineCompletion);
  return {
    totalWeeksLate: weeksBetween(targetEpoch, forecastEpoch),
    plannedWeeksLate:
      baselineEpoch == null ? null : weeksBetween(targetEpoch, baselineEpoch),
    slippedWeeks:
      baselineEpoch == null ? null : weeksBetween(baselineEpoch, forecastEpoch),
  };
}

// The detail object for a risk-driven trigger: the ids so M9.2 can name and
// link the risks, the count, and (for Serious) how many are merely accepted.
function seriousDetail(seriousRisks) {
  return {
    count: seriousRisks.length,
    acceptedCount: seriousRisks.filter((r) => r.status === RISK_ACCEPTED_STATUS)
      .length,
    riskIds: seriousRisks.map((r) => r.id),
  };
}

/**
 * Derive the objective health read for a project.
 *
 * input:
 *   objectives            project_objectives rows: { id, objective_type,
 *                         classification, tolerance, ... }
 *   risks                 project_risks rows: { id, linked_objective_id,
 *                         likelihood, impact, status, ... }
 *   actions               project_actions rows: { id, linked_objective_id,
 *                         criticality, criticality_override, status, ... }
 *   baseline              the frozen programme_baselines.programme snapshot
 *                         ({ stages: [...] }), or null when none is locked
 *   ragFlagged            deriveRAG's flagged array, or null
 *   forecastCompletion    deriveForecast's programme completion (ISO date,
 *                         Date, or epoch), or null
 *   baselineCompletion    the latest baseline date across trackable points,
 *                         or null
 *   targetCompletionDate  projects.target_completion_date, or null
 *   toleranceWeeks        the tolerance in weeks, supplied by the caller (a
 *                         finite, non-negative number; the surface owns the
 *                         default and passes it in)
 *   today                 ISO date, supplied by the caller. Part of the
 *                         dashboard's read contract; no current rule reads it
 *                         (the date signal compares forecast to target, and
 *                         the flagged list already carries today's slip), so
 *                         it is accepted and unread.
 *
 * Returns the health object described in the module header, deterministic for
 * the same inputs. The objectives array preserves the input row order. The
 * items on each objective are its OPEN risks (enriched with the derived
 * severity key), its OPEN actions (enriched with liveCriticality, the
 * kernel's effective criticality after the downward-only override), and the
 * baseline milestones serving it (each carrying its flag colour from the RAG
 * join, or null).
 */
export function deriveObjectiveHealth(input) {
  const {
    objectives,
    risks,
    actions,
    baseline,
    ragFlagged,
    forecastCompletion,
    baselineCompletion,
    targetCompletionDate,
    toleranceWeeks,
  } = input ?? {};

  if (
    typeof toleranceWeeks !== 'number' ||
    !Number.isFinite(toleranceWeeks) ||
    toleranceWeeks < 0
  ) {
    throw new Error(
      'deriveObjectiveHealth: a non-negative tolerance in weeks is required'
    );
  }

  const { byId } = buildObjectiveIndex(objectives);
  const milestoneIndex = indexBaselineMilestones(baseline);

  // The RAG join. Flagged milestones are joined by key back to the baseline
  // snapshot to find the objective they serve; a flagged key the snapshot
  // does not contain attaches to nothing. Flagged gates carry no serves and
  // never attach to an objective, not even Time: they land in the separate
  // gates array, copied so the caller's flagged list is never shared.
  const gates = [];
  for (const item of ragFlagged ?? []) {
    if (item == null) continue;
    if (item.kind === RAG_KIND_GATE) {
      gates.push({ ...item });
      continue;
    }
    if (item.kind !== RAG_KIND_MILESTONE) continue;
    const entry = item.key != null ? milestoneIndex.byKey[item.key] : null;
    if (entry == null) continue;
    // Worst wins on the entry, defensively: red is never downgraded by a
    // later amber for the same key.
    if (item.colour === RAG_RED) entry.flag = RAG_RED;
    else if (item.colour === RAG_AMBER && entry.flag !== RAG_RED)
      entry.flag = RAG_AMBER;
  }

  // Group the risks. Open risks land on their objective (or in unlinked);
  // closed risks raise no signal and appear in no list, but a scored closed
  // risk still marks its objective as looked at. Open unscored risks are
  // counted so the blindness is reported.
  const risksByObjective = {};
  const unlinkedRisks = [];
  const scoredRiskObjectiveIds = new Set();
  let unscoredRiskCount = 0;

  for (const risk of risks ?? []) {
    if (risk == null) continue;
    const severity = deriveSeverity(risk.likelihood, risk.impact).key;
    const linkedId =
      risk.linked_objective_id != null && byId[risk.linked_objective_id] != null
        ? risk.linked_objective_id
        : null;
    if (linkedId != null && severity !== SEVERITY_UNSCORED) {
      scoredRiskObjectiveIds.add(linkedId);
    }
    if (risk.status === RISK_CLOSED_STATUS) continue;
    if (severity === SEVERITY_UNSCORED) unscoredRiskCount += 1;
    const enriched = { ...risk, severity };
    if (linkedId == null) {
      unlinkedRisks.push(enriched);
      continue;
    }
    (risksByObjective[linkedId] ??= []).push(enriched);
  }

  // Group the actions. Done actions are history and appear nowhere. Each open
  // action carries its live criticality from the kernel: derived from the
  // linked objective's current classification, lowered only by an active
  // downward override, never read from the stored column. An action whose
  // link is null or does not resolve derives 'unlinked' and lands in the
  // unlinked list.
  const actionsByObjective = {};
  const unlinkedActions = [];

  for (const action of actions ?? []) {
    if (action == null) continue;
    if (action.status === ACTION_DONE_STATUS) continue;
    const liveCriticality = effectiveCriticality(
      action.linked_objective_id,
      byId,
      action.criticality_override ?? null
    );
    const enriched = { ...action, liveCriticality };
    if (liveCriticality === CRITICALITY.UNLINKED) {
      unlinkedActions.push(enriched);
      continue;
    }
    (actionsByObjective[action.linked_objective_id] ??= []).push(enriched);
  }

  // The date parts feed two readers: the ladder's date conditions (unchanged),
  // and the always-carried dateSignal on the Time row, which adds the input
  // dates and the verdict the date rule alone would give.
  const dateParts = timeDateSignal(
    forecastCompletion,
    baselineCompletion,
    targetCompletionDate
  );
  const timeSignal =
    dateParts == null
      ? null
      : {
          targetCompletionDate: targetCompletionDate ?? null,
          baselineCompletion: baselineCompletion ?? null,
          forecastCompletion: forecastCompletion ?? null,
          plannedWeeksLate: dateParts.plannedWeeksLate,
          slippedWeeks: dateParts.slippedWeeks,
          totalWeeksLate: dateParts.totalWeeksLate,
          verdict:
            dateParts.totalWeeksLate > 0
              ? DATE_VERDICTS.PAST_TARGET
              : dateParts.totalWeeksLate >= -toleranceWeeks
                ? DATE_VERDICTS.NO_ROOM
                : DATE_VERDICTS.CLEAR,
        };

  // One health row per objective, in the input row order.
  const objectiveRows = [];
  for (const objective of objectives ?? []) {
    if (objective == null || objective.id == null) continue;
    const type = objective.objective_type ?? null;
    const isProtected = objective.classification === 'non_negotiable';
    const objRisks = risksByObjective[objective.id] ?? [];
    const objActions = actionsByObjective[objective.id] ?? [];
    const objMilestones = type != null ? milestoneIndex.byType[type] ?? [] : [];

    // The signals, from the open items only.
    let worstRisk = SIGNAL_NONE;
    let worstRank = Infinity;
    const seriousRisks = [];
    const moderateRisks = [];
    for (const risk of objRisks) {
      if (risk.severity === SEVERITY_UNSCORED) continue;
      const rank = SEVERITY_RANK[risk.severity];
      if (rank < worstRank) {
        worstRank = rank;
        worstRisk = risk.severity;
      }
      if (risk.severity === SEVERITY_SERIOUS) seriousRisks.push(risk);
      else if (risk.severity === SEVERITY_MODERATE) moderateRisks.push(risk);
    }
    const seriousCount = seriousRisks.length;
    const acceptedSerious = seriousRisks.filter(
      (r) => r.status === RISK_ACCEPTED_STATUS
    ).length;
    const criticalActions = objActions.filter(
      (a) => a.liveCriticality === CRITICALITY.CRITICAL
    );
    const openCritical = criticalActions.length;
    const redMilestones = objMilestones.filter((m) => m.flag === RAG_RED);
    const amberMilestones = objMilestones.filter((m) => m.flag === RAG_AMBER);
    const programmeFlag = redMilestones.length
      ? RAG_RED
      : amberMilestones.length
        ? RAG_AMBER
        : SIGNAL_NONE;

    // Scored means the objective was looked at: a scored risk tagged to it
    // (any status), an open action serving it, or a FLAGGED milestone serving
    // it. A tagged but unscored risk is not evidence, and neither is an
    // unflagged milestone: the absence of a signal says something about the
    // calendar, not about the objective.
    const scored =
      scoredRiskObjectiveIds.has(objective.id) ||
      objActions.length > 0 ||
      objMilestones.some((m) => m.flag != null);

    // The date signal attaches to Time alone.
    const date = type === TIME_TYPE ? dateParts : null;

    let state;
    let trigger;
    if (!scored) {
      state = HEALTH_STATES.NOT_SCORED;
      trigger = { key: HEALTH_TRIGGERS.NOT_SCORED, detail: null };
    } else if (isProtected) {
      // The protected ladder, worst state first, conditions in rule order.
      if (worstRisk === SEVERITY_SERIOUS) {
        state = HEALTH_STATES.COMPROMISED;
        trigger = {
          key: HEALTH_TRIGGERS.SERIOUS_RISK,
          detail: seriousDetail(seriousRisks),
        };
      } else if (programmeFlag === RAG_RED) {
        state = HEALTH_STATES.COMPROMISED;
        trigger = {
          key: HEALTH_TRIGGERS.PROGRAMME_RED,
          detail: { milestoneKeys: redMilestones.map((m) => m.key) },
        };
      } else if (date != null && date.totalWeeksLate > 0) {
        // No grace band. Non-negotiable means no tolerance.
        state = HEALTH_STATES.COMPROMISED;
        trigger = { key: HEALTH_TRIGGERS.DATE_PAST_TARGET, detail: { ...date } };
      } else if (worstRisk === SEVERITY_MODERATE) {
        state = HEALTH_STATES.UNDER_PRESSURE;
        trigger = {
          key: HEALTH_TRIGGERS.MODERATE_RISK,
          detail: {
            count: moderateRisks.length,
            riskIds: moderateRisks.map((r) => r.id),
          },
        };
      } else if (openCritical >= 1) {
        state = HEALTH_STATES.UNDER_PRESSURE;
        trigger = {
          key: HEALTH_TRIGGERS.OPEN_CRITICAL_ACTIONS,
          detail: {
            count: openCritical,
            actionIds: criticalActions.map((a) => a.id),
          },
        };
      } else if (programmeFlag === RAG_AMBER) {
        state = HEALTH_STATES.UNDER_PRESSURE;
        trigger = {
          key: HEALTH_TRIGGERS.PROGRAMME_AMBER,
          detail: { milestoneKeys: amberMilestones.map((m) => m.key) },
        };
      } else if (
        date != null &&
        date.totalWeeksLate <= 0 &&
        date.totalWeeksLate >= -toleranceWeeks
      ) {
        // On target with no room left: within the tolerance of it, the
        // boundary inclusive at both ends.
        state = HEALTH_STATES.UNDER_PRESSURE;
        trigger = {
          key: HEALTH_TRIGGERS.DATE_WITHIN_TOLERANCE,
          detail: { ...date, toleranceWeeks },
        };
      } else {
        state = HEALTH_STATES.HOLDING;
        trigger = { key: HEALTH_TRIGGERS.HOLDING, detail: null };
      }
    } else {
      // The flexible ladder. The date signal can absorb but NEVER exhaust:
      // the stated tolerance is free text and uncomputable, so the engine
      // cannot know whether the agreed bound was passed.
      if (seriousCount >= 2) {
        state = HEALTH_STATES.EXHAUSTED;
        trigger = {
          key: HEALTH_TRIGGERS.SERIOUS_RISKS,
          detail: seriousDetail(seriousRisks),
        };
      } else if (programmeFlag === RAG_RED) {
        state = HEALTH_STATES.EXHAUSTED;
        trigger = {
          key: HEALTH_TRIGGERS.PROGRAMME_RED,
          detail: { milestoneKeys: redMilestones.map((m) => m.key) },
        };
      } else if (worstRisk === SEVERITY_SERIOUS) {
        state = HEALTH_STATES.ABSORBING;
        trigger = {
          key: HEALTH_TRIGGERS.SERIOUS_RISK,
          detail: seriousDetail(seriousRisks),
        };
      } else if (worstRisk === SEVERITY_MODERATE) {
        state = HEALTH_STATES.ABSORBING;
        trigger = {
          key: HEALTH_TRIGGERS.MODERATE_RISK,
          detail: {
            count: moderateRisks.length,
            riskIds: moderateRisks.map((r) => r.id),
          },
        };
      } else if (programmeFlag === RAG_AMBER) {
        state = HEALTH_STATES.ABSORBING;
        trigger = {
          key: HEALTH_TRIGGERS.PROGRAMME_AMBER,
          detail: { milestoneKeys: amberMilestones.map((m) => m.key) },
        };
      } else if (date != null && date.totalWeeksLate > 0) {
        state = HEALTH_STATES.ABSORBING;
        trigger = { key: HEALTH_TRIGGERS.DATE_PAST_TARGET, detail: { ...date } };
      } else {
        state = HEALTH_STATES.HOLDING;
        trigger = { key: HEALTH_TRIGGERS.HOLDING, detail: null };
      }
    }

    // Classification drift: the objective's live criticality from the kernel
    // against the baked criticality on the milestones serving it. Reported,
    // never resolved: the baked value is not re-derived and the two are not
    // averaged. No milestones, nothing to disagree with, drift null.
    const liveCriticality = deriveCriticality(objective.id, byId);
    let drift = null;
    for (const milestone of objMilestones) {
      if (
        milestone.criticality != null &&
        milestone.criticality !== liveCriticality
      ) {
        drift = { live: liveCriticality, baked: milestone.criticality };
        break;
      }
    }

    objectiveRows.push({
      id: objective.id,
      type,
      classification: objective.classification ?? null,
      isProtected,
      state,
      colour: STATE_COLOUR[state],
      signals: {
        worstRisk,
        seriousCount,
        acceptedSerious,
        openCritical,
        programmeFlag,
      },
      trigger,
      dateSignal: type === TIME_TYPE ? timeSignal : null,
      drift,
      items: {
        risks: objRisks,
        actions: objActions,
        milestones: objMilestones,
      },
    });
  }

  // The project state, from the scored protected objectives only. An
  // unscored protected objective pushes the project neither green nor red,
  // and with no protected objective scored at all the project has no state.
  const scoredProtected = objectiveRows.filter(
    (row) => row.isProtected && row.state !== HEALTH_STATES.NOT_SCORED
  );
  const scoredFlexible = objectiveRows.filter(
    (row) => !row.isProtected && row.state !== HEALTH_STATES.NOT_SCORED
  );
  const scoredProtectedCount = scoredProtected.length;

  let projectState;
  let sentenceRule;
  if (scoredProtectedCount === 0) {
    projectState = PROJECT_STATES.NO_STATE;
    sentenceRule = 0;
  } else if (
    scoredProtected.some((row) => row.state === HEALTH_STATES.COMPROMISED)
  ) {
    projectState = PROJECT_STATES.RED;
    sentenceRule = 1;
  } else if (
    scoredProtected.some((row) => row.state === HEALTH_STATES.UNDER_PRESSURE)
  ) {
    projectState = PROJECT_STATES.AMBER;
    sentenceRule = 2;
  } else if (
    scoredFlexible.some((row) => row.state === HEALTH_STATES.EXHAUSTED)
  ) {
    projectState = PROJECT_STATES.AMBER;
    sentenceRule = 3;
  } else if (
    scoredFlexible.some((row) => row.state === HEALTH_STATES.ABSORBING)
  ) {
    projectState = PROJECT_STATES.GREEN;
    sentenceRule = 4;
  } else {
    projectState = PROJECT_STATES.GREEN;
    sentenceRule = 5;
  }

  return {
    objectives: objectiveRows,
    project: { state: projectState, scoredProtectedCount, sentenceRule },
    gates,
    unlinked: { risks: unlinkedRisks, actions: unlinkedActions },
    unscoredRiskCount,
  };
}

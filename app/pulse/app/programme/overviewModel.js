/**
 * The Programme Overview tab display model (Programme module Phase 3.6). The
 * pure logic behind the Overview tab's three blocks: the Next Gate card, the
 * Needs attention list, and the Next 30 days lookahead. The screen is a thin
 * render over this helper, the same seam as trackingModel.js holds for the
 * band, so correctness lives here, not in the component.
 *
 * Pure and deterministic: no DB, no React, no clock. Every function reads the
 * frozen baseline's programme, the engine outputs the page already computed
 * (deriveRAG's flagged list, deriveForecast's per-point dates and met flags),
 * or plain inputs, and computes. Nothing here re-runs an engine, re-derives
 * what an engine computed, reads the system clock, or mutates what it is
 * given. Today is the surface's one clock read, made upstream on the page and
 * handed down; this model only compares against it.
 *
 * WHAT EACH BLOCK READS:
 *  - Next Gate reads the gate states off the forecast tree (met flags and
 *    forecast dates as the roll produced them) and the baseline dates off the
 *    frozen programme. The variance between them is display arithmetic, the
 *    same subtraction the band's forecast tile makes.
 *  - Needs attention reads the RAG engine's flagged list and reorders a copy,
 *    worst first. Nothing is added, dropped, or recoloured: the engine owns
 *    who is flagged and what colour each contributes; this model only orders
 *    and words it.
 *  - Next 30 days reads the forecast tree's unmet points against the today
 *    the page holds, on UTC calendar days, matching the surface's UTC-pinned
 *    date discipline.
 *
 * WHAT THIS MODEL DOES NOT DO. No RAG re-derivation and no forecast roll (the
 * engines own those rules); no marking a milestone met and no write of any
 * kind (the tab is read-only in this step); no second reading of the clock.
 */

import { RAG_CONDITIONS } from '../../../../lib/engine/programmeRAG.js';

// One week and one day in milliseconds, whole spans, the same convention as
// the engines this model reads and as trackingModel.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The criticality string a critical point carries on the assembled baseline.
// Gates carry no baked criticality: they are critical by their nature, the
// same reading as the RAG engine and trackingModel.js.
const CRITICAL = 'critical';

/**
 * The lookahead window in days. The Next 30 days block shows every unmet
 * point whose forecast date falls within this many days of today, bounds
 * inclusive on UTC calendar days (see nextThirtyDays).
 */
export const LOOKAHEAD_DAYS = 30;

/**
 * The three variance directions the Next Gate card states plainly. Frozen so
 * a caller cannot mutate the vocabulary.
 */
export const GATE_DIRECTIONS = Object.freeze({
  AHEAD: 'ahead',
  ON_BASELINE: 'on_baseline',
  BEHIND: 'behind',
});

// Soft parse to epoch milliseconds, or null. The frozen baseline carries its
// dates as ISO strings (the jsonb round trip), the engines return Dates; this
// reads either. Mirrors trackingModel.softEpoch and the engines'.
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

// The forecast tree's node for every point, keyed by the point id, met flag
// and forecast date as the forecast engine rolled them. Not-applicable stages
// are out of the programme and contribute nothing. Mirrors trackingModel's
// forecastNodesByKey.
function forecastNodesByKey(forecast) {
  const nodes = new Map();
  for (const stage of forecast?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key != null) nodes.set(milestone.key, milestone);
      }
    }
    if (stage.gate?.key != null) nodes.set(stage.gate.key, stage.gate);
  }
  return nodes;
}

// The direction of a variance under the surface's display-rounding
// convention, shared with trackingModel.varianceLabel: within half a week
// either side reads on baseline, otherwise the sign decides. Null where there
// is no variance to read.
function varianceDirection(varianceWeeks) {
  if (typeof varianceWeeks !== 'number' || !Number.isFinite(varianceWeeks)) {
    return null;
  }
  if (Math.round(Math.abs(varianceWeeks)) === 0) return GATE_DIRECTIONS.ON_BASELINE;
  return varianceWeeks > 0 ? GATE_DIRECTIONS.BEHIND : GATE_DIRECTIONS.AHEAD;
}

/**
 * The Next Gate card: the next unpassed gate in spine order, the order the
 * baseline's stages run 0 to 7 (the eight gates are the structural spine, so
 * the concurrent stage's gate takes its place at the end). Passed means met
 * in the forecast tree, the same met-points read every engine makes; a
 * not-applicable stage's gate is out of the programme and is skipped.
 *
 * Returns, for the next unpassed gate:
 *   {
 *     done: false,
 *     key, stage, name,     from the frozen baseline
 *     baselineDate,          Date, or null where the gate is undated
 *     forecastDate,          Date as the forecast engine rolled it, or null
 *     varianceWeeks,         exact signed weeks, forecast minus baseline, or
 *                            null where either side is missing
 *     direction,             a GATE_DIRECTIONS value, or null with no variance
 *   }
 * or { done: true } when every gate in the programme is passed: the honest
 * done state, never a blank.
 */
export function nextGateCard(programme, forecast) {
  const nodes = forecastNodesByKey(forecast);

  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const gate = stage.gate;
    if (gate?.key == null) continue;
    const node = nodes.get(gate.key);
    if (node?.met) continue;

    const baselineEpoch = softEpoch(gate.baselineDate);
    const forecastEpoch = softEpoch(node?.forecastDate);
    const varianceWeeks =
      baselineEpoch != null && forecastEpoch != null
        ? (forecastEpoch - baselineEpoch) / MS_PER_WEEK
        : null;

    return {
      done: false,
      key: gate.key,
      stage: stage.stage ?? null,
      name: gate.name ?? null,
      baselineDate: baselineEpoch == null ? null : new Date(baselineEpoch),
      forecastDate: forecastEpoch == null ? null : new Date(forecastEpoch),
      varianceWeeks,
      direction: varianceDirection(varianceWeeks),
    };
  }

  return { done: true };
}

/**
 * The Next Gate card's variance line, rounded here for display under the same
 * half-week convention as the band's varianceLabel, with the direction plain:
 * 'on baseline' within half a week either side, otherwise '3 wk behind
 * baseline' or '2 wk ahead of baseline'. Null where there is no variance to
 * state.
 */
export function directionLabel(varianceWeeks) {
  const direction = varianceDirection(varianceWeeks);
  if (direction == null) return null;
  if (direction === GATE_DIRECTIONS.ON_BASELINE) return 'on baseline';
  const magnitude = Math.round(Math.abs(varianceWeeks));
  return direction === GATE_DIRECTIONS.BEHIND
    ? `${magnitude} wk behind baseline`
    : `${magnitude} wk ahead of baseline`;
}

// The one stage whose gate has a review surface today. The Gate module's
// route, /pulse/app/gate, is the Stage 1 to 2 review and reads that stage's
// gate row alone, so only the stage 1 gate can link into it cleanly.
export const GATE_REVIEW_STAGE = 1;

/**
 * The href the Next Gate card links into, or null where no clean route
 * exists. The existing Gate module reviews exactly one transition, Stage 1 to
 * 2, so the card links only when the next unpassed gate is stage 1's; every
 * other gate has no review surface yet and its card stays unlinked rather
 * than forcing a route that does not fit.
 */
export function gateReviewHref(projectId, stage) {
  if (stage !== GATE_REVIEW_STAGE) return null;
  if (typeof projectId !== 'string' || projectId.trim() === '') return null;
  return `/pulse/app/gate?project=${projectId}`;
}

// Worst first: red before amber. An unknown colour ranks after both, so a
// malformed item can never displace a real flag.
const ATTENTION_COLOUR_RANK = {
  red: 0,
  amber: 1,
};

/**
 * The Needs attention list: the RAG engine's flagged items, reordered worst
 * first on a copy. Red before amber, and within a colour the furthest behind
 * first. A flagged item with no weeksBehind (a hard-floor breach not yet
 * overdue) orders as zero weeks behind, so it sits after the observably
 * behind items of its colour; ties keep the engine's own stage order (the
 * sort is stable). The items pass through untouched: the engine owns who is
 * flagged, each item's fields, and the colour it contributes.
 *
 * The list responds to the tolerance dial because the surface re-runs the RAG
 * derivation with the new tolerance and hands the fresh output here; this
 * model holds no tolerance state of its own.
 */
export function needsAttention(rag) {
  const flagged = rag?.flagged ?? [];
  return [...flagged].sort((a, b) => {
    const rankGap =
      (ATTENTION_COLOUR_RANK[a?.colour] ?? 2) -
      (ATTENTION_COLOUR_RANK[b?.colour] ?? 2);
    if (rankGap !== 0) return rankGap;
    return (b?.weeksBehind ?? 0) - (a?.weeksBehind ?? 0);
  });
}

/**
 * The plain-language reason line per flagged condition, one line each in the
 * RAG engine's own vocabulary. Frozen so a caller cannot mutate the copy.
 */
export const ATTENTION_REASONS = Object.freeze({
  [RAG_CONDITIONS.GATE_OVERDUE]:
    'The gate is past its baseline date without being met, so a stage boundary is waiting on a decision.',
  [RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE]:
    'Critical, and behind its baseline by more than the tolerance.',
  [RAG_CONDITIONS.CRITICAL_WITHIN_TOLERANCE]:
    'Critical, and behind its baseline within the tolerance.',
  [RAG_CONDITIONS.STANDARD_BEHIND]:
    'Standard, but behind its baseline, so it is pulled up here to be seen.',
  [RAG_CONDITIONS.HARD_FLOOR_BREACH]:
    'Its confirmed local hard floor is breached.',
});

/**
 * The reason line for a flagged item's condition, or null for an unknown
 * condition rather than an invented sentence.
 */
export function attentionReason(condition) {
  return ATTENTION_REASONS[condition] ?? null;
}

/**
 * How far behind a flagged item reads, rounded here for display: the whole
 * weeks behind, and 'under 1 wk behind' where the slip rounds to zero (a
 * flagged item is behind by construction, so zero would be dishonest). Null
 * where the item carries no slip at all (a hard-floor breach not yet
 * overdue).
 */
export function behindLabel(weeksBehind) {
  if (typeof weeksBehind !== 'number' || !Number.isFinite(weeksBehind)) {
    return null;
  }
  const magnitude = Math.round(weeksBehind);
  if (magnitude === 0) return 'under 1 wk behind';
  return `${magnitude} wk behind`;
}

// An epoch's UTC calendar day, as the epoch of that day's UTC midnight. The
// lookahead compares days, not instants, matching the surface's UTC-pinned
// date discipline: a point due today is due today whatever the clock reads.
function utcDayFloor(epoch) {
  return Math.floor(epoch / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * The Next 30 days lookahead: every unmet point whose forecast date falls
 * within the thirty days from today, soonest first. The window is measured on
 * UTC calendar days and both bounds are inclusive: a point forecast on
 * today's own UTC day is in (today the page read once and handed down, so an
 * overdue point the roll floored at today reads as due now), and a point
 * forecast on the UTC day exactly thirty days after today is in; the
 * thirty-first day is out.
 *
 * Reads the forecast tree's unmet points (met and forecast dates as the roll
 * produced them; a met point is done and never listed) and the frozen
 * programme for each point's name, kind, criticality, and stage. Gates read
 * critical by their nature, milestones by their baked criticality.
 * Not-applicable stages are out of the programme and contribute nothing. Ties
 * on a day keep programme order (the sort is stable).
 *
 * Returns [{ key, name, kind, criticality, stage, forecastDate }], soonest
 * first, or an empty array when the window is quiet. Null-safe on a missing
 * today (the page always supplies one; the engines upstream throw without
 * it).
 */
export function nextThirtyDays(programme, forecast, today) {
  const todayEpoch = softEpoch(today);
  if (todayEpoch == null) return [];

  const startDay = utcDayFloor(todayEpoch);
  const endDay = startDay + LOOKAHEAD_DAYS * MS_PER_DAY;
  const nodes = forecastNodesByKey(forecast);
  const items = [];

  const consider = (key, name, kind, criticality, stageNum) => {
    const node = nodes.get(key);
    if (node == null || node.met) return;
    const epoch = softEpoch(node.forecastDate);
    if (epoch == null) return;
    const day = utcDayFloor(epoch);
    if (day < startDay || day > endDay) return;
    items.push({
      key,
      name: name ?? null,
      kind,
      criticality,
      stage: stageNum,
      forecastDate: new Date(epoch),
    });
  };

  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const stageNum = stage.stage ?? null;
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key == null) continue;
        consider(
          milestone.key,
          milestone.name,
          'milestone',
          milestone.criticality === CRITICAL ? 'critical' : 'standard',
          stageNum
        );
      }
    }
    if (stage.gate?.key != null) {
      consider(stage.gate.key, stage.gate.name, 'gate', CRITICAL, stageNum);
    }
  }

  items.sort(
    (a, b) => a.forecastDate.getTime() - b.forecastDate.getTime()
  );
  return items;
}

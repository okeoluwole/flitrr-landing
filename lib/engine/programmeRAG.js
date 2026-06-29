/**
 * The Programme RAG engine (Programme module Phase 3.2). The second pure engine of
 * the tracking surface, the mirror of the percent-complete engine (3.1): where that
 * engine touched no dates, this one is almost entirely dates. It takes the frozen v1
 * baseline, a met-points view, today's date, and the tolerance, and colours the
 * programme Green, Amber, or Red under the observed-slip rule, returning the overall
 * colour, the per-stage colours, and the list of items that are behind or breaching.
 *
 * Pure and deterministic: no DB, no React, no network, and above all no system
 * clock. Today comes in as an input, never read from the clock, so the same today
 * always gives the same colour and the colour is reproducible. It reads the baseline
 * as plain input (it does not load it) and the met-points view as plain input (the
 * actuals store and the gate mechanic will produce that view together later in this
 * phase), and computes. It mutates nothing it is given.
 *
 * THE INPUT IT READS:
 *
 *  - The baseline, the frozen assembled programme from a locked v1
 *    (lib/engine/programmeAssembly.js, stored by programmeBaselineStore.js):
 *    stages, each holding its ordered activities, each activity holding its
 *    milestones (each with a stable key, a baseline date, and a baked
 *    criticality), and each stage holding its gate (a key, gate_<stage>, a
 *    baseline date, and closesActivityKey). Each applicable stage also carries its
 *    stageStart, the anchor the hard-floor span is measured from. This engine reads
 *    the baseline dates and the baked criticality; it never recomputes criticality.
 *  - The met-points view, the same map the percent-complete engine reads, a map
 *    keyed by the point identifier as it appears in the baseline. Milestone keys and
 *    gate identifiers share one keyspace and never collide. A point not in the map
 *    is not met. As in 3.1 the met date is not read; only met or not met matters. A
 *    met record for a point the baseline does not contain is ignored, because the
 *    engine iterates the baseline and only ever looks a point up by its baseline
 *    key. Accepts the view as a plain object or a Map.
 *  - Today's date, passed in. The engine never reads the system clock. The same
 *    today always gives the same colour. Required: a status with no today is
 *    meaningless, so the engine throws rather than guessing the date.
 *  - The tolerance in weeks, passed in. This is the four-week dial of the
 *    specification, but the surface owns the default and passes it in; the engine
 *    does not hardcode it. A finite, non-negative number is required.
 *  - Confirmed local floors, the same shape the reality-check engine takes
 *    (options.localFloors = { [stage]: { floorWeeks } }), passed in. None are wired
 *    today, so the hard-floor branch is dormant on current data; it is still built
 *    and tested.
 *
 * THE RULE, observed slip. Behind means a point is unmet and today has passed its
 * baseline date. A met point is done and is never behind, even if its baseline date
 * has passed. A point not yet at its baseline date is not behind, so an unmet
 * critical item reads Green until its date passes; there is no approaching-amber
 * state. The forecast for an unmet point is simply its baseline date, so there is no
 * re-forecast here; if the observed-slip lag ever feels too slow on the surface,
 * re-forecasting is the clean addition and it lands on this engine.
 *
 * Each unmet, behind point is classified:
 *
 *  - A gate that is behind is Red on its own, ahead of any tolerance. Gates are
 *    critical points by their nature.
 *  - A critical milestone that is behind is Red when it is behind by more than the
 *    tolerance, Amber when it is behind by the tolerance or less. The boundary,
 *    behind by exactly the tolerance, is Amber.
 *  - A standard milestone that is behind is Amber, by any amount.
 *  - A hard-floor breach, a gate whose confirmed local floor is breached, is Red.
 *    The breach mirrors the reality-check engine's definition exactly: a confirmed
 *    floor is supplied for the stage and the gate's baseline placement, the weeks
 *    from the stage start to the gate's baseline date, falls below it. This is a
 *    baseline-integrity condition that does not read today; it is dormant on current
 *    data because no floors are supplied. When a gate is both breaching and overdue
 *    the breach is reported, the more specific condition; both are Red so the colour
 *    is unchanged.
 *
 * The slip is computed in weeks with the same UTC week arithmetic the reality-check
 * engine uses, exact and unrounded (display rounding is the surface's concern). A
 * met milestone's baked criticality is read straight from the baseline, never
 * recomputed.
 *
 * THE WORST-WINS ROLL-UP. The overall programme colour is the worst across all
 * flagged points: Red if any Red condition holds, else Amber if any Amber condition
 * holds, else Green. The per-stage colour is the worst within that stage. A stage
 * with no behind or breaching point is Green.
 *
 * NOT-APPLICABLE STAGES. A stage the developer marked not applicable (applicable is
 * false on the assembled baseline) is excluded entirely, exactly as in 3.1: it
 * raises no flagged item, its never-met gate can never fire a colour, and it does
 * not enter the overall roll-up. Its per-stage colour is reported null. Only an
 * explicit applicable === false skips a stage; an absent flag is treated as
 * applicable.
 *
 * OUT OF SCOPE HERE: no percent-complete (that is 3.1), no persistence, no actuals
 * store, no gate mechanic, no migration, no database, no reading of the baseline
 * from the store, no forecast dates and no manual re-forecast, and no reading of the
 * system clock.
 */

// The three RAG colours, the only status values the engine assigns. Frozen so a
// caller cannot mutate the vocabulary.
export const RAG_STATUS = Object.freeze({
  GREEN: 'green',
  AMBER: 'amber',
  RED: 'red',
});

// Worst-wins order: a higher rank dominates the roll-up. Green is the floor, Red the
// ceiling. These rank the colours for the worst-across and worst-within roll-ups;
// they are not thresholds.
const STATUS_RANK = Object.freeze({
  [RAG_STATUS.GREEN]: 0,
  [RAG_STATUS.AMBER]: 1,
  [RAG_STATUS.RED]: 2,
});

// The condition each flagged item triggered, the reason it carries its colour.
// Frozen so a caller cannot mutate the vocabulary.
export const RAG_CONDITIONS = Object.freeze({
  // A gate behind: unmet with its baseline date passed. Red, ahead of any tolerance.
  GATE_OVERDUE: 'gate_overdue',
  // A critical milestone behind by more than the tolerance. Red.
  CRITICAL_BEYOND_TOLERANCE: 'critical_beyond_tolerance',
  // A critical milestone behind by the tolerance or less. Amber. The boundary,
  // behind by exactly the tolerance, lands here.
  CRITICAL_WITHIN_TOLERANCE: 'critical_within_tolerance',
  // A standard milestone behind by any amount. Amber.
  STANDARD_BEHIND: 'standard_behind',
  // A gate whose confirmed local floor is breached. Red. Dormant on current data.
  HARD_FLOOR_BREACH: 'hard_floor_breach',
});

// The two kinds of point the engine colours, the same vocabulary the reality-check
// engine uses. A gate is a stage's go or no-go boundary; a milestone is a dated
// point sitting under an activity.
export const RAG_ITEM_KINDS = Object.freeze({
  GATE: 'gate',
  MILESTONE: 'milestone',
});

// The criticality string a gate carries when flagged. Gates are critical points by
// their nature, so a flagged gate always reports critical regardless of any
// objective link. Milestones carry their baked criticality from the baseline.
const GATE_CRITICALITY = 'critical';

// One week in milliseconds. Weeks are whole seven-day spans, so measuring them in
// epoch milliseconds is exact and timezone-neutral. The same convention as
// programmeSchedule.js, programmeRealityCheck.js, and programmeAssembly.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Soft parse to epoch milliseconds, or null. An absent, empty or unparseable value
// (an undated point) is simply "no date". Accepts a Date, an ISO date string (a
// plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds. Mirrors
// programmeRealityCheck.softEpoch and programmeAssembly.softEpoch.
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

// The whole-week distance between two epochs, in weeks. May be fractional when a
// date sits off a whole-week boundary. The same arithmetic the reality-check engine
// uses for its implied durations.
function weeksBetween(fromEpoch, toEpoch) {
  return (toEpoch - fromEpoch) / MS_PER_WEEK;
}

// The worst of two colours under the worst-wins order. Used to roll points up to a
// stage and stages up to the programme.
function worst(a, b) {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * Whether a single point is met in the met-points view. Identical to the
 * percent-complete engine's rule so the two engines read one view the same way: the
 * canonical entry is { met: true, metDate }, but any present entry whose `met` is
 * not false marks the point met, a bare truthy value is accepted too, and a point
 * not in the map is not met. The met date is never read here. Accepts the view as a
 * Map or a plain object keyed by the point id.
 */
function isPointMet(metView, key) {
  if (key == null || metView == null) return false;
  const record = metView instanceof Map ? metView.get(key) : metView[key];
  if (record == null) return false;
  if (typeof record === 'object') return record.met !== false;
  return Boolean(record);
}

// Whether a confirmed local floor value counts: a finite, non-negative number of
// weeks. Mirrors the reality-check engine exactly, including that zero is a valid
// confirmed value (the requirement was checked and carries no minimum) and a
// malformed value (NaN, Infinity, negative) is treated as not supplied.
function hasConfirmedFloor(floorWeeks) {
  return (
    typeof floorWeeks === 'number' &&
    Number.isFinite(floorWeeks) &&
    floorWeeks >= 0
  );
}

/**
 * Colour one milestone. Returns a flagged item when the milestone is behind, else
 * null. A met milestone is done and never behind; an unmet milestone not yet at its
 * baseline date is not behind. A behind critical milestone is Red beyond the
 * tolerance and Amber at or within it; a behind standard milestone is Amber.
 */
function colourMilestone(milestone, stageNum, metView, todayEpoch, toleranceWeeks) {
  const key = milestone?.key ?? null;
  if (key == null) return null;
  if (isPointMet(metView, key)) return null;

  const baselineEpoch = softEpoch(milestone.baselineDate);
  if (baselineEpoch == null) return null;
  // Behind means today has passed the baseline date: strictly after, so a point on
  // its baseline date is not yet behind and reads Green.
  if (todayEpoch <= baselineEpoch) return null;

  const weeksBehind = weeksBetween(baselineEpoch, todayEpoch);
  const critical = milestone.criticality === GATE_CRITICALITY;

  let colour;
  let condition;
  if (critical) {
    if (weeksBehind > toleranceWeeks) {
      colour = RAG_STATUS.RED;
      condition = RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE;
    } else {
      colour = RAG_STATUS.AMBER;
      condition = RAG_CONDITIONS.CRITICAL_WITHIN_TOLERANCE;
    }
  } else {
    colour = RAG_STATUS.AMBER;
    condition = RAG_CONDITIONS.STANDARD_BEHIND;
  }

  return {
    key,
    kind: RAG_ITEM_KINDS.MILESTONE,
    name: milestone.name ?? null,
    criticality: critical ? 'critical' : 'standard',
    stage: stageNum,
    baselineDate: new Date(baselineEpoch),
    weeksBehind,
    condition,
    colour,
  };
}

/**
 * Colour one gate. Returns a flagged item when the gate is breaching or overdue,
 * else null. A met gate is done and never flagged. An unmet gate is Red if its
 * confirmed local floor is breached (a baseline-integrity condition that does not
 * read today), else Red if it is overdue (its baseline date has passed). When both
 * hold the breach is reported, the more specific condition; both are Red so the
 * colour is unchanged. A gate is always reported critical.
 */
function colourGate(gate, stageNum, stageStartEpoch, metView, todayEpoch, floor) {
  const key = gate?.key ?? null;
  if (key == null) return null;
  if (isPointMet(metView, key)) return null;

  const baselineEpoch = softEpoch(gate.baselineDate);
  const overdue = baselineEpoch != null && todayEpoch > baselineEpoch;
  const weeksBehind = overdue ? weeksBetween(baselineEpoch, todayEpoch) : null;

  // The hard-floor breach, dormant today: a confirmed floor for this stage, breached
  // by the gate's baseline placement (the weeks from the stage start to the gate's
  // baseline date falling below the floor). Strictly below is a breach, mirroring
  // the reality-check engine.
  const floorWeeks = floor?.floorWeeks;
  let breached = false;
  if (
    hasConfirmedFloor(floorWeeks) &&
    stageStartEpoch != null &&
    baselineEpoch != null
  ) {
    breached = weeksBetween(stageStartEpoch, baselineEpoch) < floorWeeks;
  }

  if (!breached && !overdue) return null;

  return {
    key,
    kind: RAG_ITEM_KINDS.GATE,
    name: gate.name ?? null,
    criticality: GATE_CRITICALITY,
    stage: stageNum,
    baselineDate: baselineEpoch == null ? null : new Date(baselineEpoch),
    weeksBehind,
    condition: breached
      ? RAG_CONDITIONS.HARD_FLOOR_BREACH
      : RAG_CONDITIONS.GATE_OVERDUE,
    colour: RAG_STATUS.RED,
  };
}

/**
 * Colour a frozen baseline against a met-points view at a given today.
 *
 *   baseline       the frozen assembled programme (assembleProgramme's output, or
 *                  the programme stored on a baseline row): { stages: [...] }. Read
 *                  as plain input, never loaded here.
 *   metPoints      the met-points view: a plain object or Map keyed by the point id
 *                  (milestone keys and gate keys in one keyspace), each entry marking
 *                  the point met. Absent or empty means nothing is met.
 *   today          a Date, an ISO date string, or epoch milliseconds. Required: the
 *                  colour is meaningless without a today, and the engine never reads
 *                  the clock, so a missing today throws.
 *   toleranceWeeks the critical-slip tolerance in weeks, passed in by the surface (a
 *                  finite, non-negative number). The boundary, behind by exactly the
 *                  tolerance, reads Amber.
 *   options        optional. options.localFloors is the confirmed local hard floors,
 *                  keyed by stage: { [stage]: { floorWeeks } }, the same shape the
 *                  reality-check engine takes. Dormant on current data.
 *
 * Returns the status object, deterministic for the same inputs:
 *   {
 *     status,            the overall programme colour, worst across all points
 *     stages: [
 *       {
 *         stage,         the stage number
 *         applicable,    false for a stage marked not applicable
 *         status,        the per-stage colour, worst within the stage, or null when
 *                        not applicable
 *       }
 *     ],
 *     flagged: [         the behind or breaching points, in stage then
 *                        milestone-before-gate order; met, not-yet-due, and
 *                        not-behind points are not flagged
 *       {
 *         key,
 *         kind,          'gate' | 'milestone'
 *         name,
 *         criticality,   'critical' | 'standard'  (a gate is always 'critical')
 *         stage,         the stage the point sits in
 *         baselineDate,  Date
 *         weeksBehind,   the exact observed slip in weeks when behind, else null
 *                        (a hard-floor breach that is not yet overdue)
 *         condition,     a RAG_CONDITIONS value
 *         colour,        the colour this item contributes: 'red' | 'amber'
 *       }
 *     ]
 *   }
 */
export function deriveRAG(baseline, metPoints, today, toleranceWeeks, options) {
  const todayEpoch = softEpoch(today);
  if (todayEpoch == null) {
    throw new Error('deriveRAG: a today date is required');
  }
  if (
    typeof toleranceWeeks !== 'number' ||
    !Number.isFinite(toleranceWeeks) ||
    toleranceWeeks < 0
  ) {
    throw new Error('deriveRAG: a non-negative tolerance in weeks is required');
  }

  const localFloors = options?.localFloors ?? {};
  const stageDefs = baseline?.stages ?? [];

  const flagged = [];
  let overall = RAG_STATUS.GREEN;

  const stages = stageDefs.map((stage) => {
    const stageNum = stage?.stage ?? null;
    const applicable = stage?.applicable !== false;

    if (!applicable) {
      // A not-applicable stage is excluded entirely: no flagged item, no colour, and
      // it does not enter the overall roll-up. Its never-met gate cannot fire Red.
      return { stage: stageNum, applicable: false, status: null };
    }

    let stageStatus = RAG_STATUS.GREEN;

    // Milestones first, in activity then milestone order, then the gate. This is the
    // same order the reality-check engine emits its items in, so a caller reading
    // both reads them the same way.
    for (const activity of stage?.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        const item = colourMilestone(
          milestone,
          stageNum,
          metPoints,
          todayEpoch,
          toleranceWeeks
        );
        if (item) {
          flagged.push(item);
          stageStatus = worst(stageStatus, item.colour);
        }
      }
    }

    const stageStartEpoch = softEpoch(stage?.stageStart);
    const gateItem = colourGate(
      stage?.gate,
      stageNum,
      stageStartEpoch,
      metPoints,
      todayEpoch,
      localFloors[stageNum]
    );
    if (gateItem) {
      flagged.push(gateItem);
      stageStatus = worst(stageStatus, gateItem.colour);
    }

    overall = worst(overall, stageStatus);
    return { stage: stageNum, applicable: true, status: stageStatus };
  });

  return { status: overall, stages, flagged };
}

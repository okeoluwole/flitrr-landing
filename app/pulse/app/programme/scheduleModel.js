/**
 * The Programme Schedule tab display model (Programme module Phase 3.7). The
 * pure logic behind the Schedule tab's three faces: the high-level breakdown
 * (the filtered four-column table), the Register (the same four columns over
 * every point, grouped by stage), and the Timeline (the same points laid out
 * on time, baseline against forecast, so drift reads visually). The screen is
 * a thin render over this helper, the same seam trackingModel.js holds for
 * the band and overviewModel.js holds for the Overview tab, so correctness
 * lives here, not in the component.
 *
 * Pure and deterministic: no DB, no React, no clock. Every function reads the
 * frozen baseline's programme, the engine outputs the page already computed
 * (deriveForecast's per-point dates and met flags, deriveRAG's flagged list),
 * or plain inputs, and computes. Nothing here re-runs an engine, re-derives
 * what an engine computed, reads the system clock, or mutates what it is
 * given. Today is the surface's one clock read, made upstream on the page and
 * handed down; the timeline only places it on the axis.
 *
 * WHAT EACH FACE READS:
 *  - Every face reads one row set, built once per derivation: a row per
 *    trackable point (milestone or gate), its identity and criticality from
 *    the frozen baseline, its Current date and met flag from the forecast
 *    tree, and its flag and colour from the RAG derivation. The variance is
 *    the surface subtracting the two dates it holds, forecast minus baseline,
 *    display arithmetic under the same half-week convention as the band and
 *    the Overview tab; it is not an engine.
 *  - The high-level breakdown filters that set by the specification's fixed
 *    rule (Section 9): the gates always, every critical milestone always, and
 *    anything flagged. The flagged part responds to the tolerance dial
 *    because the surface re-runs the RAG derivation and hands the fresh
 *    output back through scheduleRows; this model holds no tolerance state.
 *  - The Register groups the full set by stage, in the baseline's own stage
 *    order, each stage's points in programme order.
 *  - The Timeline positions each point from its baseline and forecast dates
 *    only, as fractions of the one shared time domain. It invents no
 *    dependencies, smooths nothing, and orders nothing beyond the dates: a
 *    point sits where its dates put it.
 *
 * WHAT THIS MODEL DOES NOT DO. No RAG re-derivation and no forecast roll (the
 * engines own those rules); no marking a milestone met and no write of any
 * kind (the tab is read-only in this step); no second reading of the clock;
 * no percent-complete (the four columns carry no progress figure).
 */

// One week in milliseconds, whole seven-day spans, the same convention as the
// engines this model reads and as trackingModel.js and overviewModel.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// The criticality string a critical point carries on the assembled baseline.
// Gates carry no baked criticality: they are critical by their nature, the
// same reading as the RAG engine and the sibling display models.
const CRITICAL = 'critical';

/**
 * The three variance directions a row states plainly, the same vocabulary and
 * values as the Overview tab's GATE_DIRECTIONS so the two tabs read one
 * convention. Frozen so a caller cannot mutate it.
 */
export const VARIANCE_DIRECTIONS = Object.freeze({
  AHEAD: 'ahead',
  ON_BASELINE: 'on_baseline',
  BEHIND: 'behind',
});

// The most tick labels the timeline axis carries; the month boundaries are
// thinned to this many so a two-year programme never crowds the axis.
const MAX_TIMELINE_TICKS = 6;

// Soft parse to epoch milliseconds, or null. The frozen baseline carries its
// dates as ISO strings (the jsonb round trip), the engines return Dates; this
// reads either. Mirrors trackingModel.softEpoch and overviewModel.softEpoch.
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
// and overviewModel's forecastNodesByKey.
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

// The RAG derivation's flagged items by key: who is flagged and the colour
// each contributes. The engine owns both; this model only looks them up.
function flaggedByKey(rag) {
  const flags = new Map();
  for (const item of rag?.flagged ?? []) {
    if (item?.key != null) flags.set(item.key, item);
  }
  return flags;
}

// The direction of a variance under the surface's display-rounding
// convention, shared with trackingModel.varianceLabel and the Overview tab:
// within half a week either side reads on baseline, otherwise the sign
// decides. Null where there is no variance to read.
function varianceDirection(varianceWeeks) {
  if (typeof varianceWeeks !== 'number' || !Number.isFinite(varianceWeeks)) {
    return null;
  }
  if (Math.round(Math.abs(varianceWeeks)) === 0) {
    return VARIANCE_DIRECTIONS.ON_BASELINE;
  }
  return varianceWeeks > 0
    ? VARIANCE_DIRECTIONS.BEHIND
    : VARIANCE_DIRECTIONS.AHEAD;
}

/**
 * The one row set every face of the Schedule tab reads: a row per trackable
 * point (every keyed milestone and gate of every applicable stage), in
 * programme order (stages in baseline order; within a stage each activity's
 * milestones in order, then the gate last, the order the engines emit).
 *
 * Each row joins the three things the page already holds:
 *   - identity and criticality from the frozen baseline: key, name, kind
 *     ('milestone' | 'gate'), stage, stageName, and criticality ('critical' |
 *     'standard'; a gate is always critical, by its nature);
 *   - the Current side from the forecast tree: met as the roll read it, and
 *     currentDate, the forecast engine's date for the point (the rolled
 *     forecast when unmet, the stamped actual when met, null for a met point
 *     with no recorded date), which is exactly the specification's current
 *     date, the forecast or the actual once met;
 *   - the flag from the RAG derivation: flagged, and flagColour, the colour
 *     the item contributes ('red' | 'amber'), null when not flagged.
 *
 * The variance is derived here, display arithmetic on the two dates the row
 * holds: varianceWeeks, exact signed weeks, currentDate minus baselineDate
 * (null where either side is missing), and direction, its half-week-rounded
 * reading ('ahead' | 'on_baseline' | 'behind').
 *
 * A not-applicable stage is out of the programme and contributes no rows,
 * exactly as the engines exclude it. A keyless point is not trackable (it can
 * never carry a forecast or a flag) and is skipped, as the engines skip it.
 * Nothing given is mutated; every row is a fresh object.
 */
export function scheduleRows(programme, forecast, rag) {
  const nodes = forecastNodesByKey(forecast);
  const flags = flaggedByKey(rag);
  const rows = [];

  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const stageNum = stage.stage ?? null;
    const stageName = stage.name ?? null;

    const addRow = (point, kind, criticality) => {
      const node = nodes.get(point.key);
      const flag = flags.get(point.key);
      const baselineEpoch = softEpoch(point.baselineDate);
      const currentEpoch = softEpoch(node?.forecastDate);
      const varianceWeeks =
        baselineEpoch != null && currentEpoch != null
          ? (currentEpoch - baselineEpoch) / MS_PER_WEEK
          : null;
      rows.push({
        key: point.key,
        name: point.name ?? null,
        kind,
        criticality,
        stage: stageNum,
        stageName,
        met: node?.met === true,
        flagged: flag != null,
        flagColour: flag?.colour ?? null,
        baselineDate: baselineEpoch == null ? null : new Date(baselineEpoch),
        currentDate: currentEpoch == null ? null : new Date(currentEpoch),
        varianceWeeks,
        direction: varianceDirection(varianceWeeks),
      });
    };

    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key == null) continue;
        addRow(
          milestone,
          'milestone',
          milestone.criticality === CRITICAL ? 'critical' : 'standard'
        );
      }
    }
    if (stage.gate?.key != null) {
      addRow(stage.gate, 'gate', CRITICAL);
    }
  }

  return rows;
}

/**
 * The high-level breakdown: the specification's fixed filter over the row
 * set, exactly the gates, every critical milestone, and anything flagged. A
 * standard point slipping on its own is pulled up by its flag, so nothing
 * material hides; a standard, unflagged point lives in the full schedule
 * only.
 *
 * Ordered by baseline date, earliest first, so it reads as the programme
 * runs. The sort is stable on a copy: rows sharing a baseline date keep
 * programme order, an undated row sinks to the end in programme order, and
 * the given rows are never reordered in place.
 */
export function highLevelRows(rows) {
  const kept = (rows ?? []).filter(
    (row) =>
      row != null &&
      (row.kind === 'gate' || row.criticality === CRITICAL || row.flagged)
  );
  return kept
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aEpoch = softEpoch(a.row.baselineDate);
      const bEpoch = softEpoch(b.row.baselineDate);
      if (aEpoch == null && bEpoch == null) return a.index - b.index;
      if (aEpoch == null) return 1;
      if (bEpoch == null) return -1;
      if (aEpoch !== bEpoch) return aEpoch - bEpoch;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * The Register's grouping: the full row set grouped by stage, stages in the
 * order the rows run (the baseline's own order), each group carrying its
 * stage number, stage name, and its rows in programme order. Returns
 * [{ stage, stageName, rows }]. The given rows are not mutated; the groups
 * hold fresh arrays.
 */
export function registerGroups(rows) {
  const groups = [];
  const byStage = new Map();
  for (const row of rows ?? []) {
    if (row == null) continue;
    let group = byStage.get(row.stage);
    if (group == null) {
      group = { stage: row.stage, stageName: row.stageName, rows: [] };
      byStage.set(row.stage, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

// The UTC month boundaries strictly inside a domain, thinned to at most
// MAX_TIMELINE_TICKS so a long programme never crowds the axis. Pure calendar
// arithmetic on the domain the dates themselves set.
function monthTicks(startEpoch, endEpoch) {
  if (startEpoch == null || endEpoch == null || endEpoch <= startEpoch) {
    return [];
  }
  const first = new Date(startEpoch);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth() + 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const boundaries = [];
  let tick = Date.UTC(year, month, 1);
  while (tick < endEpoch) {
    boundaries.push(tick);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    tick = Date.UTC(year, month, 1);
  }
  const step = Math.max(1, Math.ceil(boundaries.length / MAX_TIMELINE_TICKS));
  return boundaries.filter((_, index) => index % step === 0);
}

/**
 * The Timeline's layout: the same rows laid out on time, each point placed by
 * its baseline and forecast dates only, as fractions of the one shared
 * domain, so the component renders positions without holding any date
 * arithmetic of its own.
 *
 * The domain is set by the dates themselves: the earliest and latest across
 * every row's baseline and current dates, widened to include today where a
 * parseable today is given (today the page read once and handed down; this
 * helper only places it). Every fraction is (epoch minus start) over the
 * span. A degenerate domain (everything on one instant) places everything at
 * one half, rather than dividing by zero.
 *
 * Returns:
 *   {
 *     start, end,        the domain as Dates, or null with no dated row
 *     todayFrac,         today's place on the axis, or null
 *     ticks: [           UTC month boundaries inside the domain, thinned,
 *       { frac, date }   for the axis; formatting is the component's
 *     ],
 *     lanes: [           one lane per stage, in the rows' own stage order
 *       {
 *         stage, stageName,
 *         spanStartFrac, spanEndFrac,   the stage's baseline extent, the
 *                        earliest to the latest baseline date among its own
 *                        points, or null where the lane holds no dated
 *                        baseline; context only, derived from real dates
 *         points: [      the lane's rows in programme order, each with
 *           { ...row, baselineFrac, currentFrac }   its two positions, null
 *                        where the respective date is missing
 *         ]
 *       }
 *     ]
 *   }
 *
 * It invents nothing: no dependencies, no smoothing, no ordering beyond the
 * dates. A point past its gate sits past its gate. The given rows are not
 * mutated; every point is a fresh object.
 */
export function timelineLayout(rows, today) {
  const todayEpoch = softEpoch(today);

  let startEpoch = null;
  let endEpoch = null;
  const widen = (epoch) => {
    if (epoch == null) return;
    if (startEpoch == null || epoch < startEpoch) startEpoch = epoch;
    if (endEpoch == null || epoch > endEpoch) endEpoch = epoch;
  };
  for (const row of rows ?? []) {
    if (row == null) continue;
    widen(softEpoch(row.baselineDate));
    widen(softEpoch(row.currentDate));
  }
  const hasDatedRow = startEpoch != null;
  if (hasDatedRow) widen(todayEpoch);

  const span = hasDatedRow ? endEpoch - startEpoch : null;
  const frac = (epoch) => {
    if (epoch == null || !hasDatedRow) return null;
    if (span === 0) return 0.5;
    return (epoch - startEpoch) / span;
  };

  const lanes = registerGroups(rows).map((group) => {
    let laneStart = null;
    let laneEnd = null;
    const points = group.rows.map((row) => {
      const baselineEpoch = softEpoch(row.baselineDate);
      const currentEpoch = softEpoch(row.currentDate);
      if (baselineEpoch != null) {
        if (laneStart == null || baselineEpoch < laneStart) {
          laneStart = baselineEpoch;
        }
        if (laneEnd == null || baselineEpoch > laneEnd) laneEnd = baselineEpoch;
      }
      return {
        ...row,
        baselineFrac: frac(baselineEpoch),
        currentFrac: frac(currentEpoch),
      };
    });
    return {
      stage: group.stage,
      stageName: group.stageName,
      spanStartFrac: frac(laneStart),
      spanEndFrac: frac(laneEnd),
      points,
    };
  });

  return {
    start: hasDatedRow ? new Date(startEpoch) : null,
    end: hasDatedRow ? new Date(endEpoch) : null,
    todayFrac: hasDatedRow ? frac(todayEpoch) : null,
    ticks: hasDatedRow
      ? monthTicks(startEpoch, endEpoch).map((epoch) => ({
          frac: frac(epoch),
          date: new Date(epoch),
        }))
      : [],
    lanes,
  };
}

/**
 * The Variance column's label, rounded here for display under the same
 * half-week convention as the band and the Overview tab, direction plain and
 * compact for a table cell: 'on baseline' within half a week either side,
 * otherwise '3 wk behind' or '2 wk ahead'. Null where there is no variance to
 * state (either date missing).
 */
export function varianceText(varianceWeeks) {
  const direction = varianceDirection(varianceWeeks);
  if (direction == null) return null;
  if (direction === VARIANCE_DIRECTIONS.ON_BASELINE) return 'on baseline';
  const magnitude = Math.round(Math.abs(varianceWeeks));
  return direction === VARIANCE_DIRECTIONS.BEHIND
    ? `${magnitude} wk behind`
    : `${magnitude} wk ahead`;
}

/**
 * The Programme Schedule tab display model (Programme module Phase 3.7,
 * restructured for Note 17 finding 3). The pure logic behind the Schedule
 * tab's one register: the four-column point rows, the filter that decides
 * which of them the register carries, and the stage grouping it is read in.
 * The screen is a thin render over this helper, the same seam trackingModel.js
 * holds for the band and overviewModel.js holds for the Overview tab, so
 * correctness lives here, not in the component. The chart beside the register
 * reads the same row set through chartModel.js.
 *
 * Pure and deterministic: no DB, no React, no clock. Every function reads the
 * frozen baseline's programme, the engine outputs the page already computed
 * (deriveForecast's per-point dates and met flags, deriveRAG's flagged list),
 * or plain inputs, and computes. Nothing here re-runs an engine, re-derives
 * what an engine computed, reads the system clock, or mutates what it is
 * given.
 *
 * WHAT THE REGISTER READS:
 *  - One row set, built once per derivation: a row per trackable point
 *    (milestone or gate), its identity and criticality from the frozen
 *    baseline, its Current date and met flag from the forecast tree, and its
 *    flag and colour from the RAG derivation. The variance is the surface
 *    subtracting the two dates it holds, forecast minus baseline, display
 *    arithmetic under the same half-week convention as the band and the
 *    Overview tab; it is not an engine.
 *  - One filter over that set, the governing view or every point. The
 *    governing view is the specification's fixed rule (Section 9): the gates
 *    always, every critical milestone always, and anything flagged. It is a
 *    view of the register, not a second table: the register was two tables
 *    with identical columns, one a subset of the other, and is now one. The
 *    flagged part responds to the tolerance dial because the surface re-runs
 *    the RAG derivation and hands the fresh output back through scheduleRows;
 *    this model holds no tolerance state. Criticality is the derived value
 *    already on each row, never a control of its own.
 *  - One grouping, by stage, in the baseline's own stage order, each stage's
 *    points in programme order.
 *
 * WHAT THIS MODEL DOES NOT DO. No RAG re-derivation and no forecast roll (the
 * engines own those rules); no chart geometry (chartModel.js holds the one
 * chart view-model); no marking a milestone met and no write of any kind (the
 * mark action lives in the point detail, detailModel.js over the Phase 3.3
 * store, and the rows themselves stay read-only); no second reading of the
 * clock; no percent-complete (the four columns carry no progress figure).
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

/**
 * The register's two views, one register seen two ways. 'governing' is the
 * fixed governance filter, the gates always, every critical milestone always,
 * and anything flagged; 'all' is every trackable point. Frozen so a caller
 * cannot mutate the vocabulary.
 */
export const REGISTER_FILTERS = Object.freeze([
  Object.freeze({
    key: 'governing',
    label: 'Critical and gates',
    note: 'Every gate, every critical milestone, and anything flagged at this tolerance.',
  }),
  Object.freeze({
    key: 'all',
    label: 'All points',
    note: 'Every point in the locked programme, grouped by stage.',
  }),
]);

// The view the register opens on: the governing one, so the surface leads with
// what carries the programme rather than with its full length.
export const DEFAULT_REGISTER_FILTER = 'governing';

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
 * The register's filter: the row set as the chosen view carries it, in
 * programme order (the order the register groups and reads in, never
 * re-sorted here).
 *
 * 'governing' keeps exactly the gates, every critical milestone, and anything
 * flagged. Criticality is the derived value already on the row, read from the
 * objective the point serves; the filter classifies nothing itself. A standard
 * point slipping on its own is pulled up by its flag, so nothing material
 * hides, and a standard, unflagged point is one toggle away in 'all'.
 *
 * 'all' keeps every trackable point. An unknown key falls back to the default
 * view, so the register always has rows to group.
 *
 * The given rows are never reordered or mutated; the result is a fresh array.
 */
export function filterRows(rows, filterKey) {
  const known = REGISTER_FILTERS.some((entry) => entry.key === filterKey);
  const key = known ? filterKey : DEFAULT_REGISTER_FILTER;
  const present = (rows ?? []).filter((row) => row != null);
  if (key === 'all') return present;
  return present.filter(
    (row) => row.kind === 'gate' || row.criticality === CRITICAL || row.flagged
  );
}

/**
 * The register's grouping: the rows it was given (the whole set, or the
 * governing view of it) grouped by stage, stages in the order the rows run
 * (the baseline's own order), each group carrying its stage number, stage
 * name, and its rows in programme order. A stage whose every point the filter
 * dropped raises no group, so the register shows no empty stage. Returns
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

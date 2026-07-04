/**
 * The Programme milestone detail display model (Programme module Phase 3.8a).
 * The pure logic behind the milestone detail view and the mark action: the
 * detail's fields off the row the Schedule tab already built and the
 * met-points view, the write-permission gate, the met-date input values and
 * the light future-date guard, and the pure met-view updates the surface
 * falls back to after a successful write. The screen is a thin render over
 * this helper, the same seam trackingModel.js, overviewModel.js, and
 * scheduleModel.js hold, so correctness lives here, not in the component.
 *
 * Pure and deterministic: no DB, no React, no clock. Every function reads a
 * schedule row the surface already derived (scheduleRows joins the frozen
 * baseline, the forecast tree, and the RAG flags), the met-points view, or
 * plain inputs, and computes. Nothing here re-runs an engine, re-derives what
 * an engine computed, reads the system clock, or mutates what it is given.
 * Today is the surface's one clock read, made upstream on the page and handed
 * down; the future-date guard only compares against it.
 *
 * THE WRITE ITSELF IS NOT HERE. The component calls the Phase 3.3 store
 * directly (programmeActualsStore.js): markMilestoneMet, the atomic
 * mark-or-amend upsert, and unmarkMilestone, the plain delete. After a
 * successful write it refreshes the met-points view through the store's
 * loadMetPointsView and re-derives the three engines; viewWithMark and
 * viewWithoutMark are the exact-shape fallback should that refresh read fail,
 * so a successful write always moves the surface.
 *
 * THE PERMISSION GATE. writeControls presents the existing write boundary,
 * the same canEdit the page resolves once through resolveProjectAccess (the
 * boundary the 2.3 lock used); the actuals table's row-level security (the
 * migration 024 tenant rule) enforces the same boundary server-side. Gates
 * are never markable here whoever is looking: gate-met is owned by the
 * existing gate mechanic (gate_status on project_stage_gates), so a gate's
 * detail is read-only and this model never offers a gate a mark control.
 *
 * WHAT THIS MODEL DOES NOT DO. No store call and no network (the component
 * makes those, through the 3.3 store, adding no new store logic); no engine
 * re-derivation (the surface re-runs the engines off the refreshed view); no
 * gate marking; no new permission concept; no confirmation flow (the actions
 * are reversible, so correction is cheap by design).
 */

// One day in milliseconds, whole UTC days, the same convention as
// overviewModel's lookahead: the guard and the input values compare calendar
// days, not instants, matching the surface's UTC-pinned date discipline.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The date input's own value shape, a plain UTC calendar day.
const DAY_VALUE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The guard copy, stated once so the component and the tests read one
 * sentence. The future reason is the light guard the specification asks for:
 * a milestone cannot have been met in the future, so the recorded date is
 * today or earlier.
 */
export const FUTURE_MET_DATE_REASON =
  'A milestone cannot have been met in the future. Use today or an earlier date.';
export const INVALID_MET_DATE_REASON = 'Enter a valid date.';

// Soft parse to epoch milliseconds, or null. The rows carry Dates, the
// met-points view carries the store's date strings; this reads either.
// Mirrors trackingModel.softEpoch, overviewModel.softEpoch, and
// scheduleModel.softEpoch.
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

// An epoch's UTC calendar day, as the epoch of that day's UTC midnight. The
// same floor overviewModel's lookahead uses.
function utcDayFloor(epoch) {
  return Math.floor(epoch / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * The detail view's fields for one trackable point: the schedule row the tab
 * already built (identity and criticality off the frozen baseline, the met
 * flag and current date off the forecast tree, the flag off the RAG
 * derivation, the variance the row derived), joined with the met date off the
 * met-points view, the one fact the row does not carry. Everything passes
 * through; nothing is recomputed and nothing given is mutated.
 *
 * Returns a fresh object:
 *   {
 *     key, name, kind, stage, stageName, criticality,   off the row
 *     met,                     the forecast tree's read, as the row holds it
 *     metDate,                 the met-points view's date for a met point, as
 *                              a Date (a milestone's met_date, a gate's
 *                              passed_at), or null when unmet or unrecorded
 *     baselineDate,            the locked baseline date, passed through
 *     currentDate,             the forecast, or the actual once met, passed
 *                              through
 *     varianceWeeks, direction,  the row's display arithmetic, passed through
 *     flagged, flagColour,     the RAG contribution, passed through
 *   }
 * or null for a missing row. Accepts the view as a plain object or a Map,
 * exactly as the engines do.
 */
export function detailFields(row, metView) {
  if (row == null) return null;
  const record =
    metView instanceof Map ? metView.get(row.key) : metView?.[row.key];
  const met = row.met === true;
  const metEpoch = met ? softEpoch(record?.metDate) : null;
  return {
    key: row.key,
    name: row.name ?? null,
    kind: row.kind ?? null,
    stage: row.stage ?? null,
    stageName: row.stageName ?? null,
    criticality: row.criticality ?? null,
    met,
    metDate: metEpoch == null ? null : new Date(metEpoch),
    baselineDate: row.baselineDate ?? null,
    currentDate: row.currentDate ?? null,
    varianceWeeks: row.varianceWeeks ?? null,
    direction: row.direction ?? null,
    flagged: row.flagged === true,
    flagColour: row.flagColour ?? null,
  };
}

/**
 * The write-permission gate for a point's detail, the existing boundary and
 * nothing new: canWrite is the canEdit the page already resolved (the same
 * admin boundary the 2.3 lock used, enforced server-side by the actuals
 * table's row-level security), and canMark narrows it to milestones, because
 * gate-met is owned by the gate mechanic and a gate is never marked here. A
 * read-only member gets no write control of any kind.
 */
export function writeControls({ kind, canEdit } = {}) {
  const canWrite = canEdit === true;
  return {
    canWrite,
    canMark: canWrite && kind === 'milestone',
  };
}

/**
 * A value for the date input, the UTC calendar day of the given instant in
 * the input's own YYYY-MM-DD shape, or null where nothing parses. One
 * function serves the three uses: the default (today's UTC day, off the
 * today the page read once), the amend prefill (the met date), and the
 * input's max (today again, the light guard's visible edge).
 */
export function utcDayValue(value) {
  const epoch = softEpoch(value);
  if (epoch == null) return null;
  return new Date(utcDayFloor(epoch)).toISOString().slice(0, 10);
}

/**
 * The light future-date guard on a chosen met date. The value is the date
 * input's own YYYY-MM-DD; anything else, or a day that does not exist, is
 * invalid. A date after today's UTC calendar day is refused, because a
 * milestone cannot have been met in the future; today and any earlier date
 * pass, since the developer is recording when it actually happened. With no
 * parseable today the format still validates and the future check is skipped,
 * a guard staying light rather than blocking on a missing input.
 *
 * Returns { ok: true, metDate } with the validated YYYY-MM-DD string the
 * store takes verbatim, or { ok: false, reason } with the sentence to show.
 */
export function validateMetDate(value, todayIso) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!DAY_VALUE_RE.test(trimmed)) {
    return { ok: false, reason: INVALID_MET_DATE_REASON };
  }
  // A YYYY-MM-DD string parses as UTC midnight, the same day the input
  // named. A calendar-impossible day is refused: some engines roll one over
  // to the next month rather than failing, so the parse must round-trip back
  // to the named day.
  const epoch = Date.parse(trimmed);
  if (
    Number.isNaN(epoch) ||
    new Date(epoch).toISOString().slice(0, 10) !== trimmed
  ) {
    return { ok: false, reason: INVALID_MET_DATE_REASON };
  }
  const todayEpoch = softEpoch(todayIso);
  if (todayEpoch != null && epoch > utcDayFloor(todayEpoch)) {
    return { ok: false, reason: FUTURE_MET_DATE_REASON };
  }
  return { ok: true, metDate: trimmed };
}

/**
 * The met-points view with one milestone marked met on a date: a fresh view,
 * the given one untouched, the entry in the canonical contract shape
 * { met: true, metDate } the engines read and buildMetPointsView produces,
 * so the fallback and the refreshed read agree exactly. Used by the surface
 * only after markMilestoneMet succeeded and the refresh read failed; it is
 * never a substitute for the write.
 */
export function viewWithMark(view, key, metDate) {
  const next = { ...(view ?? {}) };
  if (key != null) {
    next[key] = { met: true, metDate: metDate ?? null };
  }
  return next;
}

/**
 * The met-points view with one milestone un-marked: a fresh view without the
 * point's entry, the given view untouched. A point absent from the view is
 * not met, exactly as the engines read it. The un-mark fallback twin of
 * viewWithMark.
 */
export function viewWithoutMark(view, key) {
  const next = { ...(view ?? {}) };
  if (key != null) {
    delete next[key];
  }
  return next;
}

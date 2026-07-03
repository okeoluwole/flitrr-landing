/**
 * The Programme tracking display model (Programme module Phase 3.5). The pure
 * logic behind the tracking surface's shell and its hero band: the five tile
 * values read off the three engines' outputs, the bounded tolerance mapping,
 * the colour key, and the routing decisions. The screen is a thin render over
 * this helper, so correctness lives here, not in the component.
 *
 * Pure and deterministic: no DB, no React, no clock. Every function reads the
 * frozen baseline's programme, the engine outputs (deriveProgress, deriveRAG,
 * deriveForecast), or plain inputs, and computes. Nothing here re-runs an
 * engine, reads the system clock, or mutates what it is given. Today and the
 * tolerance are the surface's inputs to the engines; this model only maps the
 * bounded tolerance setting to the weeks figure the RAG engine takes.
 *
 * THE DISPLAY-ROUNDING SEAM. The engines deliberately return exact, unrounded
 * figures (a percent like 33.333, a variance in fractional weeks). Rounding for
 * display happens here, at the surface, and only on the copy of the value this
 * model returns: the engine output object is never written to.
 *
 * WHAT THIS MODEL DOES NOT DO. No percent, colour, or forecast computation
 * (the engines own those rules); no persistence and no settings store (the
 * tolerance is session-only); no marking a milestone met (a later sub-step).
 */

// One week in milliseconds, whole seven-day spans, the same convention as the
// engines this model reads (programmeRAG.js, programmeForecast.js).
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// The criticality string a critical point carries on the assembled baseline.
// Gates carry no baked criticality: they are critical by their nature, exactly
// as the RAG engine treats them.
const CRITICAL = 'critical';

/**
 * The bounded tolerance settings, the sensitivity dial on the RAG derivation.
 * Three settings only, one step either side of the default, no free numeric
 * entry: Tight two weeks, Standard four (the specification's figure), Relaxed
 * six. First-draft figures awaiting validation, like the template durations.
 * Session-only: the surface starts at Standard on every visit and persists
 * nothing. Frozen so a caller cannot mutate the dial.
 */
export const TOLERANCE_SETTINGS = Object.freeze([
  Object.freeze({ key: 'tight', label: 'Tight', weeks: 2 }),
  Object.freeze({ key: 'standard', label: 'Standard', weeks: 4 }),
  Object.freeze({ key: 'relaxed', label: 'Relaxed', weeks: 6 }),
]);

// The setting every visit starts on.
export const DEFAULT_TOLERANCE_KEY = 'standard';

/**
 * The tolerance in weeks for a setting key, the figure the surface passes into
 * deriveRAG. An unknown key falls back to the default (Standard, four weeks),
 * so the RAG derivation always receives a valid tolerance.
 */
export function toleranceWeeksFor(key) {
  const setting =
    TOLERANCE_SETTINGS.find((s) => s.key === key) ??
    TOLERANCE_SETTINGS.find((s) => s.key === DEFAULT_TOLERANCE_KEY);
  return setting.weeks;
}

/**
 * The colour key, the small legend that keeps the status colour unambiguous.
 * One line per colour, drawn from the specification's RAG rule (Section 9) as
 * the observed-slip engine applies it. Frozen so a caller cannot mutate it.
 */
export const COLOUR_KEY = Object.freeze([
  Object.freeze({
    colour: 'green',
    label: 'Green',
    line: 'Every critical item is on baseline and no gate has passed unmet.',
  }),
  Object.freeze({
    colour: 'amber',
    label: 'Amber',
    line: 'A critical item is behind within the tolerance, or a standard item is behind.',
  }),
  Object.freeze({
    colour: 'red',
    label: 'Red',
    line: 'A critical item is behind beyond the tolerance, a gate has passed unmet, or a hard floor is breached.',
  }),
]);

// Soft parse to epoch milliseconds, or null. The frozen baseline carries its
// dates as ISO strings (the jsonb round trip), the engines return Dates; this
// reads either. Mirrors the engines' softEpoch.
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

/**
 * The Status tile: the overall RAG colour, colour only. No verdict word, no
 * percentage, no date; the colour key explains it. Null when there is no
 * status to show.
 */
export function statusTile(rag) {
  return { colour: rag?.status ?? null };
}

/**
 * The Complete tile: the programme percent from the percent engine, rounded
 * here for display (the engine deliberately does not round), with the points
 * working alongside (points met over points held, summed across the counted
 * activities of applicable stages). Percent is null where the engine had
 * nothing to average.
 */
export function completeTile(progress) {
  let metPoints = 0;
  let totalPoints = 0;
  for (const stage of progress?.stages ?? []) {
    if (stage?.applicable === false) continue;
    for (const activity of stage?.activities ?? []) {
      if (!activity?.counted) continue;
      metPoints += activity.metPoints ?? 0;
      totalPoints += activity.totalPoints ?? 0;
    }
  }
  const raw = progress?.percentComplete;
  const percent =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : null;
  return { percent, metPoints, totalPoints };
}

/**
 * The Slipping tile: the count of items behind baseline, read straight off the
 * RAG engine's flagged list, with the critical subset called out. The count is
 * the flagged list's length, nothing recomputed.
 */
export function slippingTile(rag) {
  const flagged = rag?.flagged ?? [];
  let criticalCount = 0;
  for (const item of flagged) {
    if (item?.criticality === CRITICAL) criticalCount += 1;
  }
  return { count: flagged.length, criticalCount };
}

// The forecast tree's node for every point, keyed by the point id, met flag
// and forecast date as the forecast engine rolled them. Not-applicable stages
// are out of the programme and contribute nothing.
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

/**
 * The Next critical milestone tile: the soonest unmet critical point by
 * forecast date. Critical milestones by their baked criticality, and every
 * gate, since gates are critical by nature. The name and stage come from the
 * frozen baseline's programme; met and the forecast date come from the
 * forecast engine's tree. On a tie the earlier point in programme order wins,
 * so the pick is deterministic.
 *
 * Returns { done: false, key, name, kind, stage, date } for the soonest unmet
 * critical point (date is the forecast engine's Date, passed through), or
 * { done: true } when nothing critical remains unmet: the honest done state,
 * never a blank.
 */
export function nextCriticalTile(programme, forecast) {
  const nodes = forecastNodesByKey(forecast);

  let best = null;
  const consider = (key, name, kind, stageNum) => {
    const node = nodes.get(key);
    if (node == null || node.met) return;
    const epoch = softEpoch(node.forecastDate);
    if (epoch == null) return;
    if (best == null || epoch < best.epoch) {
      best = { epoch, key, name: name ?? null, kind, stage: stageNum };
    }
  };

  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const stageNum = stage.stage ?? null;
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key == null) continue;
        if (milestone.criticality !== CRITICAL) continue;
        consider(milestone.key, milestone.name, 'milestone', stageNum);
      }
    }
    if (stage.gate?.key != null) {
      consider(stage.gate.key, stage.gate.name, 'gate', stageNum);
    }
  }

  if (best == null) return { done: true };
  return {
    done: false,
    key: best.key,
    name: best.name,
    kind: best.kind,
    stage: best.stage,
    date: new Date(best.epoch),
  };
}

// The latest baseline date across every applicable stage's trackable points,
// the baseline's own completion. Trackable means keyed, the same point set
// the forecast engine walks (a keyless point can never carry a forecast), so
// the variance's two sides always read the same points and an untrackable
// date can never open a phantom gap. The surface derives the variance, the
// engines carry the dates.
function baselineCompletionEpoch(programme) {
  let latest = null;
  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone?.key == null) continue;
        const epoch = softEpoch(milestone.baselineDate);
        if (epoch != null && (latest == null || epoch > latest)) latest = epoch;
      }
    }
    if (stage.gate?.key == null) continue;
    const gateEpoch = softEpoch(stage.gate.baselineDate);
    if (gateEpoch != null && (latest == null || gateEpoch > latest)) {
      latest = gateEpoch;
    }
  }
  return latest;
}

/**
 * The Forecast completion tile: the programme forecast completion from the
 * forecast engine, passed through, with the variance against the baseline's
 * own completion (the latest baseline date across applicable points) derived
 * here in exact weeks. It moves with the actuals because the engine's roll
 * does.
 *
 * Returns { date, baselineDate, varianceWeeks }: the forecast Date (or null),
 * the baseline completion as a Date (or null), and the exact signed variance
 * in weeks (null where either side is missing). Display rounding of the
 * variance is varianceLabel's.
 */
export function forecastCompletionTile(programme, forecast) {
  const date = forecast?.forecastCompletion ?? null;
  const forecastEpoch = softEpoch(date);
  const baselineEpoch = baselineCompletionEpoch(programme);
  const varianceWeeks =
    forecastEpoch != null && baselineEpoch != null
      ? (forecastEpoch - baselineEpoch) / MS_PER_WEEK
      : null;
  return {
    date,
    baselineDate: baselineEpoch == null ? null : new Date(baselineEpoch),
    varianceWeeks,
  };
}

/**
 * The variance line under the forecast tile, rounded here for display: 'on
 * baseline' within half a week either side, otherwise the signed whole-week
 * gap, later positive ('+3 wk vs baseline'), earlier negative ('-2 wk vs
 * baseline'). The half-week boundary rounds away from zero on both sides, so
 * a slip and a gain of the same size always read the same magnitude. Null
 * where there is no variance to state.
 */
export function varianceLabel(varianceWeeks) {
  if (typeof varianceWeeks !== 'number' || !Number.isFinite(varianceWeeks)) {
    return null;
  }
  const magnitude = Math.round(Math.abs(varianceWeeks));
  if (magnitude === 0) return 'on baseline';
  if (varianceWeeks > 0) return `+${magnitude} wk vs baseline`;
  return `-${magnitude} wk vs baseline`;
}

/**
 * The band's eyebrow: the module name and the stage position, in the
 * specification's own form, 'Programme summary, Stage 3 of 8'. Falls back to
 * the bare module name when the stage is not a number.
 */
export function bandPosition(currentStage) {
  if (typeof currentStage === 'number' && Number.isInteger(currentStage)) {
    return `Programme summary, Stage ${currentStage} of 8`;
  }
  return 'Programme summary';
}

/**
 * The tracking page's routing decision: the page renders tracking only for a
 * baseline row carrying its frozen programme. With no baseline the page points
 * the developer to set-up rather than rendering an empty band.
 */
export function trackingReady(baselineRow) {
  return (
    baselineRow != null &&
    baselineRow.programme != null &&
    typeof baselineRow.programme === 'object'
  );
}

/**
 * The workspace Programme tile's routing by state:
 *   - no locked Brief: the tile stays locked, the existing not-ready behaviour;
 *   - Brief locked, no baseline: the tile opens set-up, as it did before;
 *   - baseline locked: the tile opens the tracking page, the module's home.
 *
 * Returns { state, href, footer } in the tile's own vocabulary ('open' or
 * 'locked').
 */
export function programmeTileTarget(projectId, { briefLocked, hasBaseline }) {
  const setupHref = `/pulse/app/programme/setup?project=${projectId}`;
  if (!briefLocked) {
    return {
      state: 'locked',
      href: setupHref,
      footer: 'Programme set-up opens once you lock the Brief.',
    };
  }
  if (!hasBaseline) {
    return {
      state: 'open',
      href: setupHref,
      footer: 'Set up the operational baseline.',
    };
  }
  return {
    state: 'open',
    href: `/pulse/app/programme?project=${projectId}`,
    footer: 'Track delivery against the locked baseline.',
  };
}

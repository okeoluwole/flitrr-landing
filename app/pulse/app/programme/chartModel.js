/**
 * The Programme chart view-model (Note 17, finding 4). The pure logic behind
 * the Schedule tab's one programme chart: a left gutter of stages, a labelled
 * bar per stage for its baseline extent, a quarter grid, one today line, and
 * the gate and milestone markers placed on time. The drawing is a thin render
 * over this helper, the same seam scheduleModel.js holds for the register and
 * trackingModel.js holds for the band, so correctness lives here and the SVG
 * holds no arithmetic of its own.
 *
 * Pure, deterministic and server-safe: no DB, no React, no DOM, no clock. It
 * reads the frozen baseline's programme, the row set scheduleModel already
 * built (identity and baseline date off the frozen baseline, current date off
 * the forecast tree, flag off the RAG derivation, variance the display
 * subtraction of the two dates), the stage states, and today as the page read
 * it once upstream. It invents nothing: every position on the chart is a
 * function of records the tracker table already reads. Nothing given is
 * mutated; every element is a fresh object.
 *
 * WHERE A STAGE BAR COMES FROM. The old timeline drew a stage's extent from
 * the spread of its own dated points, so a stage whose only dated point was
 * its gate collapsed to nothing and a stage of undated points floated free.
 * The bar is a stage window, not a spread of markers, so this model takes the
 * window from the stage-state engine (lib/engine/stageStates.js) over the
 * baseline's own gate dates:
 *   - a sequential stage opens at the previous applicable stage's gate, and
 *     the first applicable stage opens at the project start;
 *   - a concurrent stage opens at its declared window anchor's gate, which for
 *     Sales and Disposal is the stage 3 gate, sales launch, so an off-plan or
 *     Nigeria scheme draws stage 7 as its own track across the build rather
 *     than as a sliver after handover;
 *   - a complete stage has no lower bound, so it opens at the project start.
 * Concurrency is never a manual flag on the chart. It is read from the
 * baseline through deriveStageStates, exactly as set-up and the wizard read
 * it, so the drawing and the dates agree by construction.
 *
 * Every bar is guarded against collapsing: where the derived opening is not
 * strictly before the stage's gate, the frozen stage start and then the
 * earliest of the stage's own baseline dates are tried in turn, and the bar is
 * drawn only from an opening that genuinely precedes the close. A stage with
 * an end and no honest opening draws its gate and no bar, rather than a
 * zero-width mark pretending to be a stage.
 *
 * HOW A POINT IS PAIRED. Each point holds two positions, its locked baseline
 * date and its current date (the rolling forecast, or the actual once met).
 * A milestone draws both, the solid marker at the baseline and the open marker
 * at the current position, joined by a drift bar carrying the slip in weeks.
 * A gate draws one diamond only, at the stage end: a slipped gate reads
 * through a faint forecast extension on its own stage bar, never as a second
 * diamond competing with the first for the same meaning.
 *
 * WHAT THIS MODEL DOES NOT DO. No engine work: it never re-runs the forecast,
 * the RAG derivation or the progress roll, never re-derives criticality, and
 * never reads the clock. No status ladder: the completion block states the
 * variance as a programme fact in the tracker's existing variance language,
 * and the objective status ladder is a later step. No writes of any kind: the
 * chart is a read.
 */

import {
  isComplete,
  isConcurrent,
  stageStateFor,
  stageStateLookup,
} from '../../../../lib/engine/stageStates.js';
import { varianceLabel } from './trackingModel';

// One week in milliseconds, whole seven-day spans, the same convention as the
// engines this model reads and as scheduleModel.js and trackingModel.js.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// The most quarter labels the grid carries before it thins. Past this a long
// programme labels its first quarter of each year only, so the axis stays
// readable; every gridline is still drawn, so no boundary is hidden.
const MAX_QUARTER_LABELS = 16;

// Soft parse to epoch milliseconds, or null. The frozen baseline carries its
// dates as ISO strings (the jsonb round trip), the engines return Dates; this
// reads either. Mirrors scheduleModel.softEpoch and trackingModel.softEpoch.
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
 * The compact slip a drift bar carries, the tracker's variance language
 * shortened to fit beside a marker: '+3 wk' later than baseline, '-2 wk'
 * earlier, and null within half a week either side, where the point reads as
 * on baseline and the drift is not worth annotating. The half-week boundary
 * and the sign convention are trackingModel.varianceLabel's, so a figure on
 * the chart and the same figure in the register never disagree.
 */
export function slipText(varianceWeeks) {
  if (typeof varianceWeeks !== 'number' || !Number.isFinite(varianceWeeks)) {
    return null;
  }
  const magnitude = Math.round(Math.abs(varianceWeeks));
  if (magnitude === 0) return null;
  return varianceWeeks > 0 ? `+${magnitude} wk` : `-${magnitude} wk`;
}

// The rows of one stage, keyed by stage number, in the order they were given
// (programme order, as scheduleModel emits them).
function rowsByStage(rows) {
  const byStage = new Map();
  for (const row of rows ?? []) {
    if (row == null) continue;
    const list = byStage.get(row.stage);
    if (list == null) byStage.set(row.stage, [row]);
    else list.push(row);
  }
  return byStage;
}

// The earliest baseline epoch among a stage's own points, or null. The last
// fallback for a stage opening: not a window, but an honest lower bound drawn
// from the stage's own dates.
function earliestBaselineEpoch(stageRows) {
  let earliest = null;
  for (const row of stageRows ?? []) {
    const epoch = softEpoch(row?.baselineDate);
    if (epoch != null && (earliest == null || epoch < earliest)) earliest = epoch;
  }
  return earliest;
}

/**
 * The UTC quarter bands covering a domain, one per calendar quarter the domain
 * touches, earliest first. Each band carries the epochs of its own boundaries
 * (not clamped, so the caller can clamp against the domain itself) with the
 * year and the quarter number. Pure calendar arithmetic.
 */
function quarterBands(startEpoch, endEpoch) {
  if (startEpoch == null || endEpoch == null || endEpoch < startEpoch) return [];
  const first = new Date(startEpoch);
  let year = first.getUTCFullYear();
  let quarter = Math.floor(first.getUTCMonth() / 3);
  const bands = [];
  let cursor = Date.UTC(year, quarter * 3, 1);
  // A degenerate domain (everything on one instant) still names the quarter it
  // sits in, so the grid is never empty where there is something to place.
  while (cursor < endEpoch || bands.length === 0) {
    const nextYear = quarter === 3 ? year + 1 : year;
    const nextQuarter = quarter === 3 ? 0 : quarter + 1;
    const nextEpoch = Date.UTC(nextYear, nextQuarter * 3, 1);
    bands.push({
      startEpoch: cursor,
      endEpoch: nextEpoch,
      year,
      quarter: quarter + 1,
    });
    cursor = nextEpoch;
    year = nextYear;
    quarter = nextQuarter;
  }
  return bands;
}

// The spoken form of one chart point, the same facts its register row carries,
// so the drawing is never the only carrier of them.
function pointLabel(row, formatted) {
  const baseline = formatted.baseline ?? 'not dated';
  const current = formatted.current ?? 'not dated';
  const slip = slipText(row.varianceWeeks);
  return (
    `${row.name ?? row.key}: ${row.kind}, ${row.criticality}` +
    `${row.met ? ', met' : ''}. Baseline ${baseline}, current ${current}` +
    `${slip ? `, ${slip}` : ', on baseline'}.`
  );
}

// An ISO day (YYYY-MM-DD) for a spoken label, UTC-pinned like every date the
// surface states, so the sentence and the marker name the same calendar day.
function isoDay(epoch) {
  if (epoch == null) return null;
  return new Date(epoch).toISOString().slice(0, 10);
}

/**
 * The programme chart view-model.
 *
 * programme  the frozen baseline's programme (assembleProgramme's output after
 *            its jsonb round trip): stages in baseline order, each with its
 *            stage number, name, applicable flag, stageStart, and gate.
 * rows       the row set scheduleModel.scheduleRows already built, one per
 *            trackable point, joining the frozen baseline, the forecast tree
 *            and the RAG flags. The chart adds no point of its own.
 * options
 *   today               the today the page read once, handed down. Placed on
 *                       the axis; never read from the clock here.
 *   stageStates         the stage states (deriveStageStates' output, or a
 *                       per-stage array). Omitted, every stage reads as
 *                       sequential, exactly as the strict model always did.
 *   forecastCompletion  the forecast engine's programme finish, passed through
 *                       for the summary caption.
 *
 * Returns:
 *   {
 *     hasDomain,         false when nothing is dated, so the caller can say so
 *     start, end,        the domain as Dates, or null
 *     todayFrac,         today's place on the axis, or null
 *     quarters: [        the quarter grid, earliest first
 *       {
 *         label,         'Q1 26'
 *         year, quarter,
 *         startFrac, endFrac, midFrac,   clamped into the domain
 *         gridline,      true where the band opens on a real boundary inside
 *                        the domain, false for the leading band
 *         labelled,      false where a long programme has thinned the labels
 *       }
 *     ],
 *     tracks: [          one per applicable stage, in the baseline's own order
 *       {
 *         stage, stageName,
 *         concurrent,        true where the stage overlaps what it runs beside
 *         complete,          true where the stage finished before PULSE
 *         anchorLabel,       'sales launch' for a concurrent stage, else null
 *         startFrac, endFrac,        the baseline extent, or null with no
 *                            honest opening or no dated gate
 *         extentWeeks,       the bar's own length in whole weeks, the label it
 *                            carries, or null where it draws no bar
 *         forecastEndFrac,   the forecast extension's end where the stage's
 *                            gate is forecast later than its baseline, else
 *                            null. The extension carries a slipped gate; no
 *                            second diamond competes with the first.
 *         gateSlipWeeks, gateSlipLabel,   the gate's slip, for the extension
 *         points: [
 *           {
 *             ...the register row's own fields, copied not referenced,
 *             baselineFrac, currentFrac,      null where the date is missing
 *             showCurrent,   true where an open current marker is drawn: a
 *                            milestone whose current position differs from its
 *                            baseline. A gate never pairs.
 *             drift: { fromFrac, toFrac } | null,
 *             slipWeeks,     whole signed weeks, or null
 *             slipLabel,     '+3 wk' | '-2 wk' | null
 *             label,         the spoken sentence
 *           }
 *         ]
 *       }
 *     ],
 *     completion: {
 *       forecastDate,   the forecast engine's finish, or null
 *       targetDate,     the baseline's own completion, the latest applicable
 *                       gate's baseline date, or null
 *       varianceWeeks,  exact signed weeks, or null
 *       varianceLabel,  the tracker's own phrase ('on baseline', '+5 wk vs
 *                       baseline'), or null
 *     }
 *   }
 */
export function programmeChart(programme, rows, options) {
  const todayEpoch = softEpoch(options?.today);
  const stateByStage = stageStateLookup(options?.stageStates);
  const forecastCompletionEpoch = softEpoch(options?.forecastCompletion);
  const projectStartEpoch = softEpoch(programme?.projectStart);
  const byStage = rowsByStage(rows);

  // Pass one: the applicable stages with their gate positions, and the running
  // chain of previous gates a sequential opening reads from. The gate's dates
  // come from its own row where the row set holds one (it carries the current
  // date too) and from the frozen stage otherwise.
  const stages = [];
  const gateBaselineByStage = new Map();
  for (const stage of programme?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const stageNum = stage.stage ?? null;
    const stageRows = byStage.get(stageNum) ?? [];
    const gateRow = stageRows.find((row) => row.kind === 'gate') ?? null;
    const gateBaselineEpoch =
      softEpoch(gateRow?.baselineDate) ?? softEpoch(stage.gate?.baselineDate);
    const gateCurrentEpoch = softEpoch(gateRow?.currentDate);
    if (gateBaselineEpoch != null) {
      gateBaselineByStage.set(stageNum, gateBaselineEpoch);
    }
    stages.push({
      stage: stageNum,
      stageName: stage.name ?? null,
      state: stageStateFor(stateByStage, stageNum),
      frozenStartEpoch: softEpoch(stage.stageStart),
      gateBaselineEpoch,
      gateCurrentEpoch,
      gateRow,
      rows: stageRows,
    });
  }

  // Pass two: the window each stage opens at. The previous applicable gate is
  // the sequential anchor; a concurrent stage takes its declared anchor's gate
  // instead and does not advance the sequential chain, matching the rolling
  // chain the baseline itself was assembled on.
  let previousGateEpoch = projectStartEpoch;
  for (const entry of stages) {
    const concurrent = isConcurrent(entry.state);
    const complete = isComplete(entry.state);

    let openingEpoch;
    if (concurrent) {
      const anchorStage = entry.state?.windowAnchor?.stage ?? null;
      openingEpoch = gateBaselineByStage.get(anchorStage) ?? null;
    } else if (complete) {
      openingEpoch = projectStartEpoch;
    } else {
      openingEpoch = previousGateEpoch;
    }

    // The guard against a collapsed bar: try the derived opening, then the
    // frozen stage start, then the earliest of the stage's own baseline dates,
    // and keep the earliest candidate that genuinely precedes the close.
    const candidates = [
      openingEpoch,
      entry.frozenStartEpoch,
      earliestBaselineEpoch(entry.rows),
    ].filter((epoch) => epoch != null);
    let startEpoch = candidates.length > 0 ? candidates[0] : null;
    if (
      entry.gateBaselineEpoch != null &&
      startEpoch != null &&
      startEpoch >= entry.gateBaselineEpoch
    ) {
      const earlier = candidates.filter(
        (epoch) => epoch < entry.gateBaselineEpoch
      );
      startEpoch = earlier.length > 0 ? Math.min(...earlier) : null;
    }

    entry.concurrent = concurrent;
    entry.complete = complete;
    entry.anchorLabel = concurrent
      ? (entry.state?.windowAnchorLabel ?? null)
      : null;
    entry.startEpoch = startEpoch;
    entry.forecastEndEpoch =
      entry.gateBaselineEpoch != null &&
      entry.gateCurrentEpoch != null &&
      entry.gateCurrentEpoch > entry.gateBaselineEpoch
        ? entry.gateCurrentEpoch
        : null;

    if (!concurrent && entry.gateBaselineEpoch != null) {
      previousGateEpoch = entry.gateBaselineEpoch;
    }
  }

  // The domain: the earliest and latest of everything the chart places. No
  // padding and no rounding out to a calendar boundary, so a position is
  // exactly where its date puts it.
  let domainStart = null;
  let domainEnd = null;
  const widen = (epoch) => {
    if (epoch == null) return;
    if (domainStart == null || epoch < domainStart) domainStart = epoch;
    if (domainEnd == null || epoch > domainEnd) domainEnd = epoch;
  };
  for (const entry of stages) {
    widen(entry.startEpoch);
    widen(entry.gateBaselineEpoch);
    widen(entry.forecastEndEpoch);
  }
  for (const row of rows ?? []) {
    if (row == null) continue;
    widen(softEpoch(row.baselineDate));
    widen(softEpoch(row.currentDate));
  }
  widen(forecastCompletionEpoch);
  const hasDomain = domainStart != null;
  if (hasDomain) widen(todayEpoch);

  const span = hasDomain ? domainEnd - domainStart : null;
  const frac = (epoch) => {
    if (epoch == null || !hasDomain) return null;
    if (span === 0) return 0.5;
    return (epoch - domainStart) / span;
  };
  const clampedFrac = (epoch) => {
    const value = frac(epoch);
    if (value == null) return null;
    return Math.min(1, Math.max(0, value));
  };

  // The quarter grid over the domain, clamped into it. The leading band opens
  // on the domain edge rather than on a boundary inside it, so it draws no
  // gridline; a long programme labels its first quarter of each year only.
  const bands = hasDomain ? quarterBands(domainStart, domainEnd) : [];
  const thinned = bands.length > MAX_QUARTER_LABELS;
  const quarters = bands.map((band) => {
    const startFrac = clampedFrac(band.startEpoch);
    const endFrac = clampedFrac(band.endEpoch);
    return {
      label: `Q${band.quarter} ${String(band.year).slice(2)}`,
      year: band.year,
      quarter: band.quarter,
      startFrac,
      endFrac,
      midFrac:
        startFrac == null || endFrac == null ? null : (startFrac + endFrac) / 2,
      gridline: band.startEpoch > domainStart,
      labelled: !thinned || band.quarter === 1,
    };
  });

  const tracks = stages.map((entry) => {
    const startFrac = frac(entry.startEpoch);
    const endFrac = frac(entry.gateBaselineEpoch);
    const gateSlipWeeks =
      entry.gateBaselineEpoch != null && entry.gateCurrentEpoch != null
        ? Math.round(
            (entry.gateCurrentEpoch - entry.gateBaselineEpoch) / MS_PER_WEEK
          )
        : null;

    const points = entry.rows.map((row) => {
      const baselineEpoch = softEpoch(row.baselineDate);
      const currentEpoch = softEpoch(row.currentDate);
      const baselineFrac = frac(baselineEpoch);
      const currentFrac = frac(currentEpoch);
      // A gate never pairs: its slip reads through the stage bar's forecast
      // extension, so a second diamond would state the same thing twice.
      const showCurrent =
        row.kind !== 'gate' &&
        currentFrac != null &&
        (baselineFrac == null || currentFrac !== baselineFrac);
      const slipWeeks =
        typeof row.varianceWeeks === 'number' &&
        Number.isFinite(row.varianceWeeks)
          ? Math.round(row.varianceWeeks)
          : null;
      return {
        key: row.key,
        name: row.name ?? null,
        kind: row.kind,
        criticality: row.criticality,
        stage: row.stage,
        met: row.met === true,
        flagged: row.flagged === true,
        flagColour: row.flagColour ?? null,
        direction: row.direction ?? null,
        varianceWeeks: row.varianceWeeks ?? null,
        baselineDate: baselineEpoch == null ? null : new Date(baselineEpoch),
        currentDate: currentEpoch == null ? null : new Date(currentEpoch),
        baselineFrac,
        currentFrac,
        showCurrent,
        drift:
          showCurrent && baselineFrac != null
            ? {
                fromFrac: Math.min(baselineFrac, currentFrac),
                toFrac: Math.max(baselineFrac, currentFrac),
              }
            : null,
        slipWeeks,
        slipLabel: slipText(row.varianceWeeks),
        label: pointLabel(row, {
          baseline: isoDay(baselineEpoch),
          current: isoDay(currentEpoch),
        }),
      };
    });

    return {
      stage: entry.stage,
      stageName: entry.stageName,
      concurrent: entry.concurrent === true,
      complete: entry.complete === true,
      anchorLabel: entry.anchorLabel ?? null,
      startFrac,
      endFrac,
      extentWeeks:
        entry.startEpoch != null && entry.gateBaselineEpoch != null
          ? Math.round((entry.gateBaselineEpoch - entry.startEpoch) / MS_PER_WEEK)
          : null,
      forecastEndFrac: frac(entry.forecastEndEpoch),
      gateSlipWeeks,
      gateSlipLabel: slipText(
        entry.gateBaselineEpoch != null && entry.gateCurrentEpoch != null
          ? (entry.gateCurrentEpoch - entry.gateBaselineEpoch) / MS_PER_WEEK
          : null
      ),
      points,
    };
  });

  // The baseline's own completion: the latest applicable gate's baseline date,
  // the same rule trackingModel reads for the band's variance, so the caption
  // and the tile never disagree. Gate against gate on both sides: a milestone
  // hanging past its gate is never the completion.
  let targetEpoch = null;
  for (const entry of stages) {
    if (
      entry.gateBaselineEpoch != null &&
      (targetEpoch == null || entry.gateBaselineEpoch > targetEpoch)
    ) {
      targetEpoch = entry.gateBaselineEpoch;
    }
  }
  const completionVarianceWeeks =
    forecastCompletionEpoch != null && targetEpoch != null
      ? (forecastCompletionEpoch - targetEpoch) / MS_PER_WEEK
      : null;

  return {
    hasDomain,
    start: hasDomain ? new Date(domainStart) : null,
    end: hasDomain ? new Date(domainEnd) : null,
    todayFrac: hasDomain ? frac(todayEpoch) : null,
    quarters,
    tracks,
    completion: {
      forecastDate:
        forecastCompletionEpoch == null
          ? null
          : new Date(forecastCompletionEpoch),
      targetDate: targetEpoch == null ? null : new Date(targetEpoch),
      varianceWeeks: completionVarianceWeeks,
      varianceLabel: varianceLabel(completionVarianceWeeks),
    },
  };
}

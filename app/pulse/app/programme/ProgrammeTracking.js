'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/client';
import { deriveProgress } from '../../../../lib/engine/programmeProgress.js';
import { deriveRAG } from '../../../../lib/engine/programmeRAG.js';
import { deriveForecast } from '../../../../lib/engine/programmeForecast.js';
import {
  loadMetPointsView,
  markMilestoneMet,
  unmarkMilestone,
} from '../components/programmeActualsStore';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import {
  TOLERANCE_SETTINGS,
  DEFAULT_TOLERANCE_KEY,
  toleranceWeeksFor,
  COLOUR_KEY,
  statusTile,
  completeTile,
  slippingTile,
  nextCriticalTile,
  forecastCompletionTile,
  varianceLabel,
  bandPosition,
} from './trackingModel';
import {
  GATE_DIRECTIONS,
  nextGateCard,
  directionLabel,
  gateReviewHref,
  needsAttention,
  attentionReason,
  behindLabel,
  nextThirtyDays,
  fastMarkAction,
} from './overviewModel';
import {
  VARIANCE_DIRECTIONS,
  REGISTER_FILTERS,
  DEFAULT_REGISTER_FILTER,
  scheduleRows,
  filterRows,
  registerGroups,
  varianceText,
} from './scheduleModel';
import { programmeChart } from './chartModel';
import {
  detailFields,
  writeControls,
  utcDayValue,
  validateMetDate,
  viewWithMark,
  viewWithoutMark,
} from './detailModel';
import styles from './ProgrammeTracking.module.css';

/**
 * ProgrammeTracking - the tracking surface shell, its hero band (Programme
 * module Phase 3.5), the Overview tab's content (Phase 3.6), the Schedule
 * tab's content (Phase 3.7, restructured for Note 17), the milestone detail
 * with the mark action (Phase 3.8a), and the fast mark on Next 30 days (Phase
 * 3.8b). The daily face of the module: the pinned summary band with its five
 * co-equal tiles, the status key, the bounded tolerance dial, the Overview tab
 * (the Next Gate card, the Needs attention list, and the Next 30 days
 * lookahead), the Schedule tab (one programme chart and one register), and,
 * opened by tapping a Schedule or Next 30 days row, the point detail, the
 * considered home for the surface's one write.
 *
 * THE SCHEDULE TAB (Note 17, findings 3 and 4). One register and one chart,
 * two readings of the same row set, never two tables of the same columns.
 *   - The register is grouped by stage and filtered, not duplicated: Critical
 *     and gates is the governing view (every gate, every critical milestone,
 *     and anything flagged at the current tolerance), All points is the whole
 *     locked programme. Criticality is the derived value already on each row,
 *     read from the objective the point serves, so the toggle chooses a view
 *     and never classifies anything.
 *   - The chart is a thin SVG render over the pure chartModel view-model:
 *     stage bars for the baseline extent, a quarter grid, one today line, gate
 *     diamonds and milestone circles, and each point paired solid at its
 *     baseline to open at its current position across a drift bar. It holds no
 *     arithmetic of its own; every position is a fraction the model computed.
 *   - Mobile leads with the register, the legible form; the chart follows in a
 *     scrollable frame. From 1024px the chart takes the lead and the register
 *     sits beneath it. The register keeps its place in the document either
 *     way, so the interactive rows stay first in reading and tab order.
 *
 * The page (server) has loaded the frozen v1 programme and the met-points
 * view, read the clock once, and passed everything down as plain data. This
 * client runs the three engines over those inputs (percent from
 * deriveProgress, colour and flagged list from deriveRAG, forecast dates from
 * deriveForecast) and renders the tile values the display model derives from
 * their outputs. Nothing about a figure, colour, or date is invented at
 * render time.
 *
 * THE ONE WRITE (3.8a). The met-points view is held as state so it can move.
 * In a milestone's detail a writer marks it met on a date (defaulting to
 * today, editable to an earlier date, lightly guarded against a future one),
 * amends that date, or un-marks it, calling the Phase 3.3 store directly:
 * the mark-or-amend upsert and the un-mark delete, no new store logic. After
 * a successful write the view is re-read through loadMetPointsView and the
 * engines re-derive, so the band's percent, colour, and forecast and both
 * tabs' contents move without a full page reload; should that refresh read
 * fail, the pure fallback applies the confirmed write locally, so a
 * successful write always moves the surface. The listing surfaces stay
 * read-only: opening a detail is navigation, not editing the table, so no
 * inline mark control sits on the Schedule rows. Gate-met is owned by the
 * existing gate mechanic, so a gate's detail shows its met state and offers
 * no mark control. Write controls appear only for a writer, the canEdit the
 * page resolved once (the same boundary the 2.3 lock used, enforced
 * server-side by the actuals table's row-level security); a read-only member
 * sees the detail with no write controls. No confirmation dialogs: the
 * actions are reversible, so correction is cheap. Forecast editing is a
 * later sub-step.
 *
 * THE FAST LANE (3.8b). Next 30 days is the common case's shortest path:
 * each unmet milestone row there carries Met today for a writer, one tap
 * marking it met on today's UTC day through the exact same handleMark the
 * detail's form submits to, the one write path with two entry points, never
 * a second mark implementation. The same refresh and re-derive follow, so
 * the band's percent, colour, and forecast and both tabs move, and the
 * now-met point drops out of the unmet lookahead by construction. The row
 * itself opens the same point detail the Schedule rows open (a different
 * met date, an amendment, or an un-mark lives there, never in the fast
 * lane); a gate row carries no fast affordance, gate-met being the gate
 * mechanic's; and the affordance follows the same writeControls gate as
 * 3.8a, so a read-only member sees no fast control on any row. A quiet note
 * confirms what landed; nothing blocks.
 *
 * The tolerance dial is session-only state. Changing it re-runs the RAG
 * derivation with the new tolerance, so the Status colour, the Slipping
 * count, the flagged list, the Needs attention block, and the Schedule's
 * flagged rows respond immediately; the percent and the forecast never read
 * it.
 *
 * The Overview and Schedule tabs read the engine outputs this component
 * already computed through the pure overviewModel, scheduleModel, and
 * detailModel helpers: no new load beyond the post-write refresh, no
 * re-derivation, and no second reading of the clock.
 */

// The two tabs. Both carry their content now: the Overview (3.6) and the
// Schedule (3.7).
const TABS = Object.freeze([
  Object.freeze({ key: 'overview', label: 'Overview' }),
  Object.freeze({ key: 'schedule', label: 'Schedule' }),
]);

/* ── The chart's geometry, in its own coordinate space. The SVG is drawn at
      these figures and scrolls inside its frame where it does not fit, so
      nothing is scaled and no text ever shrinks below its set size. Every
      position along the axis is a fraction the view-model computed; these
      constants only turn a fraction into a coordinate. ── */
const CHART = Object.freeze({
  gutter: 200, // the left column naming each stage, wide enough for the
  // longest stage name in the template on one line
  padRight: 22,
  axis: 34, // the quarter labels and the today mark sit above the tracks
  row: 52, // one stage track
  bottom: 10,
  minWidth: 780,
  quarterWidth: 94,
  centre: 32, // the track centreline, from the top of its row
  barHeight: 12,
  driftHeight: 3,
});

// The engine's status bands render in the workspace ladder, never as traffic
// lights: amber is criticality only, and only the red band (a gate overdue, a
// critical point beyond tolerance, a floor breach) can earn it, because only
// a critical point or a gate can reach that band. One word and one mark class
// per band, keyed by the engine's own colour value; the engine and its
// vocabulary stay untouched.
const STATUS_WORDS = {
  green: 'On course',
  amber: 'Slipping',
  red: 'Critical slip',
};

const STATUS_CLASS = {
  green: 'stOn',
  amber: 'stSlip',
  red: 'stCrit',
};

// The spoken or written form of a band, lowercase mid-sentence.
function statusPhrase(colour) {
  const word = STATUS_WORDS[colour];
  return word ? word.toLowerCase() : null;
}

// The write failure sentences, the app's plain register. The future-date
// guard's own sentence comes from detailModel, stated once there.
const MARK_ERROR =
  'We could not save that mark. Please check your connection and try again.';
const UNMARK_ERROR =
  'We could not remove that mark. Please check your connection and try again.';

// A compact date for a tile value, two-digit year so a date years out still
// reads at a glance. Pinned to UTC: the engines' dates are UTC-midnight
// instants, so rendering in the viewer's zone would show the previous day
// west of Greenwich and split the server-rendered HTML from the client. The
// tile shows the engine's own calendar day, everywhere.
function formatShort(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

// A longer stamp for the baseline chip (a DB timestamp or ISO string). UTC
// for the same reason as formatShort.
function formatStamp(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// The status mark, one silhouette per band, named for assistive tech by the
// band's word. Where the adjacent text already carries the word (the status
// key, the Status tile, the detail's flag line) the mark is decorative and
// stays silent. A flagged item's mark names the band it contributes instead
// of the overall status.
function RagDot({ colour, large, decorative, label }) {
  const bandClass = STATUS_CLASS[colour];
  const classes = [
    styles.stDot,
    large ? styles.stDotLarge : '',
    bandClass ? styles[bandClass] : styles.stUnknown,
  ]
    .filter(Boolean)
    .join(' ');
  if (decorative) {
    return <span className={classes} aria-hidden="true" />;
  }
  return (
    <span
      className={classes}
      role="img"
      aria-label={
        label ??
        (STATUS_WORDS[colour]
          ? `Status: ${statusPhrase(colour)}`
          : 'Status unavailable')
      }
    />
  );
}

// One band tile: a label, a value, and a quiet sub-line. The five are
// co-equal; none renders larger than the others.
function Tile({ label, children, sub, subSignal }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{children}</span>
      {sub != null && (
        <span
          className={`${styles.tileSub} ${subSignal ? styles.tileSubSignal : ''}`}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

/* ── The Schedule tab's pieces (Phase 3.7): the four-column point rows the
      high-level breakdown and the Register share, and the Timeline plot.
      All thin renders over the pure schedule model; nothing here derives. ── */

// The variance figure's tone. A flagged row carries its band (the amber
// critical-slip read, or the watch band's bright monochrome); an unflagged
// row reads by its direction, ahead in the success green, behind in plain
// secondary ink (the knock-on case: pushed by upstream drift but not itself
// past its date, so the RAG derivation honestly has not flagged it), on
// baseline quietly.
function varianceToneClass(row) {
  if (row.flagged) {
    return row.flagColour === 'red' ? styles.varCrit : styles.varSlip;
  }
  if (row.direction === VARIANCE_DIRECTIONS.AHEAD) return styles.varAhead;
  if (row.direction === VARIANCE_DIRECTIONS.BEHIND) return styles.varBehind;
  return styles.varQuiet;
}

// The four column headings, once above each table. Presentation only: every
// cell carries its own label for assistive tech (visible at phone width,
// visually hidden from 768px), so the header row is decorative.
function PointsHeader() {
  return (
    <div className={styles.pointsHeader} aria-hidden="true">
      <span>Item</span>
      <span>Baseline</span>
      <span>Current</span>
      <span>Variance</span>
    </div>
  );
}

// One point row, the four columns over one row of the schedule model: Item
// off the frozen baseline, Baseline and Current as the UTC-pinned dates the
// row holds, Variance as the display subtraction with its direction plain.
// A flagged row carries the RAG dot naming the colour it contributes. The
// row is a disclosure button (3.8a): tapping it opens the point's detail
// beneath it, navigation rather than editing, so the table itself stays
// read-only and carries no inline mark control.
function PointRow({ row, open, detailId, onToggle }) {
  return (
    <li className={`${styles.pointRow} ${row.met ? styles.pointRowMet : ''}`}>
      <button
        type="button"
        className={styles.pointRowBtn}
        aria-expanded={open}
        aria-controls={open ? detailId : undefined}
        onClick={onToggle}
      >
        <span className={styles.pointItem}>
          <span className={styles.pointName}>{row.name ?? row.key}</span>
          <span className={styles.pointMetaLine}>
            {row.kind}
            {row.stage != null ? ` · stage ${row.stage}` : ''}
            {` · ${row.criticality}`}
            {row.met ? ' · met' : ''}
          </span>
        </span>
        <span className={styles.pointCell}>
          <span className={styles.pointCellLabel}>Baseline</span>
          <span className={`${styles.pointDate} tnum`}>
            {formatShort(row.baselineDate) ?? 'not dated'}
          </span>
        </span>
        <span className={styles.pointCell}>
          <span className={styles.pointCellLabel}>Current</span>
          <span
            className={`${styles.pointDate} ${
              row.met ? styles.pointDateMet : ''
            } tnum`}
          >
            {formatShort(row.currentDate) ?? 'not dated'}
          </span>
        </span>
        <span className={styles.pointCell}>
          <span className={styles.pointCellLabel}>Variance</span>
          <span className={styles.pointVariance}>
            {row.flagged && (
              <RagDot
                colour={row.flagColour}
                label={`Flag: ${statusPhrase(row.flagColour)}`}
              />
            )}
            <span className={`${varianceToneClass(row)} tnum`}>
              {varianceText(row.varianceWeeks) ?? 'not stated'}
            </span>
          </span>
        </span>
        <span
          className={`${styles.pointChevron} ${
            open ? styles.pointChevronOpen : ''
          }`}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M4 2l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </li>
  );
}

// One list of point rows with the open detail slotted beneath its row. The
// same milestone can be listed in the high-level breakdown and the Register,
// so the open state carries which table it was opened in and only that
// instance expands.
function PointList({ rows, table, openPoint, onToggle, detail }) {
  return (
    <ul className={styles.pointRows}>
      {rows.map((row) => {
        const open =
          openPoint != null &&
          openPoint.table === table &&
          openPoint.key === row.key;
        const detailId = `point-detail-${table}-${row.key}`;
        return (
          <Fragment key={row.key}>
            <PointRow
              row={row}
              open={open}
              detailId={detailId}
              onToggle={() => onToggle(table, row.key)}
            />
            {open && detail != null && (
              <li id={detailId} className={styles.detailRow}>
                {detail}
              </li>
            )}
          </Fragment>
        );
      })}
    </ul>
  );
}

/* ── The point detail (Phase 3.8a): the considered home for the mark. The
      facts the surface already holds, plainly; for a writer, a milestone
      carries the mark form (mark met on a date, amend it, un-mark), light
      and reversible, no confirmation. A gate's detail is read-only: gate-met
      is owned by the gate mechanic. A thin render over detailModel. ── */

function PointDetail({
  fields,
  canEdit,
  todayIso,
  busy,
  error,
  onMark,
  onUnmark,
}) {
  // The date input's draft, null while it follows its default: today for a
  // fresh mark, the recorded date for an amendment. Cleared when a write
  // lands so the default tracks the fresh state.
  const [draft, setDraft] = useState(null);

  const todayValue = utcDayValue(todayIso);
  const { canMark } = writeControls({ kind: fields.kind, canEdit });
  const inputValue =
    draft ??
    (fields.met ? utcDayValue(fields.metDate) : todayValue) ??
    todayValue ??
    '';

  const submitMark = async (event) => {
    event.preventDefault();
    if (busy) return;
    const done = await onMark(inputValue);
    if (done) setDraft(null);
  };

  const submitUnmark = async () => {
    if (busy) return;
    const done = await onUnmark();
    if (done) setDraft(null);
  };

  // Only the critical-slip band recolours the panel, the house critical wash
  // and full border; met and watch-band states read from their facts.
  const tone =
    !fields.met && fields.flagged && fields.flagColour === 'red'
      ? styles.detailCrit
      : '';

  return (
    <div className={`${styles.detail} ${tone}`}>
      <p className={styles.detailMeta}>
        {fields.kind}
        {fields.stage != null ? ` · stage ${fields.stage}` : ''}
        {` · ${fields.criticality}`}
      </p>
      <h3 className={styles.detailName}>{fields.name ?? fields.key}</h3>
      <dl className={styles.detailFacts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Baseline</dt>
          <dd className={`${styles.factValue} tnum`}>
            {formatShort(fields.baselineDate) ?? 'not dated'}
          </dd>
        </div>
        {fields.met ? (
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Met on</dt>
            <dd className={`${styles.factValue} ${styles.factValueMet} tnum`}>
              {formatShort(fields.metDate) ?? 'date not recorded'}
            </dd>
          </div>
        ) : (
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Forecast</dt>
            <dd className={`${styles.factValue} tnum`}>
              {formatShort(fields.currentDate) ?? 'not dated'}
            </dd>
          </div>
        )}
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Variance</dt>
          <dd className={`${styles.factValue} tnum`}>
            {varianceText(fields.varianceWeeks) ?? 'not stated'}
          </dd>
        </div>
        {fields.flagged && (
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Flag</dt>
            <dd className={styles.factValue}>
              <span
                className={`${styles.factFlag} ${
                  fields.flagColour === 'red' ? styles.varCrit : styles.varSlip
                }`}
              >
                <RagDot colour={fields.flagColour} decorative />
                {statusPhrase(fields.flagColour)}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {fields.kind === 'gate' && (
        <p className={styles.detailNote}>
          {fields.met
            ? 'This gate is passed. A gate is decided at its gate review, the go or no-go, not marked here.'
            : 'A gate is decided at its gate review, the go or no-go, not marked here.'}
        </p>
      )}

      {canMark && (
        <>
          <form className={styles.markForm} onSubmit={submitMark}>
            <label className={styles.markField}>
              <span className={styles.markLabel}>Met on</span>
              <input
                type="date"
                className={styles.dateInput}
                value={inputValue}
                max={todayValue ?? undefined}
                onChange={(event) => setDraft(event.target.value)}
                disabled={busy}
              />
            </label>
            <div className={styles.markActions}>
              <button
                type="submit"
                className={styles.markBtn}
                disabled={busy}
              >
                {busy ? 'Saving' : fields.met ? 'Save date' : 'Mark met'}
              </button>
              {fields.met && (
                <button
                  type="button"
                  className={styles.unmarkBtn}
                  onClick={submitUnmark}
                  disabled={busy}
                >
                  Un-mark
                </button>
              )}
            </div>
          </form>
          <p className={styles.markHint}>
            {fields.met
              ? 'Correct the date it was actually met, or un-mark it. Both are reversible.'
              : 'Record the date it was actually met, today or earlier.'}
          </p>
        </>
      )}
      {error != null && (
        <p className={styles.markError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── The programme chart (Note 17, finding 4): one drawing of the locked
      programme against where it now stands. A left gutter names each stage,
      a labelled bar carries its baseline extent, a quarter grid and one
      today line set the time, and every point sits where its dates put it:
      a gate as a diamond at the stage end, a milestone as a circle, solid at
      its baseline and open at its current position with the drift between
      them carrying the slip in weeks. A slipped gate reads through the faint
      forecast extension on its own stage bar, so no second diamond competes
      with the first.

      A thin render over the pure chartModel view-model. Every x here is
      CHART.gutter plus a fraction the model computed; this component holds
      no date arithmetic, no domain, and no ordering of its own. The SVG is
      one image to assistive technology, summarised in its label: the
      register beneath is the accessible reading of the same rows, point by
      point, so nothing lives in the drawing alone. ── */

// The current marker's tone, the surface's existing status vocabulary: met
// is the success green, a flagged point carries its band (amber for the
// critical-slip read, the bright monochrome for the watch band), everything
// else the neutral secondary ink.
function chartPointTone(point) {
  if (point.met) return styles.cxMet;
  if (point.flagged) {
    return point.flagColour === 'red' ? styles.cxCritSlip : styles.cxSlipping;
  }
  return styles.cxNeutral;
}

// The drift connector's tone, matching the variance column: the band on a
// flagged point, the success green when ahead, quiet otherwise.
function chartDriftTone(point) {
  if (point.flagged) {
    return point.flagColour === 'red' ? styles.cxCritSlip : styles.cxSlipping;
  }
  if (point.direction === VARIANCE_DIRECTIONS.AHEAD) return styles.cxAhead;
  return styles.cxQuietTone;
}

// One point's two markers, the drift between them, and the slip. A gate
// draws its diamond at the baseline only: its slip is the stage bar's
// forecast extension.
function ChartPoint({ point, x, cy }) {
  const critical = point.criticality === 'critical';
  const radius = critical ? 6 : 4.5;
  const half = 6;

  const marker = (frac, kindClass) => {
    const cx = x(frac);
    if (point.kind === 'gate') {
      return (
        <rect
          className={`${styles.cxMk} ${kindClass}`}
          x={cx - half}
          y={cy - half}
          width={half * 2}
          height={half * 2}
          rx="1.5"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      );
    }
    return (
      <circle
        className={`${styles.cxMk} ${kindClass}`}
        cx={cx}
        cy={cy}
        r={radius}
      />
    );
  };

  return (
    <g>
      <title>{point.label}</title>
      {point.drift != null && (
        <rect
          className={`${styles.cxDrift} ${chartDriftTone(point)}`}
          x={x(point.drift.fromFrac)}
          y={cy - CHART.driftHeight / 2}
          width={Math.max(x(point.drift.toFrac) - x(point.drift.fromFrac), 1)}
          height={CHART.driftHeight}
          rx={CHART.driftHeight / 2}
        />
      )}
      {point.baselineFrac != null &&
        marker(
          point.baselineFrac,
          critical ? styles.cxBaseCrit : styles.cxBase
        )}
      {point.showCurrent &&
        marker(
          point.currentFrac,
          `${styles.cxCurrent} ${critical ? styles.cxCurrentCrit : ''} ${chartPointTone(point)}`
        )}
      {point.drift != null && point.slipLabel != null && (
        <text
          className={`${styles.cxSlip} ${chartDriftTone(point)}`}
          x={(x(point.drift.fromFrac) + x(point.drift.toFrac)) / 2}
          y={cy - 13}
          textAnchor="middle"
        >
          {point.slipLabel}
        </text>
      )}
    </g>
  );
}

function ProgrammeChart({ chart, baselineVersion }) {
  if (!chart.hasDomain || chart.tracks.length === 0) {
    return (
      <p className={styles.cxNote}>
        The locked programme holds no dated point, so there is nothing to plot.
        The register below lists every point it does hold.
      </p>
    );
  }

  const width = Math.max(
    CHART.minWidth,
    CHART.gutter +
      CHART.padRight +
      Math.max(chart.quarters.length, 4) * CHART.quarterWidth
  );
  const plot = width - CHART.gutter - CHART.padRight;
  const height = CHART.axis + chart.tracks.length * CHART.row + CHART.bottom;
  const x = (frac) => CHART.gutter + frac * plot;
  const gridTop = CHART.axis - 4;
  const gridBottom = height - CHART.bottom;

  // The today label is pinned inside the plot so it never overhangs the
  // frame at either edge of the domain.
  const todayX = chart.todayFrac == null ? null : x(chart.todayFrac);
  const todayLabelX =
    todayX == null
      ? null
      : Math.min(
          Math.max(todayX, CHART.gutter + 22),
          CHART.gutter + plot - 22
        );

  const spoken =
    `Programme chart. ${chart.tracks.length} stages on the locked baseline ` +
    `v${baselineVersion}, ${formatShort(chart.start)} to ${formatShort(chart.end)}. ` +
    `Every point is listed with its dates in the register below.`;

  return (
    <div className={styles.cxFrame}>
      <div className={styles.cxScroll}>
        <svg
          className={styles.cxSvg}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={spoken}
        >
          <defs>
            <clipPath id="programme-chart-gutter">
              <rect x="0" y="0" width={CHART.gutter - 14} height={height} />
            </clipPath>
          </defs>

          {/* The quarter grid and its labels. */}
          {chart.quarters.map((band) => (
            <g key={`${band.year}-${band.quarter}`}>
              {band.gridline && (
                <line
                  className={styles.cxGrid}
                  x1={x(band.startFrac)}
                  y1={gridTop}
                  x2={x(band.startFrac)}
                  y2={gridBottom}
                />
              )}
              {band.labelled && (
                <text
                  className={styles.cxQuarter}
                  x={x(band.midFrac)}
                  y={26}
                  textAnchor="middle"
                >
                  {band.label}
                </text>
              )}
            </g>
          ))}

          {/* One today line, reference and not signal: ink, never amber. */}
          {todayX != null && (
            <g>
              <line
                className={styles.cxToday}
                x1={todayX}
                y1={gridTop}
                x2={todayX}
                y2={gridBottom}
              />
              <rect
                className={styles.cxTodayBg}
                x={todayLabelX - 21}
                y="2"
                width="42"
                height="13"
                rx="2"
              />
              <text
                className={styles.cxTodayLabel}
                x={todayLabelX}
                y={12}
                textAnchor="middle"
              >
                Today
              </text>
            </g>
          )}

          {chart.tracks.map((track, index) => {
            const top = CHART.axis + index * CHART.row;
            const cy = top + CHART.centre;
            const hasBar = track.startFrac != null && track.endFrac != null;
            const barX = hasBar ? x(track.startFrac) : null;
            const barEnd = hasBar ? x(track.endFrac) : null;
            return (
              <g key={track.stage ?? `t${index}`}>
                {index > 0 && (
                  <line
                    className={styles.cxRowRule}
                    x1="0"
                    y1={top}
                    x2={width}
                    y2={top}
                  />
                )}

                <g clipPath="url(#programme-chart-gutter)">
                  <text className={styles.cxStageNum} x="2" y={cy - 3}>
                    S{track.stage}
                  </text>
                  <text className={styles.cxStageName} x="26" y={cy - 3}>
                    {track.stageName}
                  </text>
                  <text className={styles.cxStageMeta} x="2" y={cy + 13}>
                    {track.extentWeeks != null ? `${track.extentWeeks} wk` : 'not dated'}
                    {track.concurrent && track.anchorLabel
                      ? ` · from ${track.anchorLabel}`
                      : ''}
                  </text>
                </g>

                {/* The stage bar: its baseline extent, and where the gate is
                    forecast later, the faint extension that carries the slip
                    rather than a second diamond. */}
                {hasBar && track.forecastEndFrac != null && (
                  <rect
                    className={styles.cxExtension}
                    x={barEnd}
                    y={cy - CHART.barHeight / 2}
                    width={Math.max(x(track.forecastEndFrac) - barEnd, 1)}
                    height={CHART.barHeight}
                    rx={CHART.barHeight / 2}
                  />
                )}
                {hasBar && (
                  <rect
                    className={`${styles.cxBar} ${
                      track.concurrent ? styles.cxBarConcurrent : ''
                    }`}
                    x={barX}
                    y={cy - CHART.barHeight / 2}
                    width={Math.max(barEnd - barX, 2)}
                    height={CHART.barHeight}
                    rx={CHART.barHeight / 2}
                  />
                )}
                {hasBar &&
                  track.forecastEndFrac != null &&
                  track.gateSlipLabel != null && (
                    <text
                      className={`${styles.cxSlip} ${styles.cxQuietTone}`}
                      x={(barEnd + x(track.forecastEndFrac)) / 2}
                      y={cy - 13}
                      textAnchor="middle"
                    >
                      {track.gateSlipLabel}
                    </text>
                  )}

                {track.points.map((point) => (
                  <ChartPoint key={point.key} point={point} x={x} cy={cy} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className={styles.cxLegend} aria-label="Chart key">
        <li className={styles.cxLegendItem}>
          <span className={`${styles.cxKeyBar}`} aria-hidden="true" />
          stage, its baseline extent
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyExt} aria-hidden="true" />
          forecast extension
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyBase} aria-hidden="true" />
          baseline position
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyCurrent} aria-hidden="true" />
          current position
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyCrit} aria-hidden="true" />
          critical milestone
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyGate} aria-hidden="true" />
          gate
        </li>
        <li className={styles.cxLegendItem}>
          <span className={styles.cxKeyToday} aria-hidden="true" />
          today
        </li>
      </ul>
    </div>
  );
}

export default function ProgrammeTracking({
  projectId,
  projectName,
  workspaceHref,
  baselineVersion,
  baselineLockedAt,
  programme,
  metView,
  todayIso,
  currentStage,
  stageStates = null,
  canEdit = true,
  adminContact = null,
}) {
  const supabase = createClient();

  // The bounded tolerance dial: session-only, opens on Standard every visit,
  // persisted nowhere.
  const [toleranceKey, setToleranceKey] = useState(DEFAULT_TOLERANCE_KEY);
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const tabRefs = useRef({});

  // The register's view, session-only like the dial: it opens on the
  // governing set every visit, and the toggle chooses a view of the one
  // register rather than opening a second table.
  const [registerFilter, setRegisterFilter] = useState(
    DEFAULT_REGISTER_FILTER
  );

  // The met-points view as state (3.8a): opened on what the page loaded, and
  // replaced after a successful write so the engines re-derive and the
  // surface moves without a full page reload.
  const [metPoints, setMetPoints] = useState(metView);

  // The open point detail: which table it was opened in and the point's key,
  // or null with every detail closed. One detail at a time; tapping the open
  // row closes it.
  const [openPoint, setOpenPoint] = useState(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState(null);

  // The fast lane's note (3.8b): the last one-tap outcome, a quiet
  // confirmation naming what landed (the row itself has dropped from the
  // unmet lookahead) or the plain failure sentence. Cleared on the next fast
  // tap and on any detail navigation, so it stays brief and never goes
  // stale.
  const [fastNote, setFastNote] = useState(null);

  // The three engines over the loaded data. Today and the tolerance are
  // inputs, read upstream, never the clock here. Only the RAG derivation
  // reads the tolerance, so only it re-runs when the dial moves; all three
  // re-run when a write refreshes the met-points view.
  const progress = useMemo(
    () => deriveProgress(programme, metPoints),
    [programme, metPoints]
  );
  const rag = useMemo(
    () =>
      deriveRAG(programme, metPoints, todayIso, toleranceWeeksFor(toleranceKey)),
    [programme, metPoints, todayIso, toleranceKey]
  );
  const forecast = useMemo(
    () => deriveForecast(programme, metPoints, todayIso),
    [programme, metPoints, todayIso]
  );

  // The five tile values, derived from the engine outputs by the pure display
  // model. Rounding for display happens there, never inside an engine output.
  const status = useMemo(() => statusTile(rag), [rag]);
  const complete = useMemo(() => completeTile(progress), [progress]);
  const slipping = useMemo(() => slippingTile(rag), [rag]);
  const nextCritical = useMemo(
    () => nextCriticalTile(programme, forecast),
    [programme, forecast]
  );
  const completion = useMemo(
    () => forecastCompletionTile(programme, forecast),
    [programme, forecast]
  );

  // The Overview tab's three blocks, derived from the same engine outputs by
  // the pure overview model: the gate states off the forecast tree, the
  // attention list off the RAG derivation (so the dial re-orders it live),
  // and the lookahead off the forecast dates against the today the page read
  // once. No new load and no second clock read.
  const nextGate = useMemo(
    () => nextGateCard(programme, forecast),
    [programme, forecast]
  );
  const attention = useMemo(() => needsAttention(rag), [rag]);
  const lookahead = useMemo(
    () => nextThirtyDays(programme, forecast, todayIso),
    [programme, forecast, todayIso]
  );

  // The Schedule tab's two readings of one row set, derived from the same
  // engine outputs by the pure models: the row set joining the frozen
  // baseline, the forecast tree, and the RAG flags (so the dial's re-run
  // restyles the flagged rows live), the register's chosen view grouped by
  // stage, and the chart's geometry from the dates, the stage states, and
  // the one today the page read. No new load and no second clock read.
  const rows = useMemo(
    () => scheduleRows(programme, forecast, rag),
    [programme, forecast, rag]
  );
  const registerRows = useMemo(
    () => filterRows(rows, registerFilter),
    [rows, registerFilter]
  );
  const stageGroups = useMemo(
    () => registerGroups(registerRows),
    [registerRows]
  );
  const chart = useMemo(
    () =>
      programmeChart(programme, rows, {
        today: todayIso,
        stageStates,
        forecastCompletion: forecast?.forecastCompletion ?? null,
      }),
    [programme, rows, todayIso, stageStates, forecast]
  );

  // The open point's detail fields (3.8a): the row the Schedule already built
  // (identity off the baseline, current off the forecast, flag off the RAG
  // derivation), joined with the met date off the met-points view by the pure
  // detail model. Re-derived with the rows, so a write moves the open detail
  // too.
  const openRow =
    openPoint == null
      ? null
      : (rows.find((row) => row.key === openPoint.key) ?? null);
  const openDetail = useMemo(
    () => (openRow == null ? null : detailFields(openRow, metPoints)),
    [openRow, metPoints]
  );

  // Opening a detail is navigation: tapping a row opens its detail, tapping
  // the open row closes it, and a stale write error or fast-lane note never
  // follows the navigation.
  const togglePoint = (table, key) => {
    setMarkError(null);
    setFastNote(null);
    setOpenPoint((prev) =>
      prev != null && prev.table === table && prev.key === key
        ? null
        : { table, key }
    );
  };

  // After a successful write, re-read the met-points view so the engines
  // re-derive from what the database now holds. Should the refresh read fail
  // (the write itself has already landed), the pure fallback applies the
  // confirmed change locally, so a successful write always moves the surface.
  const refreshMetPoints = async (fallbackView) => {
    const { view, error } = await loadMetPointsView(supabase, projectId);
    setMetPoints(error == null && view != null ? view : fallbackView);
  };

  // Mark a milestone met on the chosen date, or amend the date if it already
  // is: one call, the store's atomic mark-or-amend upsert. The light guard
  // runs first; a guarded or failed write leaves the view untouched and
  // reports why. Returns whether the write landed, so the form can settle.
  const handleMark = async (key, dateValue) => {
    if (markBusy) return false;
    const check = validateMetDate(dateValue, todayIso);
    if (!check.ok) {
      setMarkError(check.reason);
      return false;
    }
    setMarkBusy(true);
    setMarkError(null);
    const { error } = await markMilestoneMet(supabase, {
      projectId,
      milestoneKey: key,
      metDate: check.metDate,
    });
    if (error != null) {
      setMarkBusy(false);
      setMarkError(MARK_ERROR);
      return false;
    }
    await refreshMetPoints(viewWithMark(metPoints, key, check.metDate));
    setMarkBusy(false);
    return true;
  };

  // Un-mark a milestone: the store's plain delete, then the same refresh.
  // Reversible by construction, met if and only if a row exists, so no
  // confirmation stands in the way.
  const handleUnmark = async (key) => {
    if (markBusy) return false;
    setMarkBusy(true);
    setMarkError(null);
    const { error } = await unmarkMilestone(supabase, {
      projectId,
      milestoneKey: key,
    });
    if (error != null) {
      setMarkBusy(false);
      setMarkError(UNMARK_ERROR);
      return false;
    }
    await refreshMetPoints(viewWithoutMark(metPoints, key));
    setMarkBusy(false);
    return true;
  };

  // The fast mark (3.8b): one tap marks a lookahead milestone met on today,
  // through the exact same shared handleMark the detail's form submits to,
  // then notes what landed. The request is fastMarkAction's, so the tap
  // exists only where the 3.8a gate allows a mark. On failure the note
  // carries the plain sentence instead and the shared error state is
  // cleared, so the sentence lives in one visible place (the writes are
  // serialised by markBusy, so no other owner of it is in flight).
  const handleFastMark = async (item, request) => {
    if (markBusy || request == null) return;
    setFastNote(null);
    const done = await handleMark(request.key, request.dateValue);
    if (done) {
      setFastNote({
        kind: 'done',
        name: item.name ?? item.key,
        dateValue: request.dateValue,
      });
    } else {
      setFastNote({ kind: 'failed' });
      setMarkError(null);
    }
  };

  // The one detail panel, rendered by whichever list holds the open row.
  // Keyed by the point so switching points resets the form's draft.
  const detailPanel =
    openDetail == null ? null : (
      <PointDetail
        key={openDetail.key}
        fields={openDetail}
        canEdit={canEdit}
        todayIso={todayIso}
        busy={markBusy}
        error={markError}
        onMark={(dateValue) => handleMark(openDetail.key, dateValue)}
        onUnmark={() => handleUnmark(openDetail.key)}
      />
    );

  const lockedOn = formatStamp(baselineLockedAt);
  const completionVariance = varianceLabel(completion.varianceWeeks);

  // The register's own sentence, stated by the view it is showing, so the
  // rule the filter applies is never left to be inferred from the rows.
  const registerFilterNote =
    REGISTER_FILTERS.find((view) => view.key === registerFilter)?.note ?? '';

  // Whether any lookahead row offers the fast mark, for the block's hint
  // line alone: a writer with at least one unmet milestone in the window.
  const fastOffered = lookahead.some(
    (item) => fastMarkAction(item, canEdit, todayIso) != null
  );
  const nextGateHref = nextGate.done
    ? null
    : gateReviewHref(projectId, nextGate.stage);
  const nextGateSlipping = nextGate.direction === GATE_DIRECTIONS.BEHIND;

  // Roving focus on the tab list: Left and Right move between the two tabs,
  // Home and End jump to the ends, and moving focus selects.
  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((t) => t.key === activeTab);
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next == null) return;
    event.preventDefault();
    const key = TABS[next].key;
    setActiveTab(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <main className={`container ${styles.page}`} id="main-content">
      <Link href={workspaceHref} className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M9 11L5 7l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to the workspace
      </Link>

      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Programme / Tracking</p>
          <h1 className={styles.title}>{projectName}</h1>
        </div>
        <span className={`${styles.baselineChip} tnum`}>
          Baseline v{baselineVersion}
          {lockedOn ? ` · locked ${lockedOn}` : ''}
        </span>
      </div>
      {!canEdit && (
        <div className={styles.viewOnly}>
          <ViewOnlyBadge adminContact={adminContact} />
        </div>
      )}

      {/* ── The programme summary band: pinned, five co-equal tiles, every
             one system-calculated. ── */}
      <section
        className={styles.band}
        aria-label="Programme summary"
      >
        <p className={styles.bandEyebrow}>{bandPosition(currentStage)}</p>
        <div className={styles.tiles}>
          <Tile label="Status">
            <RagDot colour={status.colour} large decorative />
            <span
              className={
                status.colour === 'red' ? styles.tileValueCrit : undefined
              }
            >
              {STATUS_WORDS[status.colour] ?? 'Not available'}
            </span>
          </Tile>
          <Tile
            label="Complete"
            sub={
              complete.totalPoints > 0
                ? `${complete.metPoints} of ${complete.totalPoints} points met`
                : null
            }
          >
            <span className="tnum">
              {complete.percent == null ? 'No points' : `${complete.percent}%`}
            </span>
          </Tile>
          <Tile
            label="Slipping"
            sub={
              slipping.count > 0
                ? slipping.criticalCount > 0
                  ? `${slipping.criticalCount} critical`
                  : 'none critical'
                : 'nothing behind baseline'
            }
            subSignal={slipping.criticalCount > 0}
          >
            <span className="tnum">
              {slipping.count} {slipping.count === 1 ? 'item' : 'items'}
            </span>
          </Tile>
          <Tile
            label="Next critical milestone"
            sub={nextCritical.done ? 'no critical points remain' : nextCritical.name}
          >
            {nextCritical.done ? (
              'All met'
            ) : (
              <span className="tnum">{formatShort(nextCritical.date)}</span>
            )}
          </Tile>
          <Tile label="Forecast completion" sub={completionVariance}>
            {completion.date == null ? (
              'Not dated'
            ) : (
              <span className="tnum">{formatShort(completion.date)}</span>
            )}
          </Tile>
        </div>
      </section>

      {/* ── The status key and the tolerance dial: a quiet strip under the
             band, not part of the pinned mass. The key lines are the model's
             Section 9 rule verbatim; only the band words are the surface's. ── */}
      <div className={styles.keyStrip}>
        <ul className={styles.key} aria-label="Status key">
          {COLOUR_KEY.map((entry) => (
            <li key={entry.colour} className={styles.keyItem}>
              <RagDot colour={entry.colour} decorative />
              <span className={styles.keyText}>
                <b>{STATUS_WORDS[entry.colour] ?? entry.label}.</b>{' '}
                {entry.line}
              </span>
            </li>
          ))}
        </ul>
        <div
          className={styles.tolerance}
          role="group"
          aria-label="Slip tolerance"
        >
          <span className={styles.toleranceLabel}>Slip tolerance</span>
          <div className={styles.toleranceChoices}>
            {TOLERANCE_SETTINGS.map((setting) => (
              <button
                key={setting.key}
                type="button"
                className={`${styles.toleranceBtn} ${
                  toleranceKey === setting.key ? styles.toleranceBtnOn : ''
                }`}
                aria-pressed={toleranceKey === setting.key}
                onClick={() => setToleranceKey(setting.key)}
              >
                {setting.label}
                <span className={`${styles.toleranceWeeks} tnum`}>
                  {setting.weeks} wk
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── The two tabs. The mechanism is real and final, and both panels
             carry their content: the Overview (3.6) and the Schedule (3.7). ── */}
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Programme tracking"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={`${styles.tabBtn} ${
              activeTab === tab.key ? styles.tabBtnOn : ''
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-overview"
        aria-labelledby="tab-overview"
        hidden={activeTab !== 'overview'}
        className={styles.panel}
      >
        {/* ── Next Gate: the one gate ahead, spotlit in the same card form as
               Needs attention so gates and milestones read the same way. ── */}
        <section className={styles.block} aria-labelledby="overview-next-gate">
          <div className={styles.blockHead}>
            <h2 id="overview-next-gate" className={styles.blockTitle}>
              Next Gate
            </h2>
            {!nextGate.done && (
              <span className={styles.blockMeta}>the one gate ahead</span>
            )}
          </div>
          {nextGate.done ? (
            <div className={styles.blockEmpty}>
              <p className={styles.blockEmptyLead}>Every gate is passed.</p>
              <p className={styles.blockEmptyNote}>
                The programme has cleared its final stage boundary; nothing
                remains at a gate.
              </p>
            </div>
          ) : (
            <article className={styles.card}>
              <div className={styles.cardBody}>
                <p className={styles.cardName}>{nextGate.name ?? 'Gate'}</p>
                <p className={styles.cardMeta}>
                  gate
                  {nextGate.stage != null ? ` · stage ${nextGate.stage}` : ''}
                  {' · critical'}
                </p>
                <p className={styles.cardWhy}>
                  The go or no-go decision that closes the stage. It is always
                  tracked.
                </p>
                {nextGateHref && (
                  <Link href={nextGateHref} className={styles.cardLink}>
                    Open the gate review
                  </Link>
                )}
              </div>
              <div className={styles.cardSide}>
                {nextGate.direction != null && (
                  <span
                    className={`${styles.statusChip} ${
                      nextGateSlipping
                        ? styles.statusChipSlip
                        : styles.statusChipOn
                    }`}
                  >
                    {nextGateSlipping ? 'Slipping' : 'On track'}
                  </span>
                )}
                {nextGate.varianceWeeks != null && (
                  <span
                    className={`${styles.cardFigure} ${
                      nextGateSlipping ? styles.cardFigureBehind : ''
                    } tnum`}
                  >
                    {directionLabel(nextGate.varianceWeeks)}
                  </span>
                )}
                <span className={`${styles.cardDates} tnum`}>
                  forecast {formatShort(nextGate.forecastDate) ?? 'not dated'}
                  {' · '}
                  baseline {formatShort(nextGate.baselineDate) ?? 'not dated'}
                </span>
              </div>
            </article>
          )}
        </section>

        {/* ── Needs attention: the RAG engine's flagged list, worst first,
               re-ordering live as the tolerance dial re-runs the derivation. ── */}
        <section className={styles.block} aria-labelledby="overview-attention">
          <div className={styles.blockHead}>
            <h2 id="overview-attention" className={styles.blockTitle}>
              Needs attention
            </h2>
            <span className={`${styles.blockMeta} tnum`}>
              {attention.length === 0
                ? 'no items'
                : `${attention.length} ${attention.length === 1 ? 'item' : 'items'}`}
            </span>
          </div>
          {attention.length === 0 ? (
            <div className={styles.blockEmpty}>
              <p className={styles.blockEmptyLead}>Nothing needs attention.</p>
              <p className={styles.blockEmptyNote}>
                No point is behind its baseline at this tolerance and nothing
                is breaching.
              </p>
            </div>
          ) : (
            <ul className={styles.cardList}>
              {attention.map((item) => (
                <li
                  key={item.key}
                  className={`${styles.card} ${
                    item.colour === 'red' ? styles.cardCrit : ''
                  }`}
                >
                  <div className={styles.cardBody}>
                    <p className={styles.cardName}>{item.name ?? item.key}</p>
                    <p className={styles.cardMeta}>
                      {item.kind}
                      {item.stage != null ? ` · stage ${item.stage}` : ''}
                      {` · ${item.criticality}`}
                    </p>
                    {attentionReason(item.condition) && (
                      <p className={styles.cardWhy}>
                        {attentionReason(item.condition)}
                      </p>
                    )}
                  </div>
                  <div className={styles.cardSide}>
                    <span className={styles.cardContribution}>
                      <RagDot
                        colour={item.colour}
                        label={`Flag: ${statusPhrase(item.colour)}`}
                      />
                      {behindLabel(item.weeksBehind) && (
                        <span
                          className={`${styles.cardFigure} ${
                            item.colour === 'red'
                              ? styles.cardFigureCrit
                              : styles.cardFigureBehind
                          } tnum`}
                        >
                          {behindLabel(item.weeksBehind)}
                        </span>
                      )}
                    </span>
                    {item.baselineDate != null && (
                      <span className={`${styles.cardDates} tnum`}>
                        baseline {formatShort(item.baselineDate)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Next 30 days: the lookahead, every unmet point forecast inside
               the month ahead, soonest first. Each row opens the same point
               detail the Schedule rows open, and a writer's milestone row
               carries the fast mark (3.8b): one tap, met on today, through
               the one shared write path. ── */}
        <section className={styles.block} aria-labelledby="overview-lookahead">
          <div className={styles.blockHead}>
            <h2 id="overview-lookahead" className={styles.blockTitle}>
              Next 30 days
            </h2>
            <span className={styles.blockMeta}>by forecast date</span>
          </div>
          {fastNote != null &&
            (fastNote.kind === 'done' ? (
              <p className={styles.lookNote} role="status">
                <svg
                  className={styles.lookNoteTick}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 7.5L6 11l5.5-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {fastNote.name} marked met on{' '}
                  <span className="tnum">
                    {formatShort(new Date(fastNote.dateValue))}
                  </span>
                  .{' '}
                  <span className={styles.lookNoteQuiet}>
                    Amend the date or un-mark it from its detail in the
                    Schedule.
                  </span>
                </span>
              </p>
            ) : (
              <p
                className={`${styles.markError} ${styles.lookError}`}
                role="alert"
              >
                {MARK_ERROR}
              </p>
            ))}
          {lookahead.length === 0 ? (
            <div className={styles.blockEmpty}>
              <p className={styles.blockEmptyLead}>A quiet month ahead.</p>
              <p className={styles.blockEmptyNote}>
                No unmet point has a forecast date in the next 30 days.
              </p>
            </div>
          ) : (
            <>
              <ul className={styles.look}>
                {lookahead.map((item) => {
                  const open =
                    openPoint != null &&
                    openPoint.table === 'look' &&
                    openPoint.key === item.key;
                  const detailId = `point-detail-look-${item.key}`;
                  const fast = fastMarkAction(item, canEdit, todayIso);
                  return (
                    <Fragment key={item.key}>
                      <li className={styles.lookRow}>
                        <button
                          type="button"
                          className={styles.lookRowBtn}
                          aria-expanded={open}
                          aria-controls={open ? detailId : undefined}
                          onClick={() => togglePoint('look', item.key)}
                        >
                          <span className={`${styles.lookDate} tnum`}>
                            {formatShort(item.forecastDate)}
                          </span>
                          <span className={styles.lookBody}>
                            <span className={styles.lookName}>
                              {item.name ?? item.key}
                            </span>
                            <span className={styles.lookMeta}>
                              {item.kind}
                              {item.stage != null
                                ? ` · stage ${item.stage}`
                                : ''}
                            </span>
                          </span>
                          <span
                            className={`${styles.lookCriticality} ${
                              item.criticality === 'critical'
                                ? styles.lookCriticalityCritical
                                : ''
                            }`}
                          >
                            {item.criticality}
                          </span>
                          <span
                            className={`${styles.pointChevron} ${
                              open ? styles.pointChevronOpen : ''
                            }`}
                            aria-hidden="true"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12">
                              <path
                                d="M4 2l4 4-4 4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </button>
                        {fast != null && (
                          <button
                            type="button"
                            className={styles.lookMarkBtn}
                            onClick={() => handleFastMark(item, fast)}
                            disabled={markBusy}
                            aria-label={`Mark ${item.name ?? item.key} met today`}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              aria-hidden="true"
                            >
                              <path
                                d="M2 6.5L5 9.5l5-7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Met today
                          </button>
                        )}
                      </li>
                      {open && detailPanel != null && (
                        <li id={detailId} className={styles.detailRow}>
                          {detailPanel}
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ul>
              <p className={styles.tableNote}>
                {fastOffered
                  ? "Tap a point to open its detail. Met today marks a milestone met on today's date; a different date or a correction lives in the detail."
                  : 'Tap a point to open its detail.'}
              </p>
            </>
          )}
        </section>
      </div>

      <div
        role="tabpanel"
        id="panel-schedule"
        aria-labelledby="tab-schedule"
        hidden={activeTab !== 'schedule'}
        className={`${styles.panel} ${styles.schedulePanel}`}
      >
        {rows.length === 0 ? (
          <div className={styles.blockEmpty}>
            <p className={styles.blockEmptyLead}>
              The baseline holds no trackable points.
            </p>
            <p className={styles.blockEmptyNote}>
              Nothing in the locked programme carries a key to track, so there
              is no schedule to show.
            </p>
          </div>
        ) : (
          <>
            {/* ── The register: one table, grouped by stage, seen either as
                   the governing set or as every point. The rows are the same
                   rows the chart draws. ── */}
            <section
              className={`${styles.block} ${styles.registerBlock}`}
              aria-labelledby="schedule-register"
            >
              <div className={styles.blockHead}>
                <h2 id="schedule-register" className={styles.blockTitle}>
                  Schedule register
                </h2>
                <span className={`${styles.blockMeta} tnum`}>
                  {registerRows.length} of {rows.length} points
                </span>
              </div>
              <div
                className={styles.viewToggle}
                role="group"
                aria-label="Register view"
              >
                {REGISTER_FILTERS.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    className={`${styles.viewBtn} ${
                      registerFilter === view.key ? styles.viewBtnOn : ''
                    }`}
                    aria-pressed={registerFilter === view.key}
                    onClick={() => setRegisterFilter(view.key)}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              {registerRows.length === 0 ? (
                <div className={styles.blockEmpty}>
                  <p className={styles.blockEmptyLead}>
                    Nothing rises to this view.
                  </p>
                  <p className={styles.blockEmptyNote}>
                    No gate, no critical milestone, and nothing flagged at this
                    tolerance. All points holds the whole programme.
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.pointsTable}>
                    <PointsHeader />
                    {stageGroups.map((group) => (
                      <div
                        key={group.stage ?? 'unstaged'}
                        className={styles.stageGroup}
                      >
                        <h3 className={styles.stageGroupHead}>
                          <span className={`${styles.stageGroupNum} tnum`}>
                            Stage {group.stage}
                          </span>
                          {group.stageName && (
                            <span className={styles.stageGroupName}>
                              {group.stageName}
                            </span>
                          )}
                        </h3>
                        <PointList
                          rows={group.rows}
                          table="register"
                          openPoint={openPoint}
                          onToggle={togglePoint}
                          detail={detailPanel}
                        />
                      </div>
                    ))}
                  </div>
                  <p className={styles.tableNote}>
                    {registerFilterNote}
                    {registerFilter === DEFAULT_REGISTER_FILTER
                      ? ' Flagged rows carry the status they contribute and follow the slip tolerance above.'
                      : ''}{' '}
                    Baseline is the locked v{baselineVersion} date; Current is
                    the forecast, or the actual once met. Tap a point to open
                    its detail.
                  </p>
                </>
              )}
            </section>

            {/* ── The chart: the same rows on time. It leads from 1024px and
                   follows beneath the register on a phone, where the register
                   is the legible form. ── */}
            <section
              className={`${styles.block} ${styles.chartBlock}`}
              aria-labelledby="schedule-chart"
            >
              <div className={styles.blockHead}>
                <h2 id="schedule-chart" className={styles.blockTitle}>
                  Programme chart
                </h2>
                <span className={styles.blockMeta}>
                  baseline against current
                </span>
              </div>
              <ProgrammeChart chart={chart} baselineVersion={baselineVersion} />
              <p className={styles.cxCaption}>
                Forecast completion{' '}
                <span className="tnum">
                  {formatShort(chart.completion.forecastDate) ?? 'not dated'}
                </span>
                , target{' '}
                <span className="tnum">
                  {formatShort(chart.completion.targetDate) ?? 'not dated'}
                </span>
                {chart.completion.varianceLabel == null ? (
                  '. The variance cannot be stated.'
                ) : (
                  <>
                    {', '}
                    <span
                      className={`${
                        chart.completion.varianceWeeks > 0.5
                          ? styles.cxCaptionBehind
                          : ''
                      } tnum`}
                    >
                      {chart.completion.varianceLabel}
                    </span>
                    .
                  </>
                )}
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

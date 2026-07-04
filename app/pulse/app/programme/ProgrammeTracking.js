'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { deriveProgress } from '../../../../lib/engine/programmeProgress.js';
import { deriveRAG } from '../../../../lib/engine/programmeRAG.js';
import { deriveForecast } from '../../../../lib/engine/programmeForecast.js';
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
} from './overviewModel';
import {
  VARIANCE_DIRECTIONS,
  scheduleRows,
  highLevelRows,
  registerGroups,
  timelineLayout,
  varianceText,
} from './scheduleModel';
import styles from './ProgrammeTracking.module.css';

/**
 * ProgrammeTracking - the tracking surface shell, its hero band (Programme
 * module Phase 3.5), the Overview tab's content (Phase 3.6), and the Schedule
 * tab's content (Phase 3.7). The daily face of the module: the pinned summary
 * band with its five co-equal tiles, the colour key, the bounded tolerance
 * dial, the Overview tab (the Next Gate card, the Needs attention list, and
 * the Next 30 days lookahead), and the Schedule tab (the high-level breakdown
 * and, behind the full-schedule control, the Register and Timeline views of
 * the one programme model).
 *
 * The page (server) has loaded the frozen v1 programme and the met-points
 * view, read the clock once, and passed everything down as plain data. This
 * client runs the three engines over those inputs (percent from
 * deriveProgress, colour and flagged list from deriveRAG, forecast dates from
 * deriveForecast) and renders the tile values the display model derives from
 * their outputs. Nothing about a figure, colour, or date is invented at
 * render time, and nothing here writes: the surface is read-only in this
 * step.
 *
 * The tolerance dial is session-only state. Changing it re-runs the RAG
 * derivation with the new tolerance, so the Status colour, the Slipping
 * count, the flagged list, the Needs attention block, and the Schedule's
 * flagged rows respond immediately; the percent and the forecast never read
 * it.
 *
 * The Overview and Schedule tabs read the engine outputs this component
 * already computed through the pure overviewModel and scheduleModel helpers:
 * no new load, no re-derivation, and no second reading of the clock. Both are
 * read-only: forecast editing, actual stamping, and marking a milestone met
 * are later sub-steps and no write happens anywhere on this surface.
 */

// The two tabs. Both carry their content now: the Overview (3.6) and the
// Schedule (3.7).
const TABS = Object.freeze([
  Object.freeze({ key: 'overview', label: 'Overview' }),
  Object.freeze({ key: 'schedule', label: 'Schedule' }),
]);

// The two views of the full schedule, one programme model, no duplication.
// The toggle belongs to the Schedule tab only; the band never shows a
// timeline.
const SCHEDULE_VIEWS = Object.freeze([
  Object.freeze({ key: 'register', label: 'Register' }),
  Object.freeze({ key: 'timeline', label: 'Timeline' }),
]);

// The RAG dot class per colour, so the class lookup stays explicit.
const RAG_CLASS = {
  green: 'ragGreen',
  amber: 'ragAmber',
  red: 'ragRed',
};

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

// A month label for a timeline tick, UTC-pinned for the same reason as
// formatShort.
function formatMonthTick(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

// The status dot, colour only, named for assistive tech by the colour the key
// explains, never a verdict word. In the colour key the adjacent text already
// names the colour, so the swatch there is decorative and stays silent. A
// flagged item's dot names its contribution instead of the overall status.
function RagDot({ colour, large, decorative, label }) {
  const colourClass = RAG_CLASS[colour];
  const classes = [
    styles.ragDot,
    large ? styles.ragDotLarge : '',
    colourClass ? styles[colourClass] : styles.ragUnknown,
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
      aria-label={label ?? (colour ? `Status: ${colour}` : 'Status unavailable')}
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

// The variance figure's tone. A flagged row carries the RAG colour it
// contributes (the danger red, or ochre as amber's text-safe sibling); an
// unflagged row reads by its direction, ahead in the success green, behind
// in plain strong ink (the knock-on case: pushed by upstream drift but not
// itself past its date, so the RAG derivation honestly has not flagged it),
// on baseline quietly.
function varianceToneClass(row) {
  if (row.flagged) {
    return row.flagColour === 'red' ? styles.varDanger : styles.varSignal;
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
// A flagged row carries the RAG dot naming the colour it contributes.
function PointRow({ row }) {
  return (
    <li className={`${styles.pointRow} ${row.met ? styles.pointRowMet : ''}`}>
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
              label={`Contributes ${row.flagColour}`}
            />
          )}
          <span className={`${varianceToneClass(row)} tnum`}>
            {varianceText(row.varianceWeeks) ?? 'not stated'}
          </span>
        </span>
      </span>
    </li>
  );
}

// The spoken form of one timeline point, the same facts the Register row
// carries, so the drawing is never the only carrier of them.
function timelinePointLabel(point) {
  const baseline = formatShort(point.baselineDate) ?? 'not dated';
  const current = formatShort(point.currentDate) ?? 'not dated';
  const variance = varianceText(point.varianceWeeks);
  return (
    `${point.name ?? point.key}: ${point.kind}, ${point.criticality}` +
    `${point.met ? ', met' : ''}. Baseline ${baseline}, current ${current}` +
    `${variance ? `, ${variance}` : ''}.`
  );
}

// The current marker's state: met is the success green, a flagged point
// carries its RAG colour, everything else the neutral fill.
function timelineMarkerState(point) {
  if (point.met) return styles.tlMkMet;
  if (point.flagged) {
    return point.flagColour === 'red' ? styles.tlMkRed : styles.tlMkAmber;
  }
  return styles.tlMkStd;
}

// The drift connector's tone, matching the variance column: the RAG colour
// on a flagged point, the success green when ahead, neutral otherwise.
function timelineDriftTone(point) {
  if (point.flagged) {
    return point.flagColour === 'red'
      ? styles.tlDriftRed
      : styles.tlDriftAmber;
  }
  if (point.direction === VARIANCE_DIRECTIONS.AHEAD) {
    return styles.tlDriftAhead;
  }
  return styles.tlDriftStd;
}

// The Timeline view: the same points laid out on time, stages as lanes, each
// point drawn twice, an outline at its baseline position and a fill at its
// current position, with the drift between them plain. Every position is a
// fraction the pure layout helper computed from the dates alone: no
// dependencies, no smoothing, no ordering beyond the dates. A point past its
// gate sits past its gate.
function TimelinePlot({ layout }) {
  const pct = (frac) => `${(frac * 100).toFixed(4)}%`;
  const markerShape = (point) =>
    point.kind === 'gate' ? styles.tlMkGate : styles.tlMkMs;
  const markerSize = (point) =>
    point.criticality === 'critical' ? styles.tlMkCrit : '';

  return (
    <div>
      <div className={styles.tlFrame}>
        <div className={styles.tlRow}>
          <span className={styles.tlLaneLabel} aria-hidden="true" />
          <div className={`${styles.tlPlot} ${styles.tlAxis}`}>
            {layout.ticks.map((tick) => (
              <span
                key={tick.date.getTime()}
                className={`${styles.tlTickLabel} tnum`}
                style={{ left: pct(tick.frac) }}
              >
                {formatMonthTick(tick.date)}
              </span>
            ))}
            {layout.todayFrac != null && (
              <span
                className={styles.tlTodayLabel}
                style={{ left: pct(layout.todayFrac) }}
              >
                Today
              </span>
            )}
          </div>
        </div>
        {layout.lanes.map((lane) => (
          <div key={lane.stage ?? 'unstaged'} className={styles.tlRow}>
            <span className={styles.tlLaneLabel}>
              <b className="tnum">S{lane.stage}</b> {lane.stageName}
            </span>
            <div className={styles.tlPlot}>
              {layout.ticks.map((tick) => (
                <span
                  key={tick.date.getTime()}
                  className={styles.tlGridline}
                  style={{ left: pct(tick.frac) }}
                  aria-hidden="true"
                />
              ))}
              {layout.todayFrac != null && (
                <span
                  className={styles.tlToday}
                  style={{ left: pct(layout.todayFrac) }}
                  aria-hidden="true"
                />
              )}
              {lane.spanStartFrac != null && lane.spanEndFrac != null && (
                <span
                  className={styles.tlSpan}
                  style={{
                    left: pct(lane.spanStartFrac),
                    width: pct(
                      Math.max(lane.spanEndFrac - lane.spanStartFrac, 0)
                    ),
                  }}
                  aria-hidden="true"
                />
              )}
              {lane.points.map((point) => (
                <span
                  key={point.key}
                  role="img"
                  aria-label={timelinePointLabel(point)}
                >
                  {point.baselineFrac != null &&
                    point.currentFrac != null &&
                    point.baselineFrac !== point.currentFrac && (
                      <span
                        className={`${styles.tlDrift} ${timelineDriftTone(point)}`}
                        style={{
                          left: pct(
                            Math.min(point.baselineFrac, point.currentFrac)
                          ),
                          width: pct(
                            Math.abs(point.currentFrac - point.baselineFrac)
                          ),
                        }}
                        aria-hidden="true"
                      />
                    )}
                  {point.baselineFrac != null && (
                    <span
                      className={`${styles.tlMk} ${markerShape(point)} ${markerSize(point)} ${styles.tlMkBase}`}
                      style={{ left: pct(point.baselineFrac) }}
                      aria-hidden="true"
                    />
                  )}
                  {point.currentFrac != null && (
                    <span
                      className={`${styles.tlMk} ${markerShape(point)} ${markerSize(point)} ${timelineMarkerState(point)}`}
                      style={{ left: pct(point.currentFrac) }}
                      aria-hidden="true"
                    />
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className={styles.tlLegend} aria-label="Timeline key">
        <li className={styles.tlLegendItem}>
          <span
            className={`${styles.tlMk} ${styles.tlMkMs} ${styles.tlMkBase} ${styles.tlMkLegend}`}
            aria-hidden="true"
          />
          baseline position
        </li>
        <li className={styles.tlLegendItem}>
          <span
            className={`${styles.tlMk} ${styles.tlMkMs} ${styles.tlMkStd} ${styles.tlMkLegend}`}
            aria-hidden="true"
          />
          current position
        </li>
        <li className={styles.tlLegendItem}>
          <span
            className={`${styles.tlMk} ${styles.tlMkMs} ${styles.tlMkMet} ${styles.tlMkLegend}`}
            aria-hidden="true"
          />
          met, the actual
        </li>
        <li className={styles.tlLegendItem}>
          <span
            className={`${styles.tlMk} ${styles.tlMkMs} ${styles.tlMkAmber} ${styles.tlMkLegend}`}
            aria-hidden="true"
          />
          flagged amber
        </li>
        <li className={styles.tlLegendItem}>
          <span
            className={`${styles.tlMk} ${styles.tlMkMs} ${styles.tlMkRed} ${styles.tlMkLegend}`}
            aria-hidden="true"
          />
          flagged red
        </li>
        <li className={styles.tlLegendItem}>
          <span className={styles.tlLegendToday} aria-hidden="true" />
          today
        </li>
      </ul>
      <p className={styles.tlNote}>
        A diamond is a gate, a circle a milestone; critical points draw
        larger. Each point sits where its dates put it: the outline at its
        locked baseline date, the fill at its current date, the line between
        them the drift. The faint bar is the stage's baseline extent. Nothing
        here is an invented dependency and nothing is smoothed; later stages
        sit where the rolling forecast puts them.
      </p>
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
  canEdit = true,
  adminContact = null,
}) {
  // The bounded tolerance dial: session-only, opens on Standard every visit,
  // persisted nowhere.
  const [toleranceKey, setToleranceKey] = useState(DEFAULT_TOLERANCE_KEY);
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const tabRefs = useRef({});

  // The Schedule tab's two controls, session-only like the dial: the
  // full-schedule disclosure (the high-level breakdown shows first, every
  // visit) and the Register or Timeline view of the full set.
  const [fullOpen, setFullOpen] = useState(false);
  const [scheduleView, setScheduleView] = useState(SCHEDULE_VIEWS[0].key);

  // The three engines over the loaded data. Today and the tolerance are
  // inputs, read upstream, never the clock here. Only the RAG derivation
  // reads the tolerance, so only it re-runs when the dial moves.
  const progress = useMemo(
    () => deriveProgress(programme, metView),
    [programme, metView]
  );
  const rag = useMemo(
    () => deriveRAG(programme, metView, todayIso, toleranceWeeksFor(toleranceKey)),
    [programme, metView, todayIso, toleranceKey]
  );
  const forecast = useMemo(
    () => deriveForecast(programme, metView, todayIso),
    [programme, metView, todayIso]
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

  // The Schedule tab's faces, derived from the same engine outputs by the
  // pure schedule model: one row set joining the frozen baseline, the
  // forecast tree, and the RAG flags (so the dial's re-run restyles the
  // flagged rows live), the fixed high-level filter over it, the Register's
  // stage grouping, and the Timeline's positions from the dates alone. No
  // new load and no second clock read.
  const rows = useMemo(
    () => scheduleRows(programme, forecast, rag),
    [programme, forecast, rag]
  );
  const highLevel = useMemo(() => highLevelRows(rows), [rows]);
  const stageGroups = useMemo(() => registerGroups(rows), [rows]);
  const timeline = useMemo(
    () => timelineLayout(rows, todayIso),
    [rows, todayIso]
  );

  const lockedOn = formatStamp(baselineLockedAt);
  const completionVariance = varianceLabel(completion.varianceWeeks);
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
            <RagDot colour={status.colour} large />
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

      {/* ── The colour key and the tolerance dial: a quiet strip under the
             band, not part of the pinned mass. ── */}
      <div className={styles.keyStrip}>
        <ul className={styles.key} aria-label="Colour key">
          {COLOUR_KEY.map((entry) => (
            <li key={entry.colour} className={styles.keyItem}>
              <RagDot colour={entry.colour} decorative />
              <span className={styles.keyText}>
                <b>{entry.label}.</b> {entry.line}
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
            <article
              className={`${styles.card} ${
                nextGateSlipping ? styles.cardSignal : ''
              }`}
            >
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
                      nextGateSlipping ? styles.cardFigureSignal : ''
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
                    item.colour === 'red' ? styles.cardDanger : styles.cardSignal
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
                        label={`Contributes ${item.colour}`}
                      />
                      {behindLabel(item.weeksBehind) && (
                        <span
                          className={`${styles.cardFigure} ${
                            item.colour === 'red'
                              ? styles.cardFigureDanger
                              : styles.cardFigureSignal
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
               the month ahead, soonest first. ── */}
        <section className={styles.block} aria-labelledby="overview-lookahead">
          <div className={styles.blockHead}>
            <h2 id="overview-lookahead" className={styles.blockTitle}>
              Next 30 days
            </h2>
            <span className={styles.blockMeta}>by forecast date</span>
          </div>
          {lookahead.length === 0 ? (
            <div className={styles.blockEmpty}>
              <p className={styles.blockEmptyLead}>A quiet month ahead.</p>
              <p className={styles.blockEmptyNote}>
                No unmet point has a forecast date in the next 30 days.
              </p>
            </div>
          ) : (
            <ul className={styles.look}>
              {lookahead.map((item) => (
                <li key={item.key} className={styles.lookRow}>
                  <span className={`${styles.lookDate} tnum`}>
                    {formatShort(item.forecastDate)}
                  </span>
                  <span className={styles.lookBody}>
                    <span className={styles.lookName}>
                      {item.name ?? item.key}
                    </span>
                    <span className={styles.lookMeta}>
                      {item.kind}
                      {item.stage != null ? ` · stage ${item.stage}` : ''}
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div
        role="tabpanel"
        id="panel-schedule"
        aria-labelledby="tab-schedule"
        hidden={activeTab !== 'schedule'}
        className={styles.panel}
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
            {/* ── The high-level breakdown, the default: the fixed governance
                   filter, the gates always, every critical milestone always,
                   and anything flagged. ── */}
            <section
              className={styles.block}
              aria-labelledby="schedule-highlevel"
            >
              <div className={styles.blockHead}>
                <h2 id="schedule-highlevel" className={styles.blockTitle}>
                  High-level breakdown
                </h2>
                <span className={`${styles.blockMeta} tnum`}>
                  {highLevel.length} of {rows.length} points
                </span>
              </div>
              {highLevel.length === 0 ? (
                <div className={styles.blockEmpty}>
                  <p className={styles.blockEmptyLead}>
                    Nothing rises to the breakdown.
                  </p>
                  <p className={styles.blockEmptyNote}>
                    No gate, no critical milestone, and nothing flagged at
                    this tolerance. The full schedule below holds every point.
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.pointsTable}>
                    <PointsHeader />
                    <ul className={styles.pointRows}>
                      {highLevel.map((row) => (
                        <PointRow key={row.key} row={row} />
                      ))}
                    </ul>
                  </div>
                  <p className={styles.tableNote}>
                    The fixed filter: the gates always, every critical
                    milestone always, and anything flagged. Flagged rows carry
                    the colour they contribute and follow the slip tolerance
                    above. Baseline is the locked v{baselineVersion} date;
                    Current is the forecast, or the actual once met.
                  </p>
                </>
              )}
            </section>

            {/* ── The full schedule, behind its control: every point, as a
                   register or on a timeline, two views of one model. ── */}
            <section className={styles.block} aria-labelledby="schedule-full">
              <div className={styles.blockHead}>
                <h2 id="schedule-full" className={styles.blockTitle}>
                  Full schedule
                </h2>
                <button
                  type="button"
                  className={styles.fullToggle}
                  aria-expanded={fullOpen}
                  aria-controls="schedule-full-body"
                  onClick={() => setFullOpen((open) => !open)}
                >
                  {fullOpen
                    ? 'Hide the full schedule'
                    : `Show all ${rows.length} points`}
                </button>
              </div>
              {fullOpen && (
                <div id="schedule-full-body">
                  <div
                    className={styles.viewToggle}
                    role="group"
                    aria-label="Full schedule view"
                  >
                    {SCHEDULE_VIEWS.map((view) => (
                      <button
                        key={view.key}
                        type="button"
                        className={`${styles.viewBtn} ${
                          scheduleView === view.key ? styles.viewBtnOn : ''
                        }`}
                        aria-pressed={scheduleView === view.key}
                        onClick={() => setScheduleView(view.key)}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                  {scheduleView === 'register' ? (
                    <div className={styles.pointsTable}>
                      <PointsHeader />
                      {stageGroups.map((group) => (
                        <div
                          key={group.stage ?? 'unstaged'}
                          className={styles.stageGroup}
                        >
                          <h3 className={styles.stageGroupHead}>
                            <span
                              className={`${styles.stageGroupNum} tnum`}
                            >
                              Stage {group.stage}
                            </span>
                            {group.stageName && (
                              <span className={styles.stageGroupName}>
                                {group.stageName}
                              </span>
                            )}
                          </h3>
                          <ul className={styles.pointRows}>
                            {group.rows.map((row) => (
                              <PointRow key={row.key} row={row} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <TimelinePlot layout={timeline} />
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

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
import styles from './ProgrammeTracking.module.css';

/**
 * ProgrammeTracking - the tracking surface shell, its hero band (Programme
 * module Phase 3.5), and the Overview tab's content (Phase 3.6). The daily
 * face of the module: the pinned summary band with its five co-equal tiles,
 * the colour key, the bounded tolerance dial, the Overview tab (the Next Gate
 * card, the Needs attention list, and the Next 30 days lookahead), and the
 * Schedule tab as a shell whose content lands in the next sub-step.
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
 * count, the flagged list, and the Needs attention block respond
 * immediately; the percent and the forecast never read it.
 *
 * The Overview tab reads the engine outputs this component already computed
 * through the pure overviewModel helpers: no new load, no re-derivation, and
 * no second reading of the clock. It is read-only: marking a milestone met is
 * a later sub-step and no write happens anywhere on this surface.
 */

// The two tabs. The tab mechanism is real and final; the Overview carries its
// content (3.6), the Schedule panel is a shell whose content is the next
// sub-step.
const TABS = Object.freeze([
  Object.freeze({ key: 'overview', label: 'Overview' }),
  Object.freeze({ key: 'schedule', label: 'Schedule' }),
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

      {/* ── The two tabs. The mechanism is real and final; the panels are
             shells whose content is the next two sub-steps. ── */}
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
        <div className={styles.panelShell}>
          <p className={styles.panelShellLead}>The Schedule lands here next.</p>
          <p className={styles.panelShellNote}>
            The high-level breakdown, then the full register and timeline,
            arrive in the coming sub-steps. The summary band above is already
            live.
          </p>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { deriveSeverity } from '../../../../lib/engine/severity';
import { HEALTH_STATES } from '../../../../lib/engine/objectiveHealth';
import { STATUS_OPTIONS as RISK_STATUS_OPTIONS } from '../risk/riskModel';
import { STATUS_OPTIONS as ACTION_STATUS_OPTIONS } from '../actions/actionModel';
import { deriveDashboard } from './dashboardModel';
import {
  PAGE_TITLE,
  PAGE_SUB,
  GROUP_LINKS,
  MILESTONE_FLAG_WORDS,
  objectiveName,
  classificationWord,
  stateLabel,
  stateSentence,
  supportingLines,
  factStage,
  factComplete,
  factForecast,
  factGate,
  reasonLine,
  dateLine,
  driftLine,
  formatDate,
  ATTENTION_HEADING,
  ATTENTION_EMPTY,
  attentionTag,
  attentionReason,
  attentionFooter,
} from './dashboardRead';
import styles from './ProjectDashboard.module.css';

/**
 * ProjectDashboard (M9.2 Bands 1 and 2, M9.3 Band 3). The objective lens
 * rendered: Band 1 is the read (the state sentence, up to two supporting
 * lines, and four facts), Band 2 is objective health, five rows organised
 * protected block first, each expanding IN PLACE to list every item tagged to
 * that objective across the three modules. Band 3 is "what needs you now", the
 * one ranked, deduplicated attention list across all three modules, silent
 * (one calm line, no list frame) when nothing is flagged.
 *
 * READ-ONLY, WHOLLY. No write action exists anywhere on this page: every
 * interaction is either the in-place expansion or a navigation link (Band 2's
 * one-per-group links, Band 3's whole-row deep links) into the module that
 * owns the items. The dashboard routes, it does not act.
 *
 * Everything rendered comes from two places: deriveDashboard (the display
 * model over the engines) and dashboardRead (the copy sheet). This component
 * holds no derivation and no sentence of its own.
 *
 * THE HIERARCHY (M9.2b). The state is the news: it changes every day and is
 * the only reason the page exists. Classification is context: set once at
 * initiation, it never moves, so it renders as a small dim word beside the
 * objective name, never as a chip (the Risk register and the Action Log keep
 * CriticalityChip, because there criticality IS the news about the item).
 * The state renders twice on a row: as the left edge, one vertical line the
 * eye scans down the band so the worst row finds you without reading a word,
 * and as the row's loud label. Red and amber are separated by WEIGHT, never
 * by a second hue (a bar versus a hairline, filled versus outlined): amber
 * stays the one colour spend, and green spends nothing, because words carry
 * good news and colour carries bad. Band 1's read card takes the same edge
 * grammar, heavier: the project is the parent the objectives nest beneath.
 */

// The row's presentation classes, keyed by the engine's colour, which maps
// one-to-one onto the ladder rungs: red = Compromised/Exhausted, amber =
// Under pressure/Absorbing, green = Holding, neutral = Not scored.
const ROW_EDGE_CLASS = {
  green: null,
  amber: 'rowEdgeLine',
  red: 'rowEdgeBar',
  neutral: 'rowEdgeDashed',
};

const STATE_CLASS = {
  green: 'stateQuiet',
  amber: 'stateOutlined',
  red: 'stateFilled',
  neutral: 'stateDashed',
};

// Band 1's read card: the same edge grammar as the rows, heavier. Green is
// deliberately absent: a green project renders NO edge.
const CARD_EDGE_CLASS = {
  green: null,
  amber: 'cardEdgeLine',
  red: 'cardEdgeBar',
  neutral: 'cardEdgeDashed',
};

const SEVERITY_CLASS = {
  serious: 'sevSerious',
  moderate: 'sevModerate',
  minor: 'sevMinor',
  unscored: 'sevUnscored',
};

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? value;
}

// One expandable Band 2 row. The header button toggles the expansion in
// place; no new route. Protected rows carry full visual weight, flexible
// rows are quieter: proportional monitoring rendered in typography.
function ObjectiveRow({ row, hrefs }) {
  const [open, setOpen] = useState(false);

  const name = objectiveName(row.type);
  const reason = reasonLine(row);
  const date = dateLine(row);
  const drift = driftLine(row);
  const notScored = row.state === HEALTH_STATES.NOT_SCORED;

  const { risks, actions, milestones } = row.items;
  const hasItems =
    risks.length > 0 || actions.length > 0 || milestones.length > 0;

  // A row with nothing tagged to it has nothing to expand: the header stays
  // a plain heading and the Not scored body link carries the routing.
  const headContent = (
    <>
      <span className={styles.rowTags}>
        <span className={styles.rowName}>{name}</span>
        <span className={styles.rowClass}>{classificationWord(row)}</span>
      </span>
      <span className={styles.rowAside}>
        <span
          className={`${styles.rowState} ${styles[STATE_CLASS[row.colour]]}`}
        >
          {stateLabel(row)}
        </span>
        {hasItems && (
          <svg
            className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path
              d="M2 4l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </>
  );

  const edge = ROW_EDGE_CLASS[row.colour];

  return (
    <li
      className={`${styles.row} ${row.isProtected ? styles.rowProtected : styles.rowFlexible}${edge ? ` ${styles[edge]}` : ''}`}
    >
      {hasItems ? (
        <button
          type="button"
          className={styles.rowHead}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {headContent}
        </button>
      ) : (
        <div className={`${styles.rowHead} ${styles.rowHeadStatic}`}>
          {headContent}
        </div>
      )}

      <div className={styles.rowBody}>
        {reason && <p className={styles.reason}>{reason}</p>}
        {date && <p className={styles.dateLine}>{date}</p>}
        {drift && <p className={styles.driftLine}>{drift}</p>}
        {notScored && (
          <Link href={hrefs.risk} className={styles.rowLink}>
            {GROUP_LINKS.risks}
          </Link>
        )}
      </div>

      {open && hasItems && (
        <div className={styles.expansion}>
          {risks.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupHead}>Risks</p>
              <ul className={styles.itemList}>
                {risks.map((r) => {
                  const severity = deriveSeverity(r.likelihood, r.impact);
                  return (
                    <li key={r.id} className={styles.item}>
                      <p className={styles.itemDesc}>{r.description}</p>
                      <span className={styles.itemMeta}>
                        <span
                          className={`${styles.sev} ${styles[SEVERITY_CLASS[severity.key]]}`}
                        >
                          {severity.label}
                        </span>
                        <span className={styles.itemStatus}>
                          {labelFor(RISK_STATUS_OPTIONS, r.status)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link href={hrefs.risk} className={styles.groupLink}>
                {GROUP_LINKS.risks}
              </Link>
            </div>
          )}

          {actions.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupHead}>Actions</p>
              <ul className={styles.itemList}>
                {actions.map((a) => (
                  <li key={a.id} className={styles.item}>
                    <p className={styles.itemDesc}>{a.description}</p>
                    <span className={styles.itemMeta}>
                      <span className={styles.itemStatus}>
                        {labelFor(ACTION_STATUS_OPTIONS, a.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={hrefs.actions} className={styles.groupLink}>
                {GROUP_LINKS.actions}
              </Link>
            </div>
          )}

          {milestones.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupHead}>Milestones</p>
              <ul className={styles.itemList}>
                {milestones.map((m) => (
                  <li key={m.key} className={styles.item}>
                    <p className={styles.itemDesc}>{m.name}</p>
                    <span className={styles.itemMeta}>
                      <span className={styles.itemStatus}>
                        Stage {m.stage}
                      </span>
                      {m.baselineDate && (
                        <span className={styles.itemStatus}>
                          {formatDate(m.baselineDate)}
                        </span>
                      )}
                      {m.flag && (
                        <span
                          className={`${styles.msFlag} ${m.flag === 'red' ? styles.msFlagRed : styles.msFlagAmber}`}
                        >
                          {MILESTONE_FLAG_WORDS[m.flag]}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={hrefs.programme} className={styles.groupLink}>
                {GROUP_LINKS.milestones}
              </Link>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// One Band 3 attention row. The WHOLE row deep-links to the item in its home
// module (a gate to the Programme, which no single module owns). Full weight
// for protected-objective items and for a gate (which answers to all five);
// flexible-objective items are quieter, the same proportional typography as
// Band 2. No write action: the dashboard routes, it does not act.
function AttentionRow({ item, href }) {
  const tag = attentionTag(item);
  const reason = attentionReason(item);
  return (
    <li
      className={`${styles.attnRow} ${item.isProtected === false ? styles.attnFlexible : styles.attnProtected}`}
    >
      <Link href={href} className={styles.attnLink}>
        <span className={styles.attnMain}>
          <span className={styles.attnTitle}>{item.title}</span>
          <span className={styles.attnMeta}>
            <span className={styles.attnTag}>{tag}</span>
            <span className={styles.attnReason}>{reason}</span>
          </span>
          {item.raisedFrom && (
            <span className={styles.attnRaised}>{item.raisedFrom}</span>
          )}
        </span>
        <svg
          className={styles.attnChevron}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <path
            d="M5 3l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </li>
  );
}

export default function ProjectDashboard({
  projectId,
  projectName,
  workspaceHref,
  objectives,
  risks,
  actions,
  programme,
  metView,
  todayIso,
  currentStage,
  targetCompletionDate,
}) {
  const hrefs = useMemo(
    () => ({
      risk: `/pulse/app/risk?project=${projectId}`,
      actions: `/pulse/app/actions?project=${projectId}`,
      programme: `/pulse/app/programme?project=${projectId}`,
      programmeSetup: `/pulse/app/programme/setup?project=${projectId}`,
    }),
    [projectId]
  );

  // The whole read, one derivation. Today arrived from the server; nothing
  // here reads the clock, and nothing here writes.
  const dashboard = useMemo(
    () =>
      deriveDashboard({
        objectives,
        risks,
        actions,
        programme,
        metPoints: metView,
        todayIso,
        targetCompletionDate,
        currentStage,
      }),
    [
      objectives,
      risks,
      actions,
      programme,
      metView,
      todayIso,
      targetCompletionDate,
      currentStage,
    ]
  );

  const { health, rows, facts, attention } = dashboard;

  const sentence = stateSentence(health);
  const support = supportingLines(health, {
    hasBaseline: facts.hasBaseline,
    openRiskCount: risks.filter((r) => r.status !== 'closed').length,
    hrefs,
  });
  const projectColour =
    health.project.state === 'no_state' ? 'neutral' : health.project.state;

  const factList = [
    factStage(facts.currentStage),
    factComplete(facts.percentComplete),
    factForecast(facts.forecastCompletion, facts.targetCompletionDate),
    factGate(facts.nextGate, facts.readiness, facts.hasBaseline),
  ];

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
        Back to the project
      </Link>
      <p className={styles.eyebrow}>Dashboard module</p>
      <h1 className={styles.title}>{PAGE_TITLE}</h1>
      <p className={styles.projectName}>{projectName}</p>
      <p className={styles.sub}>{PAGE_SUB}</p>

      {/* Band 1: the read. The project state lives on the card's left edge,
          the rows' grammar rendered heavier; a green project renders no edge
          at all, so a green card can honestly sit above an amber-edged
          flexible row that is absorbing pressure for it. */}
      <section
        className={`${styles.readBand}${CARD_EDGE_CLASS[projectColour] ? ` ${styles[CARD_EDGE_CLASS[projectColour]]}` : ''} riseIn`}
        aria-label="The read"
      >
        <p className={styles.stateSentence}>{sentence}</p>

        {support.length > 0 && (
          <div className={styles.support}>
            {support.map((line, i) =>
              line.href ? (
                <p key={i} className={styles.supportLine}>
                  <Link href={line.href} className={styles.supportLink}>
                    {line.text}
                  </Link>
                </p>
              ) : (
                <p key={i} className={styles.supportLine}>
                  {line.text}
                </p>
              )
            )}
          </div>
        )}

        <dl className={styles.facts}>
          {factList.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factBody}>
                <span className={styles.factValue}>{fact.value}</span>
                {fact.detail && (
                  <span className={styles.factDetail}>{fact.detail}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Band 2: objective health. The product. */}
      <section aria-label="Objective health">
        <p className={styles.bandLabel}>Objective health</p>
        <ul className={styles.register}>
          {rows.map((row) => (
            <ObjectiveRow key={row.id} row={row} hrefs={hrefs} />
          ))}
        </ul>
      </section>

      {/* Band 3: what needs you now. The one ranked, deduplicated attention
          list across the three modules. Silent when nothing is flagged: one
          calm line and no list frame, because a heading over an empty list
          reads as broken. */}
      <section className={styles.attnBand} aria-label={ATTENTION_HEADING}>
        <p className={styles.bandLabel}>{ATTENTION_HEADING}</p>
        {attention.total === 0 ? (
          <p className={styles.attnEmpty}>{ATTENTION_EMPTY}</p>
        ) : (
          <>
            <ul className={styles.register}>
              {attention.items.map((item) => (
                <AttentionRow
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  href={hrefs[item.module]}
                />
              ))}
            </ul>
            {attention.overflow > 0 && (
              <p className={styles.attnFooter}>
                <Link
                  href={hrefs[attention.overflowModule]}
                  className={styles.attnFooterLink}
                >
                  {attentionFooter(attention.overflow)}
                </Link>
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LADDER_STATUSES } from '../../../../lib/engine/objectiveLadder';
import { deriveDashboard } from './dashboardModel';
import {
  PAGE_TITLE,
  PAGE_SUB,
  ladderStatusLabel,
  supportingLines,
  factStage,
  factComplete,
  factForecast,
  factGate,
  dateLine,
  driftLine,
  ATTENTION_HEADING,
  ATTENTION_EMPTY,
  attentionTag,
  attentionReason,
  attentionFooter,
} from './dashboardRead';
import styles from './ProjectDashboard.module.css';

/**
 * ProjectDashboard (Note 20): the cockpit, and after set-up the project's
 * landing page. One question at a glance: are my objectives being met, and
 * what needs me now.
 *
 * THE BANDS. A summary strip (stage, percent complete, forecast against
 * target, next gate: the instrument row, mono numerals over hairlines, not a
 * card). Then the hero: objective health on the four-rung ladder plus the
 * honest Not scored state, the protected block leading, each row carrying
 * its status and its cited driver and drilling into the module that acts on
 * it. Then the needs-you-now queue, capped to the top five as pointers into
 * the modules. Then the module rail: the dashboard absorbs the hub's role,
 * so Brief, Programme, Action Log and Risk register are reached from here.
 *
 * READ-ONLY, WHOLLY. No write action exists anywhere on this page: every
 * interaction is a navigation link into the module that owns the work. The
 * cockpit points; the modules act. That is also why no full item lists
 * render here: the same risks used to appear as lists on three surfaces,
 * and this surface now carries statuses and pointers only.
 *
 * COLOUR IS TIED TO THE LADDER and nothing else. Compromised, breach in
 * fact, is the only red spend (the danger token). At risk and Slipping
 * share the amber voice, separated by weight. Healthy is a quiet word:
 * words carry good news, colour carries bad. Not scored is the dashed
 * neutral, blindness reported, never coloured.
 *
 * Everything rendered comes from two places: deriveDashboard (the display
 * model over the engines) and dashboardRead (the copy sheet). This component
 * holds no derivation and no sentence of its own.
 */

// The row's presentation classes, keyed by ladder status.
const ROW_EDGE_CLASS = {
  [LADDER_STATUSES.HEALTHY]: null,
  [LADDER_STATUSES.AT_RISK]: 'rowEdgeThin',
  [LADDER_STATUSES.SLIPPING]: 'rowEdgeLine',
  [LADDER_STATUSES.COMPROMISED]: 'rowEdgeBar',
  [LADDER_STATUSES.NOT_SCORED]: 'rowEdgeDashed',
};

const STATUS_CLASS = {
  [LADDER_STATUSES.HEALTHY]: 'statusQuiet',
  [LADDER_STATUSES.AT_RISK]: 'statusOutlinedDim',
  [LADDER_STATUSES.SLIPPING]: 'statusOutlined',
  [LADDER_STATUSES.COMPROMISED]: 'statusDanger',
  [LADDER_STATUSES.NOT_SCORED]: 'statusDashed',
};

function Chevron({ className }) {
  return (
    <svg
      className={className}
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
  );
}

// One ladder row. The status is the news and owns the row's colour; the
// driver is the cited fact beneath the name. A row with a module to act in
// is one whole-row link into it; a healthy row has nothing to act on and
// stays static.
function LadderRow({ row, healthRow, hrefs }) {
  const edge = ROW_EDGE_CLASS[row.status];
  const date =
    row.trigger.key === 'forecast_past_target' ? null : dateLine(healthRow);
  const drift = driftLine(healthRow);

  const body = (
    <>
      <span className={styles.ladderMain}>
        <span className={styles.ladderName}>{row.name}</span>
        <span className={styles.ladderDriver}>{row.driver}</span>
        {date && <span className={styles.ladderDate}>{date}</span>}
        {drift && <span className={styles.ladderDrift}>{drift}</span>}
      </span>
      <span className={styles.ladderAside}>
        <span
          className={`${styles.ladderStatus} ${styles[STATUS_CLASS[row.status]]}`}
        >
          {ladderStatusLabel(row)}
        </span>
        {row.actsIn && <Chevron className={styles.ladderChevron} />}
      </span>
    </>
  );

  const rowClass = `${styles.ladderRow} ${
    row.isProtected ? styles.ladderProtected : styles.ladderFlexible
  }${edge ? ` ${styles[edge]}` : ''}`;

  if (row.actsIn) {
    return (
      <li className={rowClass}>
        <Link href={hrefs[row.actsIn]} className={styles.ladderLink}>
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li className={rowClass}>
      <div className={styles.ladderStatic}>{body}</div>
    </li>
  );
}

// One attention row. The WHOLE row deep-links to the item in its home
// module. Full weight for protected-objective items and for a gate;
// flexible-objective items are quieter, the same proportional typography as
// the ladder.
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
        <Chevron className={styles.attnChevron} />
      </Link>
    </li>
  );
}

// The module rail: the hub's navigation, absorbed (Note 20). Four
// destinations, one register.
const MODULES = [
  { key: 'brief', title: 'Brief', desc: 'The locked baseline' },
  { key: 'programme', title: 'Programme', desc: 'Schedule and tracking' },
  { key: 'actions', title: 'Action Log', desc: 'What is being done' },
  { key: 'risk', title: 'Risk register', desc: 'Threats to objectives' },
];

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
      brief: `/pulse/app/initiate?project=${projectId}`,
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

  const { health, ladderRows, facts, attention } = dashboard;

  // The health rows by id, for the Time date line and the drift notice the
  // ladder rows do not carry themselves.
  const healthById = useMemo(() => {
    const map = {};
    for (const row of health.objectives) map[row.id] = row;
    return map;
  }, [health]);

  const support = supportingLines(health, {
    hasBaseline: facts.hasBaseline,
    openRiskCount: risks.filter((r) => r.status !== 'closed').length,
    hrefs,
  });

  const factList = [
    factStage(facts.currentStage),
    factComplete(facts.percentComplete),
    factForecast(facts.forecastCompletion, facts.targetCompletionDate),
    factGate(facts.nextGate, facts.readiness, facts.hasBaseline),
  ];

  const protectedRows = ladderRows.filter((r) => r.isProtected);
  const flexibleRows = ladderRows.filter((r) => !r.isProtected);

  return (
    <main className={`container ${styles.page}`} id="main-content">
      <Link href="/pulse/app" className={styles.backLink}>
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
        All projects
      </Link>

      <header className={styles.head}>
        <p className={styles.eyebrow}>{PAGE_TITLE}</p>
        <h1 className={styles.title}>{projectName}</h1>
        <p className={styles.sub}>{PAGE_SUB}</p>
      </header>

      {/* The summary strip: the instrument row. Four facts over hairlines,
          mono numerals, not a card. */}
      <dl className={styles.strip} aria-label="Project summary">
        {factList.map((fact) => (
          <div key={fact.label} className={styles.stripCell}>
            <dt className={styles.stripLabel}>{fact.label}</dt>
            <dd className={styles.stripBody}>
              <span className={styles.stripValue}>{fact.value}</span>
              {fact.detail && (
                <span className={styles.stripDetail}>{fact.detail}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* The hero: objective health on the ladder. The protected block leads;
          proportional monitoring rendered in structure and type. */}
      <section aria-label="Objective health" className={styles.heroBand}>
        <h2 className={styles.bandLabel}>Objective health</h2>
        <div className={styles.ladderPanel}>
          {protectedRows.length > 0 && (
            <section aria-label="Protected objectives">
              <h3 className={styles.ladderGroup}>Protected</h3>
              <ul className={styles.ladder}>
                {protectedRows.map((row) => (
                  <LadderRow
                    key={row.id}
                    row={row}
                    healthRow={healthById[row.id]}
                    hrefs={hrefs}
                  />
                ))}
              </ul>
            </section>
          )}
          {flexibleRows.length > 0 && (
            <section aria-label="Flexible objectives">
              <h3 className={styles.ladderGroup}>Flexible</h3>
              <ul className={styles.ladder}>
                {flexibleRows.map((row) => (
                  <LadderRow
                    key={row.id}
                    row={row}
                    healthRow={healthById[row.id]}
                    hrefs={hrefs}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>

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
      </section>

      {/* The needs-you-now queue: capped pointers into the modules, silent
          (one calm line, no list frame) when nothing is flagged. */}
      <section className={styles.attnBand} aria-label={ATTENTION_HEADING}>
        <h2 className={styles.bandLabel}>{ATTENTION_HEADING}</h2>
        {attention.total === 0 ? (
          <p className={styles.attnEmpty}>{ATTENTION_EMPTY}</p>
        ) : (
          <>
            <ul className={styles.attnList}>
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

      {/* The module rail: the hub's role, absorbed. */}
      <nav className={styles.railBand} aria-label="Modules">
        <h2 className={styles.bandLabel}>Modules</h2>
        <ul className={styles.rail}>
          {MODULES.map((m) => (
            <li key={m.key} className={styles.railItem}>
              <Link href={hrefs[m.key]} className={styles.railLink}>
                <span className={styles.railMain}>
                  <span className={styles.railTitle}>{m.title}</span>
                  <span className={styles.railDesc}>{m.desc}</span>
                </span>
                <Chevron className={styles.railChevron} />
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.railFoot}>
          <Link href={workspaceHref} className={styles.railFootLink}>
            Open the workspace
          </Link>
        </p>
      </nav>
    </main>
  );
}

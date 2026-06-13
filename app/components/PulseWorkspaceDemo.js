'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PulseWorkspaceDemo.module.css';

/* ─────────────────────────────────────────
   Band 3: PULSE, shown as the live application.

   A light reproduction of the real workspace, lit
   on the ink. Five live module tiles open into real
   module screens. Left alone it runs a calm tour on
   a faux cursor; the moment the visitor hovers or
   clicks, it hands them control and resumes only
   after they leave. Reduced motion gets the launcher
   at rest, still clickable, no tour.

   Faithful to the product, seeded with the sample
   Holloway Place project. Self-contained: no auth,
   no data, no app imports.
───────────────────────────────────────── */

function ActionLogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.4 12.2l2.5 2.5 4.7-5.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BriefIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12.5h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RiskIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 8.5v4M12 15.5v.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function ProgrammeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="7" r="1.6" fill="currentColor" />
      <circle cx="14" cy="12" r="1.6" fill="currentColor" />
      <circle cx="10" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 5h6v5H5zM13 5h6v5h-6zM5 14h6v5H5zM13 14h6v5h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M9 11L5 7l4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TILES = [
  { key: 'brief', title: 'Brief', foot: 'Baseline locked', Icon: BriefIcon, desc: 'The initiation flow and the locked baseline.' },
  { key: 'actions', title: 'Action Log', foot: '2 need your response', hot: true, Icon: ActionLogIcon, desc: 'Everything that needs you, in one place.' },
  { key: 'risk', title: 'Risk register', foot: '4 open · 2 critical', Icon: RiskIcon, desc: 'Score and monitor risks to your objectives.' },
  { key: 'programme', title: 'Programme', foot: '1 milestone at risk', hot: true, Icon: ProgrammeIcon, desc: 'Milestones and the critical path.' },
  { key: 'dashboard', title: 'Dashboard', foot: 'Stage 2 · 82% on track', wide: true, Icon: DashboardIcon, desc: 'Stage, health, risks and actions on one screen.' },
];

const RISKS = [
  { crit: 'Critical', text: 'Construction costs exceed the fixed budget', meta: 'Serious', hot: true },
  { crit: 'Critical', text: 'Funding tranche delayed past construction start', meta: 'Serious', hot: true },
  { crit: 'Critical', text: 'Planning conditions force a redesign', meta: 'Watch', hot: true },
  { crit: 'Standard', text: 'Sales slower than the spring forecast', meta: 'Quiet' },
];
const TRACKED = [
  { crit: 'Critical', text: 'Issue the two-stage tender', meta: 'In progress' },
  { crit: 'Standard', text: 'Book pre-application planning advice', meta: 'Open' },
];
const OBJ = [
  { name: 'Scope', c: 'Non-negotiable' },
  { name: 'Cost', c: 'Non-negotiable' },
  { name: 'Time', c: 'Flexible' },
];
const MILES = [
  { name: 'Funding close', x: 3, w: 24 },
  { name: 'Planning approval', x: 20, w: 30 },
  { name: 'Contractor appointed', x: 40, w: 30, crit: true },
  { name: 'Practical completion', x: 64, w: 33 },
];
const TODAY = 46;
const KPIS = [
  { num: '2', label: 'Current stage' },
  { num: '2', label: 'Critical risks', hot: true },
  { num: '82%', label: 'On track' },
];
const HEALTH = [
  { name: 'Scope' },
  { name: 'Cost', risk: true },
  { name: 'Time' },
  { name: 'Funding' },
];

const CYCLE = ['dashboard', 'risk', 'actions'];

export default function PulseWorkspaceDemo({ className }) {
  const [screen, setScreen] = useState('home');
  const [cur, setCur] = useState({ x: 44, y: 44, down: false, show: false });

  const frameRef = useRef(null);
  const tgt = useRef({});
  const timers = useRef([]);
  const resume = useRef(null);
  const demoRef = useRef(false);
  const inRef = useRef(false);
  const reduceRef = useRef(false);
  const hoverRef = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const at = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };
  const stop = () => reduceRef.current || !demoRef.current || !inRef.current;

  const moveTo = (id) => {
    const el = tgt.current[id];
    const f = frameRef.current;
    if (!el || !f) return;
    const r = el.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    setCur((c) => ({ ...c, x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height / 2, show: !hoverRef.current }));
  };
  const press = () => {
    setCur((c) => ({ ...c, down: true }));
    at(() => setCur((c) => ({ ...c, down: false })), 220);
  };

  const runStep = (i) => {
    if (stop()) return;
    const key = CYCLE[i % CYCLE.length];
    at(() => {
      if (stop()) return;
      moveTo('tile-' + key);
      at(() => {
        if (stop()) return;
        press();
        setScreen(key);
        at(() => {
          if (stop()) return;
          moveTo('back');
          at(() => {
            if (stop()) return;
            press();
            setScreen('home');
            at(() => {
              if (!stop()) runStep(i + 1);
            }, 950);
          }, 820);
        }, 2200);
      }, 780);
    }, 380);
  };

  const startDemo = () => {
    if (reduceRef.current || !inRef.current) return;
    clearTimers();
    setScreen('home');
    demoRef.current = true;
    at(() => runStep(0), 750);
  };
  const stopDemo = () => {
    clearTimers();
    demoRef.current = false;
    setCur((c) => ({ ...c, show: false }));
  };
  const scheduleResume = () => {
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(startDemo, 6500);
  };

  const openModule = (key) => {
    stopDemo();
    setScreen(key);
    scheduleResume();
  };
  const goHome = () => {
    stopDemo();
    setScreen('home');
    scheduleResume();
  };
  // Hovering hides the faux cursor (so two cursors never show) but lets the
  // tour keep advancing screens, so it never looks frozen. Only a click /
  // keyboard focus actually hands over control.
  const onEnter = () => {
    hoverRef.current = true;
    setCur((c) => ({ ...c, show: false }));
  };
  const onLeave = () => {
    hoverRef.current = false;
  };
  const pauseForUser = () => {
    stopDemo();
    scheduleResume();
  };

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(
      ([e]) => {
        inRef.current = e.isIntersecting;
        if (e.isIntersecting) {
          if (!demoRef.current) startDemo();
        } else {
          stopDemo();
        }
      },
      { threshold: 0.25 }
    );
    const node = frameRef.current;
    if (node) io.observe(node);
    return () => {
      io.disconnect();
      clearTimers();
      if (resume.current) clearTimeout(resume.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chip = (crit) =>
    `${styles.chip} ${crit === 'Critical' || crit === 'Non-negotiable' ? styles.chipCritical : styles.chipStandard}`;

  const Mhead = (title) => (
    <div className={styles.mhead}>
      <button
        ref={(el) => (tgt.current['back'] = el)}
        className={styles.back}
        onClick={goHome}
        onFocus={onEnter}
        aria-label="Back to workspace"
      >
        <BackIcon /> Back
      </button>
      <span className={styles.mtitle}>{title}</span>
    </div>
  );

  const renderScreen = () => {
    if (screen === 'risk') {
      return (
        <div className={styles.screen} key="risk">
          {Mhead('Risk register')}
          <div className={styles.list}>
            {RISKS.map((r, i) => (
              <div className={styles.row} key={i}>
                <span className={chip(r.crit)}>{r.crit}</span>
                <span className={styles.rowText}>{r.text}</span>
                <span className={`${styles.rowMeta} ${r.hot ? styles.rowMetaHot : ''}`}>{r.meta}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (screen === 'actions') {
      return (
        <div className={styles.screen} key="actions">
          {Mhead('Action Log')}
          <div className={styles.respondBand}>
            <span className={styles.bandLabel}>Needs your response</span>
            <div className={styles.bandRow}>
              <span className={`${styles.chip} ${styles.chipCritical}`}>Critical</span>
              <span className={styles.rowText}>Confirm the funding conditions with the lender</span>
              <span className={`${styles.respondBtn} ${styles.respondPulse}`}>Respond</span>
            </div>
          </div>
          <span className={styles.trackedLabel}>Tracked</span>
          <div className={styles.list}>
            {TRACKED.map((a, i) => (
              <div className={styles.row} key={i}>
                <span className={chip(a.crit)}>{a.crit}</span>
                <span className={styles.rowText}>{a.text}</span>
                <span className={styles.rowMeta}>{a.meta}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (screen === 'brief') {
      return (
        <div className={styles.screen} key="brief">
          {Mhead('Brief')}
          <div className={styles.briefDoc}>
            <span className={styles.briefSeal}>Baseline locked, v1</span>
            <div className={styles.briefTitle}>Holloway Place</div>
            <div className={styles.briefSub}>Project Brief · 24 residential units, Salford</div>
            {OBJ.map((o, i) => (
              <div className={styles.objRow} key={i}>
                <span className={styles.objName}>{o.name}</span>
                <span className={chip(o.c)}>{o.c}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (screen === 'programme') {
      return (
        <div className={styles.screen} key="programme">
          {Mhead('Programme')}
          {MILES.map((m, i) => (
            <div className={styles.progRow} key={i}>
              <span className={styles.progName}>{m.name}</span>
              <span className={styles.progTrack}>
                <span
                  className={`${styles.progBar} ${m.crit ? styles.progBarCritical : ''}`}
                  style={{ left: `${m.x}%`, width: `${m.w}%` }}
                />
                <span className={styles.progToday} style={{ left: `${TODAY}%` }} />
              </span>
            </div>
          ))}
          <div className={styles.progCaption}>
            <span className={styles.progKey}>
              <span className={styles.progKeyDot} /> On the baseline
            </span>
            <span className={styles.progKey}>
              <span className={`${styles.progKeyDot} ${styles.progKeyDotCritical}`} /> Critical path at risk
            </span>
          </div>
        </div>
      );
    }
    if (screen === 'dashboard') {
      return (
        <div className={styles.screen} key="dashboard">
          {Mhead('Dashboard')}
          <div className={styles.kpis}>
            {KPIS.map((k, i) => (
              <div className={styles.kpi} key={i}>
                <div className={`${styles.kpiNum} ${k.hot ? styles.kpiNumHot : ''}`}>{k.num}</div>
                <div className={styles.kpiLabel}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className={styles.health}>
            <span className={styles.healthLabel}>Objective health</span>
            <div className={styles.healthRow}>
              {HEALTH.map((h, i) => (
                <span className={styles.hpill} key={i}>
                  <span className={`${styles.hdot} ${h.risk ? styles.hdotRisk : ''}`} />
                  {h.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.screen} key="home">
        <div className={styles.tiles}>
          {TILES.map((t) => (
            <button
              key={t.key}
              ref={(el) => (tgt.current['tile-' + t.key] = el)}
              className={`${styles.tile} ${t.wide ? styles.tileWide : ''}`}
              onClick={() => openModule(t.key)}
              onFocus={pauseForUser}
              aria-label={`Open ${t.title}`}
            >
              <span className={styles.tileHead}>
                <span className={styles.tileIcon}>
                  <t.Icon />
                </span>
                <span className={styles.tileTitle}>{t.title}</span>
              </span>
              <span className={styles.tileDesc}>{t.desc}</span>
              <span className={`${styles.tileFoot} ${t.hot ? styles.tileFootHot : ''}`}>{t.foot}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <div
        ref={frameRef}
        className={styles.frame}
        role="group"
        aria-label="Interactive preview of the PULSE workspace"
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <div className={styles.topbar}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            PULSE <span className={styles.brandFlitrr}>Flitrr</span>
          </span>
          <span className={styles.avatar} aria-hidden="true">
            HP
          </span>
        </div>
        <div className={styles.projbar}>
          <span className={styles.projName}>Holloway Place</span>
          <span className={styles.stageChip}>
            <span className={styles.stageDot} aria-hidden="true" />
            Stage 2 · Consultant appointment
          </span>
        </div>
        <div className={styles.body}>{renderScreen()}</div>
        <div className={styles.statusbar}>
          <span className={styles.statusLeft}>
            <span className={styles.statusDot} aria-hidden="true" />
            All changes saved
          </span>
          <span>Baseline locked · v1</span>
        </div>
        <div
          className={styles.cursor}
          style={{ transform: `translate(${cur.x}px, ${cur.y}px)`, opacity: cur.show ? 1 : 0 }}
          aria-hidden="true"
        >
          <svg className={`${styles.cursorIcon} ${cur.down ? styles.cursorDown : ''}`} width="20" height="20" viewBox="0 0 20 20">
            <path d="M5 2.5l11 5.5-4.6 1.5L9 16z" fill="#16232f" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
          <span className={`${styles.cursorRipple} ${cur.down ? styles.cursorRippleOn : ''}`} />
        </div>
      </div>
    </div>
  );
}

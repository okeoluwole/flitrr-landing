'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   Nav
───────────────────────────────────────── */

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`} role="banner">
      <div className={`container ${styles.navInner}`}>
        <a
          href="#"
          className={styles.navWordmark}
          aria-label="Flitrr — Monitoring What Matters"
        >
          Flitrr
        </a>

        <nav
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}
          aria-label="Primary navigation"
        >
          <a href="#pulse-modules" onClick={close}>PULSE</a>
          <a href="#project-brief" onClick={close}>Project Brief</a>
          <a href="#pilot" onClick={close}>Pilot</a>
          <a href="#about" onClick={close}>About</a>
          <a href="#pilot" className={styles.navCta} onClick={close}>
            Join the pilot
          </a>
        </nav>

        <button
          className={styles.hamburger}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barTop : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barMid : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barBot : ''}`} />
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────
   Hero — Project Brief document mock (inline SVG)
───────────────────────────────────────── */

// Stylised line widths per section, expressed as % of the body column
// width. Real section content is intentionally absent (no invented
// project names, no fake numbers); the mock reads as "the document
// PULSE produces" without claiming any specific brief content.
const BRIEF_SECTIONS = [
  { label: 'VISION',       lines: [92, 78] },
  { label: 'OBJECTIVES',   lines: [88, 74, 60] },
  { label: 'GLASS-BALL',   lines: [82, 66] },
  { label: 'RUBBER-BALL',  lines: [80, 70, 56] },
  { label: 'CONSTRAINTS',  lines: [86, 72] },
  { label: 'STAKEHOLDERS', lines: [78, 64, 50] },
];

function BriefDocumentMock() {
  // viewBox 480 x 600; body column starts at x=40, runs to x=440 (400 wide).
  // Sections are rendered as label + 2-3 lines, separated by Accent 3 dividers.
  const COL_X = 40;
  const COL_W = 400;
  const TOP_PAD = 88;            // header band height + breathing room
  const SECTION_GAP = 78;        // vertical pitch between section starts
  const LABEL_TO_LINE = 16;      // gap from label baseline to first line
  const LINE_PITCH = 12;         // gap between body lines
  const LINE_THICKNESS = 4;

  return (
    <svg
      viewBox="0 0 480 600"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Stylised representation of a Project Brief document with sections for Vision, Objectives, Glass-ball, Rubber-ball, Constraints, and Stakeholders."
      className={styles.briefMockSvg}
    >
      {/* Card */}
      <rect
        x="0" y="0" width="480" height="600" rx="16" ry="16"
        fill="var(--color-foreground-cream)"
      />

      {/* Header band — small "PROJECT BRIEF" pill, top-right */}
      <rect
        x={COL_X} y="32" width="140" height="20" rx="10" ry="10"
        fill="var(--color-accent-3-light-grey-blue)"
        opacity="0.5"
      />
      <text
        x={COL_X + 70} y="46"
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize="11" fontWeight="600"
        letterSpacing="0.08em"
        fill="var(--color-accent-1-deep-blue)"
      >
        PROJECT BRIEF
      </text>

      {/* Watermark F-mark stand-in — Accent 2 grey-blue at 8% opacity,
          rendered as a stylised geometric F glyph in the upper-right. */}
      <g
        transform="translate(364, 28)"
        fill="var(--color-accent-2-grey-blue)"
        opacity="0.08"
      >
        <rect x="0"  y="0"  width="80" height="14" rx="2" />
        <rect x="0"  y="0"  width="14" height="80" rx="2" />
        <rect x="14" y="33" width="50" height="14" rx="2" />
      </g>

      {/* Sections */}
      {BRIEF_SECTIONS.map((section, idx) => {
        const yStart = TOP_PAD + idx * SECTION_GAP;
        return (
          <g key={section.label}>
            {/* Section label */}
            <text
              x={COL_X} y={yStart}
              fontFamily="var(--font-heading), sans-serif"
              fontSize="13" fontWeight="800"
              letterSpacing="0.08em"
              fill="var(--color-accent-1-deep-blue)"
            >
              {section.label}
            </text>

            {/* Stylised body lines */}
            {section.lines.map((widthPct, lineIdx) => (
              <rect
                key={lineIdx}
                x={COL_X}
                y={yStart + LABEL_TO_LINE + lineIdx * LINE_PITCH}
                width={COL_W * (widthPct / 100)}
                height={LINE_THICKNESS}
                rx={LINE_THICKNESS / 2}
                fill="var(--color-accent-2-grey-blue)"
              />
            ))}

            {/* Divider below the section (skip for the final one) */}
            {idx < BRIEF_SECTIONS.length - 1 && (
              <line
                x1={COL_X}
                x2={COL_X + COL_W}
                y1={yStart + SECTION_GAP - 22}
                y2={yStart + SECTION_GAP - 22}
                stroke="var(--color-accent-3-light-grey-blue)"
                strokeWidth="1"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────
   Hero
───────────────────────────────────────── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      {/* Quiet F-mark stand-in watermark behind the headline column —
          Accent 2 grey-blue at 8% opacity per the locked-decision spec. */}
      <svg
        className={styles.heroWatermark}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="var(--color-accent-2-grey-blue)" opacity="0.08">
          <rect x="0"  y="0"   width="200" height="34" rx="4" />
          <rect x="0"  y="0"   width="34"  height="200" rx="4" />
          <rect x="34" y="83"  width="120" height="34" rx="4" />
        </g>
      </svg>

      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Introducing PULSE — by Flitrr</p>
            <h1 id="hero-heading" className={styles.heroHeading}>
              Monitoring What Matters.
            </h1>
            <p className={styles.heroSub}>
              Flitrr builds programme delivery tools for SME real estate
              developers. Our first product, <strong>PULSE</strong>, gives
              you the discipline the big consultancies sell for £50K —
              starting with the document every project should begin with.
            </p>
            <div className={styles.heroCtas}>
              <a href="#pilot" className={styles.btnPrimary}>
                Join the PULSE pilot
              </a>
              <a href="#project-brief" className={styles.btnGhost}>
                See the Project Brief &rarr;
              </a>
            </div>
          </div>
          <div className={styles.heroVisualWrap} aria-hidden="true">
            <BriefDocumentMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pain — upstream "started without a brief" framing
───────────────────────────────────────── */

function Pain() {
  return (
    <section className={styles.pain} aria-labelledby="pain-heading">
      <div className="container">
        <h2 id="pain-heading" className={styles.sectionHeading}>
          Most projects are lost before they start.
        </h2>
        <div className={styles.painBody}>
          <p>
            You sketched the project on the back of a feasibility model. The
            architect built to one assumption, the QS priced to another, the
            contractor priced to a third. By month three you&rsquo;re reconciling
            four versions of &ldquo;the plan&rdquo; — none of them written down,
            none of them signed off.
          </p>
          <p>
            Scope creeps. Costs drift. Programme slips. The consultants blame
            each other, the contractor blames the consultants, and you carry
            the cost of every misalignment because nobody agreed what
            &ldquo;done&rdquo; looked like before work started.
          </p>
          <p>
            The big consultancies solved this decades ago with a single
            discipline: a formal Project Brief, written before a spade hits
            the ground. They charge ~£50K to produce one. SME developers have
            been locked out — until now.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Thesis — glass-ball / rubber-ball framing
───────────────────────────────────────── */

// Examples used in the Glass / Rubber comparison panels.
const GLASS_OBJECTIVES = [
  'Practical completion by 31 March',
  'Planning consent retained',
  'GIA ≥ 4,200 m²',
];

const RUBBER_OBJECTIVES = [
  'Bathroom tile spec',
  'Soft-strip start date ±2 weeks',
  'Internal door supplier',
];

function GlassBallIcon() {
  // Outline circle, Accent 1 stroke, Foreground fill, glass-surface
  // highlight upper-left, soft Accent 3 shadow ground.
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Glass-ball icon"
      className={styles.objectiveIcon}
    >
      <ellipse
        cx="32" cy="58" rx="14" ry="2"
        fill="var(--color-accent-3-light-grey-blue)"
        opacity="0.5"
      />
      <circle
        cx="32" cy="32" r="26"
        fill="var(--color-foreground-cream)"
        stroke="var(--color-accent-1-deep-blue)"
        strokeWidth="2"
      />
      <ellipse
        cx="22" cy="22" rx="7" ry="4"
        fill="var(--color-foreground-cream)"
        opacity="0.6"
        transform="rotate(-30 22 22)"
        stroke="var(--color-foreground-cream)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function RubberBallIcon() {
  // Solid Accent 1 circle. No stroke, no highlight. Same shadow ground
  // for visual parity with the glass icon.
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Rubber-ball icon"
      className={styles.objectiveIcon}
    >
      <ellipse
        cx="32" cy="58" rx="14" ry="2"
        fill="var(--color-accent-3-light-grey-blue)"
        opacity="0.5"
      />
      <circle
        cx="32" cy="32" r="26"
        fill="var(--color-accent-1-deep-blue)"
      />
    </svg>
  );
}

function Thesis() {
  return (
    <section className={styles.thesis} aria-labelledby="thesis-heading">
      <div className="container">
        <div className={styles.thesisGrid}>
          <div className={styles.thesisInner}>
            <h2 id="thesis-heading" className={styles.sectionHeading}>
              Not every objective is equal. PULSE knows the difference.
            </h2>
            <p className={styles.thesisBody}>
              Every project carries dozens of objectives, but they aren&rsquo;t
              equally load-bearing. Some are <em>glass-ball</em> — drop them
              and the project shatters. Some are <em>rubber-ball</em> — drop
              them and the project bounces. Most teams treat them the same,
              which is why the catastrophic ones blindside you and the trivial
              ones consume your Monday morning.
            </p>
            <p className={styles.thesisBody}>
              PULSE asks the question consultancies spend weeks asking on your
              behalf — what is glass, and what is rubber — and uses the answer
              to decide what gets flagged, what gets escalated, and what gets
              quietly tracked. Discipline, scaled.
            </p>
            <p className={styles.thesisEmphasis}>
              Glass shatters. Rubber bounces. Know the difference.
            </p>
          </div>

          <div className={styles.objectivePanels} aria-hidden="false">
            <div className={styles.objectivePanel}>
              <h3 className={styles.objectivePanelHeading}>GLASS</h3>
              <GlassBallIcon />
              <ul className={styles.objectiveList}>
                {GLASS_OBJECTIVES.map((item) => (
                  <li key={item} className={styles.objectiveItem}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.objectivePanel}>
              <h3 className={styles.objectivePanelHeading}>RUBBER</h3>
              <RubberBallIcon />
              <ul className={styles.objectiveList}>
                {RUBBER_OBJECTIVES.map((item) => (
                  <li key={item} className={styles.objectiveItem}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   How It Works — Project Brief in 15 minutes
───────────────────────────────────────── */

const STEPS = [
  {
    num: '1',
    heading: 'Answer the questions.',
    body: 'PULSE walks you through the questions a senior project manager would ask on day one — vision, objectives, constraints, stakeholders, success criteria. No PM jargon. No blank Word document.',
  },
  {
    num: '2',
    heading: 'Classify what matters.',
    body: 'For every objective you name, PULSE asks one question: glass or rubber? In ten minutes you have the criticality map most projects never get.',
  },
  {
    num: '3',
    heading: 'Export the brief.',
    body: 'Download a formal Project Brief — the same document a consultancy would charge £50K to write — ready to share with your architect, QS, contractor, and lender.',
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className={styles.howItWorks}
      aria-labelledby="hiw-heading"
    >
      <div className="container">
        <h2 id="hiw-heading" className={styles.sectionHeading}>
          From blank page to formal brief in fifteen minutes.
        </h2>
        <p className={styles.howItWorksSub}>
          PULSE Project Brief takes you through the same elicitation a senior
          consultant would walk you through — and exports the document at
          the end.
        </p>
        <ol className={styles.stepsList}>
          {STEPS.map(({ num, heading, body }) => (
            <li key={num} className={styles.step}>
              <span className={styles.stepNum} aria-hidden="true">{num}</span>
              <h3 className={styles.stepHeading}>{heading}</h3>
              <p className={styles.stepBody}>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Project Brief Deep-Dive (NEW Section 6)
───────────────────────────────────────── */

// Stylised elicitation flow — three Q&A pairs rendered as cards. The
// "questions" are real but generic enough to read as the kind of
// question a senior PM would ask; the "answers" are stylised lines so
// we never invent project specifics.
const ELICITATION_QUESTIONS = [
  'What does done look like — and by when?',
  "Which of these objectives can the project not afford to lose?",
  'Who signs off the brief, and who needs to read it?',
];

function ElicitationFlow() {
  return (
    <div className={styles.elicitationFlow} aria-hidden="true">
      {ELICITATION_QUESTIONS.map((q, i) => (
        <div key={i} className={styles.elicitationCard}>
          <span className={styles.elicitationQLabel}>Q{i + 1}</span>
          <p className={styles.elicitationQuestion}>{q}</p>
          <div className={styles.elicitationAnswerLines}>
            <span style={{ width: '92%' }} />
            <span style={{ width: '78%' }} />
            <span style={{ width: '64%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Larger document mock for the Deep-Dive — same structure as the Hero
// version (six labelled sections, F-mark stand-in watermark), at a
// bigger viewBox with a bottom export bar.
function BriefDocumentMockLarge() {
  const COL_X = 50;
  const COL_W = 500;
  const TOP_PAD = 100;
  const SECTION_GAP = 92;
  const LABEL_TO_LINE = 18;
  const LINE_PITCH = 13;
  const LINE_THICKNESS = 5;

  return (
    <svg
      viewBox="0 0 600 760"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Larger stylised representation of the Project Brief document, with sections for Vision, Objectives, Glass-ball, Rubber-ball, Constraints, Stakeholders, and an export bar at the bottom."
      className={styles.briefMockLargeSvg}
    >
      <rect
        x="0" y="0" width="600" height="760" rx="20" ry="20"
        fill="var(--color-foreground-cream)"
      />

      {/* Header band — small "PROJECT BRIEF" pill */}
      <rect
        x={COL_X} y="40" width="160" height="22" rx="11" ry="11"
        fill="var(--color-accent-3-light-grey-blue)"
        opacity="0.5"
      />
      <text
        x={COL_X + 80} y="55"
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize="12" fontWeight="600"
        letterSpacing="0.08em"
        fill="var(--color-accent-1-deep-blue)"
      >
        PROJECT BRIEF
      </text>

      {/* Watermark F-mark stand-in upper-right */}
      <g
        transform="translate(460, 36)"
        fill="var(--color-accent-2-grey-blue)"
        opacity="0.10"
      >
        <rect x="0"  y="0"  width="100" height="18" rx="3" />
        <rect x="0"  y="0"  width="18"  height="100" rx="3" />
        <rect x="18" y="41" width="64"  height="18" rx="3" />
      </g>

      {BRIEF_SECTIONS.map((section, idx) => {
        const yStart = TOP_PAD + idx * SECTION_GAP;
        return (
          <g key={section.label}>
            <text
              x={COL_X} y={yStart}
              fontFamily="var(--font-heading), sans-serif"
              fontSize="14" fontWeight="800"
              letterSpacing="0.08em"
              fill="var(--color-accent-1-deep-blue)"
            >
              {section.label}
            </text>
            {section.lines.map((widthPct, lineIdx) => (
              <rect
                key={lineIdx}
                x={COL_X}
                y={yStart + LABEL_TO_LINE + lineIdx * LINE_PITCH}
                width={COL_W * (widthPct / 100)}
                height={LINE_THICKNESS}
                rx={LINE_THICKNESS / 2}
                fill="var(--color-accent-2-grey-blue)"
              />
            ))}
            {idx < BRIEF_SECTIONS.length - 1 && (
              <line
                x1={COL_X}
                x2={COL_X + COL_W}
                y1={yStart + SECTION_GAP - 26}
                y2={yStart + SECTION_GAP - 26}
                stroke="var(--color-accent-3-light-grey-blue)"
                strokeWidth="1"
              />
            )}
          </g>
        );
      })}

      {/* Bottom export bar */}
      <rect
        x="0" y="700" width="600" height="60"
        fill="var(--color-accent-3-light-grey-blue)"
        opacity="0.35"
      />
      <rect
        x={COL_X} y="718" width="56" height="24" rx="6"
        fill="var(--color-accent-1-deep-blue)"
      />
      <text
        x={COL_X + 28} y="734"
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize="11" fontWeight="600"
        letterSpacing="0.08em"
        fill="var(--color-foreground-cream)"
      >
        PDF
      </text>
      <rect
        x={COL_X + 68} y="718" width="64" height="24" rx="6"
        fill="var(--color-accent-1-deep-blue)"
      />
      <text
        x={COL_X + 100} y="734"
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize="11" fontWeight="600"
        letterSpacing="0.08em"
        fill="var(--color-foreground-cream)"
      >
        DOCX
      </text>
    </svg>
  );
}

function ProjectBriefDeepDive() {
  return (
    <section
      id="project-brief"
      className={styles.deepDive}
      aria-labelledby="deep-dive-heading"
    >
      <div className="container">
        <p className={styles.deepDiveEyebrow}>PULSE Module 1 — Project Brief</p>
        <h2 id="deep-dive-heading" className={styles.sectionHeading}>
          The discipline to start right.
        </h2>
        <p className={styles.deepDiveLead}>
          The Project Brief is the document every successful development starts
          with — and the one most SME developers never produce. It captures
          the vision, objectives, criticality, constraints, and stakeholders
          a project lives or dies by, in a form everyone on the team can read
          and sign off. PULSE turns a six-week consultancy engagement into a
          fifteen-minute guided flow, exportable to PDF and Word.
        </p>

        <div className={styles.deepDiveSplit}>
          <div className={styles.deepDiveLeft}>
            <span className={styles.deepDiveLabel}>The elicitation</span>
            <ElicitationFlow />
          </div>
          <div className={styles.deepDiveRight}>
            <span className={styles.deepDiveLabel}>The brief</span>
            <BriefDocumentMockLarge />
          </div>
        </div>

        <div className={styles.deepDiveExport}>
          <span className={styles.deepDiveExportPill}>PDF</span>
          <span className={styles.deepDiveExportPill}>DOCX</span>
          <span className={styles.deepDiveExportText}>
            Export to PDF and Word — share it with your architect, QS,
            contractor, and lender on day one.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   PULSE Modules (Section 7)
───────────────────────────────────────── */

const PULSE_MODULES = [
  {
    name: 'Project Brief',
    statusLabel: 'In build · Pilot Q3 2026',
    statusVariant: 'inBuild',
    body: 'Guided elicitation that produces the formal Project Brief document — vision, objectives, glass / rubber criticality, constraints, stakeholders. Exportable to PDF and Word.',
    tagline: 'The discipline to start right.',
  },
  {
    name: 'Action Tracker',
    statusLabel: 'Designed · Build follows Project Brief',
    statusVariant: 'designed',
    body: 'Every open action across every project, classified against the glass-ball objectives from your brief. Flagged when the action threatens a glass.',
  },
  {
    name: 'Risk Register',
    statusLabel: 'Designed · Build to follow',
    statusVariant: 'designed',
    body: 'Structured risk capture tagged to glass-ball objectives. Mitigation tracked alongside the actions that close it.',
  },
  {
    name: 'Programme Tracker',
    statusLabel: 'Designed · Build to follow',
    statusVariant: 'designed',
    body: 'Critical-path visibility with dependencies, float, and schedule impact — the institutional scheduler, finally built for developers without a PMO.',
  },
];

// Stylised F-mark stand-in used as the in-card watermark, drawn as a
// small geometric F glyph in Accent 3 at low opacity.
function ModuleCardWatermark() {
  return (
    <svg
      className={styles.moduleCardMark}
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="var(--color-accent-3-light-grey-blue)" opacity="0.55">
        <rect x="0"  y="0"  width="60" height="10" rx="2" />
        <rect x="0"  y="0"  width="10" height="60" rx="2" />
        <rect x="10" y="25" width="36" height="10" rx="2" />
      </g>
    </svg>
  );
}

function WhatYouGet() {
  return (
    <section
      id="pulse-modules"
      className={styles.platform}
      aria-labelledby="platform-heading"
    >
      <div className="container">
        <h2 id="platform-heading" className={styles.sectionHeading}>
          PULSE: four modules, one discipline.
        </h2>
        <p className={styles.sectionSub}>
          PULSE is being built one module at a time. Each module shares the
          same glass / rubber spine — so what you classify in the Project
          Brief drives what gets flagged everywhere else.
        </p>

        <div className={styles.moduleGrid}>
          {PULSE_MODULES.map((mod) => (
            <article key={mod.name} className={styles.moduleCard}>
              <ModuleCardWatermark />
              <div className={styles.moduleCardBody}>
                <span
                  className={`${styles.statusPill} ${
                    mod.statusVariant === 'inBuild'
                      ? styles.statusPillInBuild
                      : styles.statusPillDesigned
                  }`}
                >
                  {mod.statusLabel}
                </span>
                <h3 className={styles.moduleHeading}>{mod.name}</h3>
                <p className={styles.moduleBody}>{mod.body}</p>
                {mod.tagline && (
                  <p className={styles.moduleTagline}>{mod.tagline}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pilot — PULSE design-partner programme (Section 8)
───────────────────────────────────────── */

const PILOT_BLOCKS = [
  {
    heading: 'What it is',
    body: 'A 90-day design-partner programme. Weekly working sessions with the founder while we build the Project Brief module. First access on release. Direct say in what gets built next.',
  },
  {
    heading: 'What you give',
    body: 'Two real projects, two hours a week, and honest feedback. A willingness to shape a product before it’s finished.',
  },
  {
    heading: 'What you get',
    body: 'Lifetime founding-member pricing on PULSE. Priority access to every module as it ships. A direct line to the team building the tool.',
  },
];

function Pilot() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [market, setMarket] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | error

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error');
      return;
    }
    setStatus('success');
    setEmail('');
    setCompany('');
    setPortfolio('');
    setMarket('');
  };

  return (
    <section id="pilot" className={styles.pilot} aria-labelledby="pilot-heading">
      <div className="container">
        <h2 id="pilot-heading" className={styles.sectionHeading}>
          Be a PULSE design partner.
        </h2>
        <p className={styles.pilotSub}>
          Ten SME developers. Direct input into the product before it
          launches. First access to the Project Brief module the moment
          it&rsquo;s ready.
        </p>

        <div className={styles.pilotBlocks}>
          {PILOT_BLOCKS.map(({ heading, body }) => (
            <div key={heading} className={styles.pilotBlock}>
              <h3 className={styles.pilotBlockHeading}>{heading}</h3>
              <p className={styles.pilotBlockBody}>{body}</p>
            </div>
          ))}
        </div>

        <div className={styles.pilotFormWrap}>
          <div className={styles.pilotFormCard}>
            {status === 'success' ? (
              <div className={styles.successMsg} role="status" aria-live="polite">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" stroke="var(--color-accent-1-deep-blue)" strokeWidth="1.5" />
                  <path d="M5.5 10.5l3 3 6-6" stroke="var(--color-accent-1-deep-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  Thank you — we&rsquo;ll be in touch shortly to confirm your spot.
                </span>
              </div>
            ) : (
              <form className={styles.pilotForm} onSubmit={handleSubmit} noValidate>
                <div className={styles.inputWrap}>
                  <label htmlFor="pilot-email" className={styles.formLabel}>
                    Email address
                  </label>
                  <input
                    id="pilot-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    className={`${styles.textInput} ${status === 'error' ? styles.inputError : ''}`}
                    aria-describedby={status === 'error' ? 'email-error' : undefined}
                    aria-invalid={status === 'error'}
                    required
                  />
                  {status === 'error' && (
                    <p id="email-error" className={styles.errorMsg} role="alert">
                      Please enter a valid email address.
                    </p>
                  )}
                </div>
                <div className={styles.inputWrap}>
                  <label htmlFor="pilot-company" className={styles.formLabel}>
                    Company / practice name
                  </label>
                  <input
                    id="pilot-company"
                    type="text"
                    placeholder="e.g. Northpoint Developments"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={styles.textInput}
                  />
                </div>
                <div className={styles.inputWrap}>
                  <label htmlFor="pilot-portfolio" className={styles.formLabel}>
                    Portfolio size
                  </label>
                  <select
                    id="pilot-portfolio"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    className={styles.textInput}
                  >
                    <option value="">Select…</option>
                    <option value="1">1 project</option>
                    <option value="2-3">2–3 projects</option>
                    <option value="4+">4+ projects</option>
                  </select>
                </div>
                <div className={styles.inputWrap}>
                  <label htmlFor="pilot-market" className={styles.formLabel}>
                    Primary market
                  </label>
                  <select
                    id="pilot-market"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    className={styles.textInput}
                  >
                    <option value="">Select…</option>
                    <option value="UK">UK</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <button type="submit" className={`${styles.btnPrimary} ${styles.btnFullWidth}`}>
                  Request a design-partner spot
                </button>
              </form>
            )}
            <p className={styles.pilotNote}>
              No payment. No commitment beyond the design-partner programme.
              Ten spots total.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   FAQ
───────────────────────────────────────── */

const FAQS = [
  {
    q: 'How is this different from Asana, Monday, or ClickUp?',
    a: 'Generic PM tools are built for generic teams. FLITRR is built around real estate programme discipline — every action tagged to scope, cost, time, or quality, and flagged against your critical milestones. That framing doesn\'t exist in general-purpose tools, and it\'s the difference between logging work and governing a programme.',
  },
  {
    q: 'My consultants and contractors won\'t adopt a new tool. What then?',
    a: 'FLITRR is built for this reality. Invited users land on a simplified view — log an action, close an action, add a comment. No training. No onboarding. If logging in FLITRR is harder than sending a WhatsApp message, we\'ve failed.',
  },
  {
    q: 'What\'s live today, and what\'s coming later?',
    a: 'The Action Tracking module is live for pilot users today. Risk Register, Portfolio Dashboard, and Programme Tracker are in development and will roll out to pilot users as they\'re ready — at no additional cost during the pilot.',
  },
  {
    q: 'What happens after the 90-day pilot?',
    a: 'Pilot members move to founding-member pricing — a permanent discount on whatever plan exists at general launch. You\'re not locked in. You\'re not committed. But if FLITRR has earned its place in your workflow, you\'ll have the best deal anyone ever gets.',
  },
  {
    q: 'Do I need IT support to set this up?',
    a: 'No. If you can add a project in a spreadsheet, you can set up FLITRR. Full onboarding takes under an hour.',
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <section className={styles.faq} aria-labelledby="faq-heading">
      <div className="container">
        <div className={styles.faqInner}>
        <h2 id="faq-heading" className={styles.sectionHeading}>
          Questions we get asked.
        </h2>
        <dl className={styles.faqList}>
          {FAQS.map(({ q, a }, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}>
                <dt>
                  <button
                    className={styles.faqQuestion}
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                  >
                    <span>{q}</span>
                    <span className={styles.faqIcon} aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                </dt>
                <dd
                  id={`faq-answer-${i}`}
                  className={styles.faqAnswer}
                  hidden={!isOpen}
                >
                  <p>{a}</p>
                </dd>
              </div>
            );
          })}
        </dl>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Footer CTA
───────────────────────────────────────── */

function FooterCta() {
  return (
    <section className={styles.footerCta} aria-labelledby="fcta-heading">
      <div className="container">
        <div className={styles.footerCtaInner}>
          <h2 id="fcta-heading" className={styles.footerCtaHeading}>
            Ten spots. First come, first served.
          </h2>
          <p className={styles.footerCtaBody}>
            The founding pilot cohort will shape how FLITRR grows. If that&rsquo;s
            the seat you want, take it now.
          </p>
          <a href="#pilot" className={styles.btnWhite}>
            Request pilot access
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Footer
───────────────────────────────────────── */

function Footer() {
  return (
    <footer id="about" className={styles.footer} role="contentinfo">
      <div className="container">
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.footerWordmark}>Flitrr</span>
            <p className={styles.footerTagline}>Monitoring What Matters.</p>
            <p className={styles.footerSubTagline}>
              Flitrr is the company behind PULSE.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="mailto:hello@flitrr.com" className={styles.footerLink}>
              hello@flitrr.com
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
              aria-label="Flitrr on LinkedIn (opens in new tab)"
            >
              LinkedIn
            </a>
            <a href="#" className={styles.footerLink}>
              Privacy
            </a>
            <a href="#" className={styles.footerLink}>
              Terms
            </a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.footerCopy}>
            &copy; 2026 Flitrr Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <Pain />
        <Thesis />
        <HowItWorks />
        <ProjectBriefDeepDive />
        <WhatYouGet />
        <Pilot />
        <FAQ />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}

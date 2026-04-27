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
   Footer CTA
───────────────────────────────────────── */

function FooterCta() {
  return (
    <section className={styles.footerCta} aria-labelledby="fcta-heading">
      {/* Foreground F-mark stand-in watermark behind the heading. */}
      <svg
        className={styles.footerCtaWatermark}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="var(--color-foreground-cream)" opacity="0.08">
          <rect x="0"  y="0"   width="200" height="34" rx="4" />
          <rect x="0"  y="0"   width="34"  height="200" rx="4" />
          <rect x="34" y="83"  width="120" height="34" rx="4" />
        </g>
      </svg>

      <div className="container">
        <div className={styles.footerCtaInner}>
          <h2 id="fcta-heading" className={styles.footerCtaHeading}>
            Ten design-partner spots. First come, first served.
          </h2>
          <p className={styles.footerCtaBody}>
            PULSE will be shaped by the developers who use it first. If
            that&rsquo;s the seat you want, take it now.
          </p>
          <a href="#pilot" className={styles.btnAmber}>
            Request a design-partner spot
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
        <Pilot />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}

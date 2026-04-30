'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   Section 1 — Nav
───────────────────────────────────────── */

function PulseNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <header
      className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
      role="banner"
    >
      <div className={`container ${styles.navInner}`}>
        <div className={styles.brandLockup}>
          <a href="/" className={styles.brandFlitrr} aria-label="Flitrr home">
            Flitrr
          </a>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandPulse} aria-current="page">
            PULSE
          </span>
        </div>

        <nav
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}
          aria-label="Primary navigation"
        >
          <a href="#how-it-works" onClick={close}>How it works</a>
          <a href="#modules" onClick={close}>Modules</a>
          <a href="#faq" onClick={close}>FAQ</a>
          <a
            href="#design-partner"
            className={styles.navCta}
            onClick={close}
          >
            Become a design partner
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
   Section 2 — Hero
───────────────────────────────────────── */

function PulseHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="container">
        <div className={styles.heroContent}>
          <p className={styles.heroWordmark} aria-hidden="true">PULSE</p>
          <p id="hero-heading" className={styles.heroTagline}>
            Monitoring What Matters.
          </p>
          <p className={styles.heroSentence}>
            Every objective. Every project. Defined, classified, monitored.
          </p>
          <div className={styles.heroCtas}>
            <a href="#design-partner" className={styles.btnPrimary}>
              Become a design partner
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 3 — The Wedge (glass / rubber)
───────────────────────────────────────── */

const GLASS_OBJECTIVES = [
  'Practical completion by 31 March',
  'Planning consent retained',
  'GIA at or above 4,200 m²',
];

const RUBBER_OBJECTIVES = [
  'Bathroom tile spec',
  'Soft-strip start date plus or minus 2 weeks',
  'Internal door supplier',
];

function GlassBallIcon() {
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
        strokeWidth="2.5"
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

function Wedge() {
  return (
    <section className={styles.wedge} aria-labelledby="wedge-heading">
      <div className="container">
        <div className={styles.wedgeGrid}>
          <div className={styles.wedgeCopy}>
            <h2 id="wedge-heading" className={styles.sectionHeading}>
              Most PM tools track everything. PULSE monitors what matters.
            </h2>
            <p className={styles.wedgePara}>
              Most project management tools treat every task, action, and
              milestone as equal weight. They give you a long list of things
              to track, and you decide what&rsquo;s urgent. The result is
              noise. The catastrophic items get blindsided by the trivial
              ones, and the trivial ones consume your morning.
            </p>
            <p className={styles.wedgePara}>
              PULSE works differently. Every project objective gets
              classified. Glass-ball means critical, the project breaks if
              you miss it. Rubber-ball means it matters, but the project
              can absorb it. That single classification changes what gets
              flagged, what gets escalated, and what gets quietly tracked.
              No other PM tool does this.
            </p>
          </div>

          <div className={styles.wedgePanels}>
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

        <p className={styles.wedgeCloser}>
          Glass shatters. Rubber bounces. Know the difference.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 4 — The Gating Story
───────────────────────────────────────── */

const SECONDARY_MODULES = [
  'Action Log',
  'Risk Register',
  'Programme Tracker',
  'Executive Dashboard',
];

function GatingArrow() {
  return (
    <svg
      className={styles.gatingArrow}
      viewBox="0 0 80 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line
        x1="2" y1="12" x2="68" y2="12"
        stroke="var(--color-background-amber)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 60 4 L 76 12 L 60 20"
        fill="none"
        stroke="var(--color-background-amber)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GatingStory() {
  return (
    <section
      id="how-it-works"
      className={styles.gating}
      aria-labelledby="gating-heading"
    >
      <div className="container">
        <h2 id="gating-heading" className={styles.sectionHeading}>
          You start with Project Initiation. Everything else flows from
          there.
        </h2>
        <p className={styles.gatingBody}>
          Before PULSE tracks what&rsquo;s happening, it asks you to define
          what matters. Project Initiation is a guided 15-minute flow that
          produces your <strong>Project Brief</strong>. The Brief is a
          formal document setting out the project&rsquo;s vision,
          objectives, glass-ball and rubber-ball criticality, constraints,
          milestones, and stakeholders. Once that&rsquo;s done, the rest
          of PULSE unlocks. The Action Log, Risk Register, Programme
          Tracker, and Executive Dashboard all read from the Brief.
        </p>

        <div className={styles.gatingFlow}>
          <div className={styles.gatingPrimary}>
            <h3 className={styles.gatingPrimaryHeading}>Project Initiation</h3>
            <p className={styles.gatingPrimarySub}>
              15 minutes. Generates Project Brief.
            </p>
          </div>

          <div className={styles.gatingArrowWrap}>
            <GatingArrow />
          </div>

          <div className={styles.gatingSecondaryGrid}>
            {SECONDARY_MODULES.map((label) => (
              <div key={label} className={styles.gatingSecondaryCard}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className={styles.gatingNote}>
          PULSE works best when you start with Project Initiation. You can
          configure manually if you need to. But the discipline is what
          makes the rest of the product powerful.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 5 — The Modules
───────────────────────────────────────── */

const MODULES = [
  {
    name: 'Project Initiation',
    statusLabel: 'In build. Design partners Q3 2026.',
    statusVariant: 'inBuild',
    body: 'A guided 15-minute flow that produces your Project Brief. Vision, objectives, glass-ball and rubber-ball criticality, constraints, milestones, stakeholders. Exportable to PDF and Word.',
    tagline: 'The foundation everything else builds on.',
  },
  {
    name: 'Action Log',
    statusLabel: 'Designed. Build follows Project Initiation.',
    statusVariant: 'designed',
    body: 'Every open action across every project, classified against the glass-ball objectives from your Brief. Flagged automatically when an action threatens a glass-ball.',
  },
  {
    name: 'Risk Register',
    statusLabel: 'Designed. Build to follow.',
    statusVariant: 'designed',
    body: 'Structured risk capture tagged to glass-ball objectives. Mitigation tracked alongside the actions that close it.',
  },
  {
    name: 'Programme Tracker',
    statusLabel: 'Designed. Build to follow.',
    statusVariant: 'designed',
    body: 'Critical-path visibility with dependencies, float, and schedule impact. The institutional scheduler, finally built for developers without a PMO.',
  },
  {
    name: 'Executive Dashboard',
    statusLabel: 'Planned.',
    statusVariant: 'planned',
    body: 'Cross-project health summary. Stakeholder-specific views. The view a JV partner, lender, or board member needs in one place.',
  },
];

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

function pillClassFor(variant) {
  if (variant === 'inBuild') return styles.statusPillInBuild;
  if (variant === 'planned') return styles.statusPillPlanned;
  return styles.statusPillDesigned;
}

function Modules() {
  return (
    <section
      id="modules"
      className={styles.modules}
      aria-labelledby="modules-heading"
    >
      <div className="container">
        <h2 id="modules-heading" className={styles.sectionHeading}>
          Five modules. One discipline.
        </h2>
        <p className={styles.modulesSub}>
          PULSE is being built one module at a time. Each module shares
          the same glass-ball and rubber-ball spine. What you classify in
          Project Initiation drives what gets flagged everywhere else.
        </p>

        <div className={styles.moduleGrid}>
          {MODULES.map((mod, idx) => (
            <article
              key={mod.name}
              className={`${styles.moduleCard} ${
                idx === 4 ? styles.moduleCardSpan : ''
              }`}
            >
              <ModuleCardWatermark />
              <div className={styles.moduleCardBody}>
                <span className={`${styles.statusPill} ${pillClassFor(mod.statusVariant)}`}>
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
   Section 6 — Design Partner CTA
───────────────────────────────────────── */

const DESIGN_PARTNER_BLOCKS = [
  {
    heading: 'What it is.',
    body: 'A 90-day programme. Working sessions while we build PULSE module by module. First access on every release. A direct say in what gets built next.',
  },
  {
    heading: 'What you give.',
    body: 'Two real projects, two hours a week, honest feedback. A willingness to shape PULSE before it is finished.',
  },
  {
    heading: 'What you get.',
    body: 'Lifetime founding-member pricing on PULSE. Priority access to every module as it ships. A direct line to the team building the product.',
  },
];

function DesignPartner() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [market, setMarket] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | error

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !company.trim() ||
      !portfolio ||
      !market
    ) {
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
    <section
      id="design-partner"
      className={styles.designPartner}
      aria-labelledby="design-partner-heading"
    >
      <div className="container">
        <h2
          id="design-partner-heading"
          className={styles.sectionHeading}
        >
          Be a PULSE design partner.
        </h2>
        <p className={styles.designPartnerSub}>
          Ten developers. Direct input into PULSE before it launches.
          First access to Project Initiation the moment it ships.
        </p>

        <div className={styles.designPartnerBlocks}>
          {DESIGN_PARTNER_BLOCKS.map(({ heading, body }) => (
            <div key={heading} className={styles.designPartnerBlock}>
              <h3 className={styles.designPartnerBlockHeading}>{heading}</h3>
              <p className={styles.designPartnerBlockBody}>{body}</p>
            </div>
          ))}
        </div>

        <div className={styles.designPartnerFormWrap}>
          <div className={styles.designPartnerFormCard}>
            {status === 'success' ? (
              <div
                className={styles.successState}
                role="status"
                aria-live="polite"
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                  />
                  <path
                    d="M11 20.5l6 6 12-12"
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className={styles.successHeading}>Request received</h3>
                <p className={styles.successBody}>
                  We will be in touch within 48 hours. In the meantime,
                  keep an eye on your inbox.
                </p>
              </div>
            ) : (
              <form
                className={styles.designPartnerForm}
                onSubmit={handleSubmit}
                noValidate
              >
                {/* Hidden source-tracking field — distinguishes leads
                    submitted from the PULSE page from those on
                    flitrr.com when both forms wire to the same backend. */}
                <input type="hidden" name="source" value="pulse-page" />

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-email" className={styles.formLabel}>
                    Email address
                  </label>
                  <input
                    id="dp-email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    className={`${styles.textInput} ${status === 'error' && !email ? styles.inputError : ''}`}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-company" className={styles.formLabel}>
                    Company / practice name
                  </label>
                  <input
                    id="dp-company"
                    name="company"
                    type="text"
                    placeholder="e.g. Northpoint Developments"
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    className={`${styles.textInput} ${status === 'error' && !company.trim() ? styles.inputError : ''}`}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-portfolio" className={styles.formLabel}>
                    Portfolio size
                  </label>
                  <select
                    id="dp-portfolio"
                    name="portfolio"
                    value={portfolio}
                    onChange={(e) => {
                      setPortfolio(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    className={`${styles.textInput} ${status === 'error' && !portfolio ? styles.inputError : ''}`}
                    required
                  >
                    <option value="">Select…</option>
                    <option value="1">1 project</option>
                    <option value="2-3">2 to 3 projects</option>
                    <option value="4+">4 plus projects</option>
                  </select>
                </div>

                <div className={styles.inputWrap}>
                  <label htmlFor="dp-market" className={styles.formLabel}>
                    Primary market
                  </label>
                  <select
                    id="dp-market"
                    name="market"
                    value={market}
                    onChange={(e) => {
                      setMarket(e.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    className={`${styles.textInput} ${status === 'error' && !market ? styles.inputError : ''}`}
                    required
                  >
                    <option value="">Select…</option>
                    <option value="UK">UK</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                {status === 'error' && (
                  <p className={styles.errorMsg} role="alert">
                    Please complete every field with a valid value.
                  </p>
                )}

                <button
                  type="submit"
                  className={`${styles.btnPrimary} ${styles.btnFullWidth}`}
                >
                  Request a design partner spot
                </button>
              </form>
            )}
            <p className={styles.formNote}>
              No payment. No commitment beyond the design partner programme.
              Ten spots total.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 7 — FAQ
───────────────────────────────────────── */

const FAQS = [
  {
    q: "What's the Glass-ball vs Rubber-ball principle?",
    a: "A two-bucket classification of every objective on your project. Glass-ball objectives are critical to project success. Miss one and the project has failed against what it was set up to deliver. Examples include completion date, planning consent retained, and GIA target. Rubber-ball objectives matter to delivery but won't break the project if they slip or change. Examples include supplier choice, fit-out scheduling, and finish specification. PULSE uses your classification to decide what gets flagged, escalated, or quietly tracked.",
  },
  {
    q: 'Why do I have to start with Project Initiation?',
    a: "Because PULSE can only monitor what you've defined. Without a Project Brief, the Action Log doesn't know which actions are critical, the Risk Register doesn't know which risks threaten what, and the Programme Tracker doesn't know which milestones can slip. Project Initiation is a 15-minute flow. It is the discipline that makes everything else work.",
  },
  {
    q: 'Can I use PULSE without doing the Project Initiation flow?',
    a: "Technically yes. You can skip ahead and configure objectives manually for each module. But you'll lose the system-derived suggestions, the over-constraint warnings, and the milestone templates. PULSE works best when you start with Project Initiation. The discipline is what makes the rest of the product powerful.",
  },
  {
    q: 'How is PULSE different from Asana, Monday, or Procore?',
    a: "Generic PM tools treat every task as equal weight. They give you a long list to track, and you decide what's urgent. PULSE is built around a specific classification (glass-ball vs rubber-ball) that determines what gets flagged automatically. That framing doesn't exist in general-purpose tools or in the construction-specific ones. PULSE is the discipline of programme delivery, built into the workflow.",
  },
  {
    q: "My consultants won't adopt a new tool. Then what?",
    a: "The Project Brief output is a PDF and a Word document. Your consultants don't need to use PULSE to read it. For modules that ask consultants to log actions or update risks, the interaction is a single click or a short comment. No training. If using PULSE is harder than sending a WhatsApp message, we've failed.",
  },
  {
    q: "What's live now, and what's coming?",
    a: 'Project Initiation ships first to design partners in Q3 2026. Action Log, Risk Register, and Programme Tracker follow on the roadmap. Executive Dashboard is planned. Design partners get first access to each module as it ships.',
  },
];

function PulseFaq() {
  const [openIndex, setOpenIndex] = useState(null);
  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <section id="faq" className={styles.faq} aria-labelledby="faq-heading">
      <div className="container">
        <div className={styles.faqInner}>
          <h2 id="faq-heading" className={styles.sectionHeading}>
            Questions we get asked.
          </h2>
          <dl className={styles.faqList}>
            {FAQS.map(({ q, a }, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                >
                  <dt>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      aria-controls={`pulse-faq-answer-${i}`}
                    >
                      <span>{q}</span>
                      <span className={styles.faqIcon} aria-hidden="true">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                  </dt>
                  <dd
                    id={`pulse-faq-answer-${i}`}
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
   Section 8 — Footer CTA
───────────────────────────────────────── */

function PulseFooterCta() {
  return (
    <section className={styles.footerCta} aria-labelledby="fcta-heading">
      <svg
        className={styles.footerCtaWatermark}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="var(--color-foreground-cream)" opacity="0.08">
          <rect x="0"  y="0"  width="200" height="34" rx="4" />
          <rect x="0"  y="0"  width="34"  height="200" rx="4" />
          <rect x="34" y="83" width="120" height="34" rx="4" />
        </g>
      </svg>

      <div className="container">
        <div className={styles.footerCtaInner}>
          <h2 id="fcta-heading" className={styles.footerCtaHeading}>
            Ten design partner spots. First come, first served.
          </h2>
          <p className={styles.footerCtaBody}>
            PULSE will be shaped by the developers who use it first. If
            that&rsquo;s the seat you want, take it now.
          </p>
          <a href="#design-partner" className={styles.btnAmber}>
            Request a design partner spot
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 9 — Footer
───────────────────────────────────────── */

function PulseFooter() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className="container">
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLockup}>Flitrr / PULSE</span>
            <p className={styles.footerSubTagline}>
              PULSE is the project delivery product, built by Flitrr.
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
            <a href="#" className={styles.footerLink}>Privacy</a>
            <a href="#" className={styles.footerLink}>Terms</a>
            <a href="/" className={styles.footerLink}>Back to Flitrr</a>
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

export default function PulsePage() {
  return (
    <>
      <PulseNav />
      <main id="main-content">
        <PulseHero />
        <Wedge />
        <GatingStory />
        <Modules />
        <DesignPartner />
        <PulseFaq />
        <PulseFooterCta />
      </main>
      <PulseFooter />
    </>
  );
}

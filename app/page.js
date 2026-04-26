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
   Hero visual (abstract dashboard mock)
───────────────────────────────────────── */

function MockProject({ name, progress, status }) {
  return (
    <div className={styles.mockProject}>
      <div className={styles.mockProjectMeta}>
        <span className={styles.mockProjectName}>{name}</span>
        <span className={`${styles.mockStatus} ${status === 'risk' ? styles.mockStatusRisk : ''}`}>
          {status === 'risk' ? 'At risk' : 'On track'}
        </span>
      </div>
      <div className={styles.mockBar}>
        <div className={styles.mockBarFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className={styles.heroVisualWrap} aria-hidden="true">
      <div className={styles.mockCard}>
        <div className={styles.mockHeader}>
          <span className={styles.mockHeaderTitle}>Portfolio</span>
          <span className={styles.mockLivePill}>Live</span>
        </div>
        <div className={styles.mockBody}>
          <MockProject name="Thornfield Residential" progress={72} status="ok" />
          <MockProject name="Parkview Commercial"    progress={48} status="risk" />
          <MockProject name="Marina Quarter"         progress={88} status="ok" />
        </div>
        <div className={styles.mockFooter}>
          <div className={styles.mockStat}>
            <span className={styles.mockStatNum}>14</span>
            <span className={styles.mockStatLabel}>Open actions</span>
          </div>
          <div className={styles.mockStatDivider} />
          <div className={styles.mockStat}>
            <span className={`${styles.mockStatNum} ${styles.mockStatNumAlert}`}>3</span>
            <span className={styles.mockStatLabel}>Critical flags</span>
          </div>
          <div className={styles.mockStatDivider} />
          <div className={styles.mockStat}>
            <span className={styles.mockStatNum}>3</span>
            <span className={styles.mockStatLabel}>Projects</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Hero
───────────────────────────────────────── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Programme Delivery · AI-Assisted</p>
            <h1 id="hero-heading" className={styles.heroHeading}>
              Monitoring What Matters.
            </h1>
            <p className={styles.heroSub}>
              FLITRR is a programme delivery platform built for SME real estate
              developers — bringing institutional discipline to how you manage
              your portfolio.
            </p>
            <div className={styles.heroCtas}>
              <a href="#pilot" className={styles.btnPrimary}>
                Join the pilot
              </a>
              <a href="#how-it-works" className={styles.btnGhost}>
                See how it works &rarr;
              </a>
            </div>
          </div>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pain
───────────────────────────────────────── */

function Pain() {
  return (
    <section className={styles.pain} aria-labelledby="pain-heading">
      <div className="container">
        <h2 id="pain-heading" className={styles.sectionHeading}>
          You&rsquo;re tracking everything. And seeing nothing.
        </h2>
        <div className={styles.painBody}>
          <p>
            You&rsquo;re running four projects. Consultants send WhatsApp updates
            at 11pm. Contractors flag issues in site meetings that never make it
            into minutes. Actions get agreed on Monday and forgotten by Friday.
          </p>
          <p>
            You have forty open items across your portfolio. Some are routine.
            Some will blow your completion date or your budget. Today, you have
            no reliable way to tell them apart — until a missed milestone or a
            cost overrun tells you for you.
          </p>
          <p>
            The big consultancies solved this decades ago with disciplined
            programme governance. SME developers have been locked out of it.
            Until now.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Thesis
───────────────────────────────────────── */

const QUADRANTS = ['Scope', 'Cost', 'Time', 'Quality'];

function Thesis() {
  return (
    <section className={styles.thesis} aria-labelledby="thesis-heading">
      <div className="container">
        <div className={styles.thesisGrid}>
          <div className={styles.thesisInner}>
            <h2 id="thesis-heading" className={styles.sectionHeading}>
              One platform. Built for how real estate programmes actually run.
            </h2>
            <p className={styles.thesisBody}>
              FLITRR helps real estate developers monitor what matters across
              every project. Actions, risks, milestones, critical path — all
              tagged to the objectives they impact, so nothing that threatens
              scope, cost, time, or quality slips through.
            </p>
            <p className={styles.thesisEmphasis}>
              No more hunting. No more chasing. No more surprises.
            </p>
          </div>
          <div className={styles.thesisQuadrant} aria-hidden="true">
            {QUADRANTS.map((label) => (
              <div key={label} className={styles.quadrantCell}>
                <span className={styles.quadrantLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   How It Works
───────────────────────────────────────── */

const STEPS = [
  {
    num: '01',
    heading: 'Add your projects',
    body: 'Enter your active developments. Define the critical milestones that matter — planning approval, ground-breaking, handover. FLITRR learns the spine of your portfolio.',
  },
  {
    num: '02',
    heading: 'Invite your team',
    body: "Bring in your internal team, consultants, and contractors. One click. No training. They log actions and updates against the projects they're assigned to.",
  },
  {
    num: '03',
    heading: 'See what matters',
    body: 'Every action is AI-tagged to the objectives it affects — scope, cost, time, quality — and flagged if it threatens a critical milestone. You know what to chase first, and why.',
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
          From sign-up to clarity in under an hour.
        </h2>
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
   What You Get
───────────────────────────────────────── */

const COMING_SOON = [
  {
    heading: 'Risk Register',
    body: 'Structured risk capture with the same objective-tagging discipline. Know which risks threaten which objectives, and track mitigation alongside the actions that close them.',
  },
  {
    heading: 'Portfolio Dashboard',
    body: 'A single visual view of every project\'s status, open actions, live risks, and milestone trajectory. The Monday review answer, without the Monday prep.',
  },
  {
    heading: 'Programme Tracker',
    body: 'Full critical path visibility. Dependencies, float, and schedule impact modelling — the institutional scheduler, finally built for developers who don\'t have a PMO.',
  },
];

function WhatYouGet() {
  return (
    <section
      id="platform"
      className={styles.platform}
      aria-labelledby="platform-heading"
    >
      <div className="container">
        <h2 id="platform-heading" className={styles.sectionHeading}>
          Live today. Built for what comes next.
        </h2>
        <p className={styles.sectionSub}>
          FLITRR is a platform, not a feature. We&rsquo;re launching with the
          module that drives the most immediate value — and rolling out the rest
          of the governance stack over the coming months.
        </p>

        {/* Live card */}
        <div className={styles.liveCard}>
          <span className={styles.liveLabel}>&#10003;&nbsp; Available in pilot</span>
          <h3 className={styles.liveCardHeading}>Action Tracking</h3>
          <p className={styles.liveCardBody}>
            Every open action across every project, in one place. AI-assisted
            tagging to scope, cost, time, and quality. Automatic flagging of
            items that threaten your critical milestones. Assign to anyone —
            team, consultants, contractors — and let FLITRR handle the
            follow-up.
          </p>
          <ul className={styles.featureList}>
            <li>Portfolio-wide action visibility</li>
            <li>AI-assisted objective tagging</li>
            <li>Critical milestone impact flags</li>
            <li>Multi-party assignment (internal, consultant, contractor)</li>
            <li>Comment threads on every action</li>
          </ul>
        </div>

        {/* Coming soon cards */}
        <div className={styles.comingSoonHeader}>
          <span className={styles.comingLabel}>&#8987;&nbsp; Rolling out to pilot cohort</span>
        </div>
        <div className={styles.comingSoonGrid}>
          {COMING_SOON.map(({ heading, body }) => (
            <article key={heading} className={styles.comingSoonCard}>
              <h3 className={styles.comingSoonHeading}>{heading}</h3>
              <p className={styles.comingSoonBody}>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pilot
───────────────────────────────────────── */

const PILOT_BLOCKS = [
  {
    heading: 'What it is',
    body: 'Ten SME real estate developers. 90 days of free access to FLITRR. Weekly feedback sessions with the founder. Direct influence over the roadmap.',
  },
  {
    heading: 'What you give',
    body: 'Honest use. Honest feedback. A willingness to shape a product, not just test one.',
  },
  {
    heading: 'What you get',
    body: 'Lifetime founding-member pricing. Priority access to new modules as they launch. A direct line to the team building the tool.',
  },
];

function Pilot() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
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
  };

  return (
    <section id="pilot" className={styles.pilot} aria-labelledby="pilot-heading">
      <div className="container">
        <h2 id="pilot-heading" className={styles.sectionHeading}>
          Join the founding pilot cohort.
        </h2>

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
                  <circle cx="10" cy="10" r="9" stroke="#0d5a3d" strokeWidth="1.5" />
                  <path d="M5.5 10.5l3 3 6-6" stroke="#0d5a3d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  Thank you — we&rsquo;ll be in touch shortly to confirm your spot.
                </span>
              </div>
            ) : (
              <form className={styles.pilotForm} onSubmit={handleSubmit} noValidate>
                <div className={styles.inputWrap}>
                  <label htmlFor="pilot-email" className={styles.srOnly}>Email address</label>
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
                  <label htmlFor="pilot-company" className={styles.srOnly}>Company name</label>
                  <input
                    id="pilot-company"
                    type="text"
                    placeholder="Company / practice name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={styles.textInput}
                  />
                </div>
                <button type="submit" className={`${styles.btnPrimary} ${styles.btnFullWidth}`}>
                  Request access
                </button>
              </form>
            )}
            <p className={styles.pilotNote}>
              No payment required. No commitment beyond the pilot. Ten spots total.
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
        <WhatYouGet />
        <Pilot />
        <FAQ />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

/* ─── Icons (inline SVG, no external deps) ─── */

function IconFragmented() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="17" y="1" width="10" height="10" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="1" y="17" width="10" height="10" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="17" y="17" width="10" height="10" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <line x1="11" y1="6" x2="17" y2="6" stroke="#0d5a3d" strokeWidth="1.6" strokeDasharray="2 2" />
      <line x1="6" y1="11" x2="6" y2="17" stroke="#0d5a3d" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}

function IconVisibility() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" stroke="#0d5a3d" strokeWidth="1.6" />
      <line x1="14" y1="6" x2="14" y2="14" stroke="#0d5a3d" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="14" x2="20" y2="18" stroke="#0d5a3d" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="14" r="1.5" fill="#0d5a3d" />
    </svg>
  );
}

function IconCost() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 3v22M9 7h7.5a3.5 3.5 0 010 7H9m0 0h8a3.5 3.5 0 010 7H9" stroke="#0d5a3d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="14" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="18" y="2" width="12" height="8" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="2" y="20" width="12" height="10" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <rect x="18" y="14" width="12" height="16" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
    </svg>
  );
}

function IconScheduler() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="26" height="24" rx="2" stroke="#0d5a3d" strokeWidth="1.6" />
      <line x1="3" y1="11" x2="29" y2="11" stroke="#0d5a3d" strokeWidth="1.6" />
      <line x1="10" y1="2" x2="10" y2="8" stroke="#0d5a3d" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="22" y1="2" x2="22" y2="8" stroke="#0d5a3d" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="18" x2="16" y2="18" stroke="#0d5a3d" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="23" x2="20" y2="23" stroke="#0d5a3d" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Nav ─── */

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
        <a href="#" className={styles.wordmark} aria-label="FLITRR home">
          FLITRR
        </a>

        <nav className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`} aria-label="Primary navigation">
          <a href="#solution" onClick={close}>Solution</a>
          <a href="#about" onClick={close}>About</a>
          <a href="#pilot" onClick={close}>Pilot</a>
          <a href="#pilot" className={styles.navCta} onClick={close}>
            Join Pilot
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

/* ─── Hero ─── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="container">
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Programme Management · AI-Powered</p>
          <h1 id="hero-heading" className={styles.heroHeading}>
            Institutional-grade programme governance, made accessible.
          </h1>
          <p className={styles.heroSub}>
            FLITRR brings enterprise-grade programme rigour to the developers
            who&rsquo;ve been priced out of it.
          </p>
          <div className={styles.heroCtas}>
            <a href="#pilot" className={styles.btnPrimary}>
              Join the pilot
            </a>
            <a href="#solution" className={styles.btnGhost}>
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Problem ─── */

const PROBLEMS = [
  {
    Icon: IconFragmented,
    heading: 'Fragmented coordination',
    body: 'Developers juggle consultants, contractors, and financiers across disconnected tools. Critical decisions fall through the gaps.',
  },
  {
    Icon: IconVisibility,
    heading: 'No programme visibility',
    body: 'Spreadsheets and memory replace proper governance. By the time a problem surfaces, the cost of correction has already compounded.',
  },
  {
    Icon: IconCost,
    heading: 'Institutional rigour is priced out',
    body: 'Big-consultancy programme management costs more than most developers earn per project — leaving SMEs exposed without meaningful alternatives.',
  },
];

function Problem() {
  return (
    <section className={styles.problem} aria-labelledby="problem-heading">
      <div className="container">
        <h2 id="problem-heading" className={styles.sectionHeading}>
          The governance gap no one talks about
        </h2>
        <div className={styles.problemGrid}>
          {PROBLEMS.map(({ Icon, heading, body }) => (
            <article key={heading} className={styles.problemCard}>
              <div className={styles.cardIcon}>
                <Icon />
              </div>
              <h3 className={styles.cardHeading}>{heading}</h3>
              <p className={styles.cardBody}>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Solution ─── */

function Solution() {
  return (
    <section id="solution" className={styles.solution} aria-labelledby="solution-heading">
      <div className="container">
        <h2 id="solution-heading" className={styles.sectionHeading}>
          One platform. Complete programme control.
        </h2>
        <p className={styles.sectionSub}>
          FLITRR replaces the patchwork of tools with a single governance layer built for how
          Nigerian developers actually work.
        </p>

        <div className={styles.featureGrid}>
          <article className={styles.featureBlock}>
            <div className={styles.featureIcon}>
              <IconDashboard />
            </div>
            <h3 className={styles.featureHeading}>Portfolio Dashboard</h3>
            <p className={styles.featureBody}>
              One view across all active projects. Track status, milestones, risks, and budget
              variance without chasing updates from your team.
            </p>
            <ul className={styles.featureList}>
              <li>Live project status at a glance</li>
              <li>Milestone tracking &amp; risk flags</li>
              <li>Budget variance reporting</li>
              <li>Cross-project resource view</li>
            </ul>
          </article>

          <article className={styles.featureBlock}>
            <div className={styles.featureIcon}>
              <IconScheduler />
            </div>
            <h3 className={styles.featureHeading}>AI Programme Scheduler</h3>
            <p className={styles.featureBody}>
              Generates your critical path in minutes, not weeks. Updates automatically as
              projects evolve — so your schedule reflects reality, not last quarter&rsquo;s plan.
            </p>
            <ul className={styles.featureList}>
              <li>Critical path generation</li>
              <li>Automatic schedule updates</li>
              <li>Dependency conflict detection</li>
              <li>Scenario &amp; delay modelling</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─── Credibility ─── */

function Credibility() {
  return (
    <section id="about" className={styles.credibility} aria-labelledby="credibility-heading">
      <div className="container">
        <div className={styles.credInner}>
          <div className={styles.credText}>
            <h2 id="credibility-heading" className={styles.sectionHeading}>
              Built by a programme manager who&rsquo;s been in your shoes.
            </h2>
            <p className={styles.credBio}>
              16+ years running capital delivery programmes at Google, JP Morgan, and Marsh
              McLennan. PMP certified. Imperial College MBA. I&rsquo;ve seen first-hand how
              institutional-grade governance transforms project outcomes — and how inaccessible
              it remains for most developers.
            </p>
            <p className={styles.credBio}>
              Currently based in Riyadh, I&rsquo;m building FLITRR for the real estate developers
              that the big consultancies have never prioritised. The tools exist. The rigour is
              proven. It just needs to be made accessible.
            </p>
            <div className={styles.credBadges}>
              <span className={styles.badge}>PMP Certified</span>
              <span className={styles.badge}>Imperial College MBA</span>
              <span className={styles.badge}>16+ Years Capital Delivery</span>
            </div>
          </div>
          <div className={styles.credVisual} aria-hidden="true">
            <div className={styles.credCard}>
              <div className={styles.credStat}>
                <span className={styles.credNum}>16+</span>
                <span className={styles.credLabel}>Years in capital delivery</span>
              </div>
              <div className={styles.credDivider} />
              <div className={styles.credStat}>
                <span className={styles.credNum}>3</span>
                <span className={styles.credLabel}>Global institutions</span>
              </div>
              <div className={styles.credDivider} />
              <div className={styles.credStat}>
                <span className={styles.credNum}>$B+</span>
                <span className={styles.credLabel}>Programmes managed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pilot Signup ─── */

function PilotSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | error

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error');
      return;
    }
    setStatus('success');
    setEmail('');
  };

  return (
    <section id="pilot" className={styles.pilot} aria-labelledby="pilot-heading">
      <div className="container">
        <div className={styles.pilotInner}>
          <h2 id="pilot-heading" className={styles.pilotHeading}>
            Join the founding pilot cohort.
          </h2>
          <p className={styles.pilotSub}>
            10 developers. Free access for 90 days. Shape the product with us.
          </p>

          {status === 'success' ? (
            <div className={styles.successMsg} role="status" aria-live="polite">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="9" stroke="#0d5a3d" strokeWidth="1.5" />
                <path d="M5.5 10.5l3 3 6-6" stroke="#0d5a3d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                Thank you — we&rsquo;ll be in touch at <strong>{email || 'your address'}</strong> shortly.
              </span>
            </div>
          ) : (
            <form className={styles.pilotForm} onSubmit={handleSubmit} noValidate>
              <div className={styles.inputWrap}>
                <label htmlFor="pilot-email" className={styles.srOnly}>
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
                  className={`${styles.emailInput} ${status === 'error' ? styles.inputError : ''}`}
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
              <button type="submit" className={styles.btnPrimary}>
                Request access
              </button>
            </form>
          )}

          <p className={styles.pilotNote}>
            No payment required. No commitment. Pilot spots are limited.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */

function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className="container">
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.footerWordmark}>FLITRR</span>
            <p className={styles.footerTagline}>
              Institutional-grade programme governance, made accessible.
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
              aria-label="FLITRR on LinkedIn (opens in new tab)"
            >
              LinkedIn
            </a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.footerCopy}>
            &copy; {new Date().getFullYear()} FLITRR. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <Problem />
        <Solution />
        <Credibility />
        <PilotSignup />
      </main>
      <Footer />
    </>
  );
}

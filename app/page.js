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
          aria-label="Flitrr home"
        >
          Flitrr
        </a>

        <nav
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}
          aria-label="Primary navigation"
        >
          <a href="#lifecycle" onClick={close}>Lifecycle</a>
          <a href="#products" onClick={close}>Products</a>
          <a href="#design-partner" onClick={close}>Get involved</a>
          <a href="#design-partner" className={styles.navCta} onClick={close}>
            Become a partner
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
   Hero — type-only brand statement
───────────────────────────────────────── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="container">
        <div className={styles.heroContent}>
          <p className={styles.heroWordmark} aria-hidden="true">Flitrr</p>
          <h1 id="hero-heading" className={styles.heroHeading}>
            One platform. End-to-end property development lifecycle solutions.
          </h1>
          <p className={styles.heroSub}>
            Built for independent and SME real estate developers.
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
   Lifecycle — five overlapping rings + amber swoosh
───────────────────────────────────────── */

const LIFECYCLE_STAGES = [
  'Planning',
  'Design',
  'Procurement',
  'Construction',
  'Handover',
];

function LifecycleVisual() {
  // viewBox 1000 x 300. Rings at radius 70 (was 80) to give labels more
  // breathing room inside each ring. Olympic-style 30% overlap → centre-
  // to-centre pitch = 2r * (1 - 0.30) = 140 * 0.70 = 98. Five rings span
  // 4 * 98 = 392. Centre the row inside 1000 → first cx = (1000 - 392)/2
  // = 304.
  const RING_RADIUS = 70;
  const RING_PITCH = 98;
  const FIRST_CX = 304;
  const CENTRE_Y = 150;

  // Swoosh anchors INSIDE the lifecycle, not in dead space.
  // Entry: lower-left interior of ring 1 (Planning).
  // Exit:  upper-right interior of ring 5 (Handover) — endpoint of the
  //        arrowhead, signalling arrival.
  const ENTRY_X = FIRST_CX - 38;                   // 304 - 38 = 266
  const ENTRY_Y = CENTRE_Y + 38;                   // 150 + 38 = 188
  const EXIT_X  = FIRST_CX + 4 * RING_PITCH + 38;  // 696 + 38 = 734
  const EXIT_Y  = CENTRE_Y - 38;                   // 150 - 38 = 112

  // Asymmetric S-curve. cp1 pulls the path UP early so it lifts through
  // Planning → Design. cp2 pulls DOWN through the middle so it dips
  // through Design → Procurement → Construction, then rises more
  // dramatically toward the upper-right exit.
  const SWOOSH_PATH =
    `M ${ENTRY_X} ${ENTRY_Y} ` +
    `C 410 88, 590 212, ${EXIT_X} ${EXIT_Y}`;

  return (
    <svg
      viewBox="0 0 1000 300"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Five overlapping rings labelled Planning, Design, Procurement, Construction, and Handover, with an amber swoosh tracing the journey from start to finish."
      className={styles.lifecycleSvg}
    >
      {/* 1. Ring fills — Accent 1 deep blue at low opacity for subtle
            physical presence (no longer pure wireframe). */}
      {LIFECYCLE_STAGES.map((label, i) => {
        const cx = FIRST_CX + i * RING_PITCH;
        return (
          <circle
            key={`fill-${label}`}
            cx={cx}
            cy={CENTRE_Y}
            r={RING_RADIUS}
            fill="var(--color-accent-1-deep-blue)"
            fillOpacity="0.04"
          />
        );
      })}

      {/* 2. Ring strokes — Accent 1 deep blue, 2.5px, no fill. */}
      {LIFECYCLE_STAGES.map((label, i) => {
        const cx = FIRST_CX + i * RING_PITCH;
        return (
          <circle
            key={`stroke-${label}`}
            cx={cx}
            cy={CENTRE_Y}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-accent-1-deep-blue)"
            strokeWidth="2.5"
          />
        );
      })}

      {/* 3. Swoosh — single asymmetric cubic Bezier in amber. Anchored
            to the journey: enters inside Planning, exits inside Handover
            with the arrowhead. Sits ABOVE the rings. */}
      <path
        d={SWOOSH_PATH}
        fill="none"
        stroke="var(--color-background-amber)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Arrowhead at the right end of the swoosh, aimed along the
          curve's exit tangent (cp2 → endpoint = upper-right). */}
      <path
        d={`M ${EXIT_X} ${EXIT_Y} l -11 -1 l 4 8 z`}
        fill="var(--color-background-amber)"
        stroke="var(--color-background-amber)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 4. Stage labels — rendered last so they sit ABOVE the swoosh
            and the ring strokes, keeping the journey readable. */}
      {LIFECYCLE_STAGES.map((label, i) => {
        const cx = FIRST_CX + i * RING_PITCH;
        return (
          <text
            key={`label-${label}`}
            x={cx}
            y={CENTRE_Y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-body), sans-serif"
            fontSize="14"
            fontWeight="500"
            fill="var(--color-accent-1-deep-blue)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function Lifecycle() {
  return (
    <section
      id="lifecycle"
      className={styles.lifecycle}
      aria-labelledby="lifecycle-heading"
    >
      <div className="container">
        <h2 id="lifecycle-heading" className={styles.sectionHeading}>
          From Planning to handover, end to end.
        </h2>
        <p className={styles.lifecycleSub}>
          Flitrr is building products for every stage of a property
          development project. PULSE is our first product, focused on
          properly setting up a project and efficient monitoring.
        </p>

        <div className={styles.lifecycleVisualWrap}>
          <LifecycleVisual />
        </div>

        <p className={styles.lifecycleFootline}>
          One platform. Practical solutions for property development.
        </p>
      </div>
    </section>
  );
}


/* ─────────────────────────────────────────
   Products — single PULSE coming-soon card
───────────────────────────────────────── */

function Products() {
  return (
    <section
      id="products"
      className={styles.products}
      aria-labelledby="products-heading"
    >
      <div className="container">
        <h2 id="products-heading" className={styles.sectionHeading}>
          Our first product.
        </h2>

        <article className={styles.productCard}>
          <span className={styles.productPill}>
            Coming soon · Private development
          </span>
          <h3 className={styles.productHeading}>PULSE</h3>
          <p className={styles.productBody}>
            Properly set up your projects, then monitor what matters across
            every stage. PULSE is built for the execution arc of a
            development project, design through completion.
          </p>
          <a href="/pulse" className={styles.productCta}>
            Learn more about PULSE
          </a>
        </article>

        <p className={styles.productsFootline}>
          More products on the way. Each will tackle a different stage of
          the development lifecycle.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Design Partner — Flitrr-level founding programme
───────────────────────────────────────── */

const DESIGN_PARTNER_BLOCKS = [
  {
    heading: 'What it is',
    body: 'A 90-day programme. Working sessions while we build. First access on release. A direct say in what we ship next.',
  },
  {
    heading: 'What you give',
    body: 'Two real projects, two hours a week, honest feedback. A willingness to shape products before they are finished.',
  },
  {
    heading: 'What you get',
    body: 'Lifetime founding-member pricing on every Flitrr product. Priority access to each product as it ships. A direct line to the team.',
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
    <section
      id="design-partner"
      className={styles.pilot}
      aria-labelledby="design-partner-heading"
    >
      <div className="container">
        <h2 id="design-partner-heading" className={styles.sectionHeading}>
          Be a Flitrr design partner.
        </h2>
        <p className={styles.pilotSub}>
          Ten developers. Direct input into every product Flitrr ships.
          First access to PULSE the moment it is ready.
        </p>

        <div className={styles.pilotBlocks}>
          {DESIGN_PARTNER_BLOCKS.map(({ heading, body }) => (
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
                  Thank you. We&rsquo;ll be in touch shortly to confirm your spot.
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
                  Request a design partner spot
                </button>
              </form>
            )}
            <p className={styles.pilotNote}>
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
            Ten design partner spots. First come, first served.
          </h2>
          <p className={styles.footerCtaBody}>
            Flitrr will be shaped by the developers who use it first. If
            that is the seat you want, take it now.
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
   Footer
───────────────────────────────────────── */

function Footer() {
  return (
    <footer id="about" className={styles.footer} role="contentinfo">
      <div className="container">
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.footerWordmark}>Flitrr</span>
            <p className={styles.footerSubTagline}>
              One platform for independent and SME real estate developers.
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
        <Lifecycle />
        <Products />
        <DesignPartner />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}

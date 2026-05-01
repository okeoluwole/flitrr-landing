import { createClient } from '../../lib/supabase/server';
import PulseNav from './components/PulseNav';
import PulseDesignPartner from './components/PulseDesignPartner';
import PulseFaq from './components/PulseFaq';
import styles from './page.module.css';

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
   Page (server component)
───────────────────────────────────────── */

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navUser = user ? { id: user.id, email: user.email } : null;

  return (
    <>
      <PulseNav user={navUser} />
      <main id="main-content">
        <PulseHero />
        <Wedge />
        <GatingStory />
        <Modules />
        <PulseDesignPartner />
        <PulseFaq />
        <PulseFooterCta />
      </main>
      <PulseFooter />
    </>
  );
}

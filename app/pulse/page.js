import Image from 'next/image';
import { createClient } from '../../lib/supabase/server';
import PulseNav from './components/PulseNav';
import PulseDesignPartner from './components/PulseDesignPartner';
import PulseFaq from './components/PulseFaq';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   Section 2: Hero
───────────────────────────────────────── */

function PulseHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.heroMedia} aria-hidden="true">
        <Image
          src="/images/texture-facades.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImg}
        />
      </div>
      <div className={`container ${styles.heroContent}`}>
        <h1 id="hero-heading" className={`${styles.heroWordmark} riseIn`}>
          PULSE
        </h1>
        <p
          className={`${styles.heroTagline} riseIn`}
          style={{ '--rise-delay': '80ms' }}
        >
          Monitoring What Matters.
        </p>
        <p
          className={`${styles.heroSentence} riseIn`}
          style={{ '--rise-delay': '160ms' }}
        >
          Every objective. Every project. Defined, classified, monitored.
        </p>
        <div
          className={`${styles.heroCtas} riseIn`}
          style={{ '--rise-delay': '240ms' }}
        >
          <a href="#design-partner" className={styles.btnPrimary}>
            Become a design partner
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 3: The Wedge (glass / rubber)

   The flagship classification made physical: a lit glass sphere
   (critical: protected, amber-lit, watched) against a matte rubber
   sphere (flexible: absorbs movement). Crafted dimensional SVG,
   not stock; the one place the page renders its own object.
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

function GlassSphere() {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A glass sphere, lit from within"
      className={styles.objectiveIcon}
    >
      <defs>
        <radialGradient id="glassBody" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#EDF1F5" stopOpacity="0.34" />
          <stop offset="42%" stopColor="#EDF1F5" stopOpacity="0.1" />
          <stop offset="78%" stopColor="#0B141E" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0B141E" stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id="glassGlow" cx="50%" cy="78%" r="55%">
          <stop offset="0%" stopColor="#F4C031" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#F4C031" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#F4C031" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="glassRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EDF1F5" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#EDF1F5" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F4C031" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Amber pooling beneath: the light it casts on the ground. */}
      <ellipse cx="60" cy="106" rx="30" ry="5" fill="#F4C031" opacity="0.22" />
      <circle cx="60" cy="56" r="40" fill="url(#glassBody)" />
      <circle cx="60" cy="56" r="40" fill="url(#glassGlow)" />
      <circle
        cx="60"
        cy="56"
        r="39.25"
        fill="none"
        stroke="url(#glassRim)"
        strokeWidth="1.5"
      />
      {/* Specular highlight. */}
      <ellipse
        cx="46"
        cy="38"
        rx="12"
        ry="6.5"
        fill="#EDF1F5"
        opacity="0.55"
        transform="rotate(-28 46 38)"
      />
      {/* Refracted base caustic. */}
      <ellipse cx="62" cy="84" rx="14" ry="4.5" fill="#F4C031" opacity="0.4" />
    </svg>
  );
}

function RubberSphere() {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A matte rubber sphere"
      className={styles.objectiveIcon}
    >
      <defs>
        <radialGradient id="rubberBody" cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#4A7196" />
          <stop offset="55%" stopColor="#2C4A66" />
          <stop offset="100%" stopColor="#16273A" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="28" ry="5" fill="#000000" opacity="0.35" />
      <circle cx="60" cy="56" r="40" fill="url(#rubberBody)" />
      {/* Soft matte highlight, no gloss. */}
      <ellipse
        cx="47"
        cy="39"
        rx="13"
        ry="7"
        fill="#EDF1F5"
        opacity="0.14"
        transform="rotate(-26 47 39)"
      />
    </svg>
  );
}

function Wedge() {
  return (
    <section className={styles.wedge} aria-labelledby="wedge-heading">
      <div className="container">
        <div className={styles.wedgeGrid}>
          <div className={styles.wedgeCopy} data-reveal>
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

          <div className={styles.wedgePanels} data-reveal>
            <div className={`${styles.objectivePanel} ${styles.panelGlass}`}>
              <h3 className={styles.objectivePanelHeading}>GLASS</h3>
              <GlassSphere />
              <ul className={styles.objectiveList}>
                {GLASS_OBJECTIVES.map((item) => (
                  <li key={item} className={styles.objectiveItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${styles.objectivePanel} ${styles.panelRubber}`}>
              <h3 className={styles.objectivePanelHeading}>RUBBER</h3>
              <RubberSphere />
              <ul className={styles.objectiveList}>
                {RUBBER_OBJECTIVES.map((item) => (
                  <li key={item} className={styles.objectiveItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className={styles.wedgeCloser} data-reveal>
          Glass shatters. Rubber bounces. Know the difference.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 4: The Gating Story
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
      viewBox="0 0 64 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 10h52M46 3l10 7-10 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
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
        <h2 id="gating-heading" className={styles.sectionHeading} data-reveal>
          You start with Project Initiation. Everything else flows from
          there.
        </h2>
        <p className={styles.gatingBody} data-reveal>
          Before PULSE tracks what&rsquo;s happening, it asks you to define
          what matters. Project Initiation is a guided 15-minute flow that
          produces your <strong>Project Brief</strong>. The Brief is a
          formal document setting out the project&rsquo;s vision,
          objectives, glass-ball and rubber-ball criticality, constraints,
          milestones, and stakeholders. Once that&rsquo;s done, the rest
          of PULSE unlocks. The Action Log, Risk Register, Programme
          Tracker, and Executive Dashboard all read from the Brief.
        </p>

        <div className={styles.gatingFlow} data-reveal>
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

        <p className={styles.gatingNote} data-reveal>
          PULSE works best when you start with Project Initiation. You can
          configure manually if you need to. But the discipline is what
          makes the rest of the product powerful.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Section 5: The Modules

   Each card opens with a miniature of the module's own surface,
   drawn in the product's real visual vocabulary (criticality chips,
   status segments, severity, bars, figures) on a white paper panel.
   Decorative and aria-hidden; the status pill tells the truth about
   what is built.
───────────────────────────────────────── */

const MODULES = [
  {
    name: 'Project Initiation',
    statusLabel: 'In build. Design partners Q3 2026.',
    statusVariant: 'inBuild',
    vignette: 'initiation',
    body: 'A guided 15-minute flow that produces your Project Brief. Vision, objectives, glass-ball and rubber-ball criticality, constraints, milestones, stakeholders. Exportable to PDF and Word.',
    tagline: 'The foundation everything else builds on.',
    featured: true,
  },
  {
    name: 'Action Log',
    statusLabel: 'Designed. Build follows Project Initiation.',
    statusVariant: 'designed',
    vignette: 'actions',
    body: 'Every open action across every project, classified against the glass-ball objectives from your Brief. Flagged automatically when an action threatens a glass-ball.',
  },
  {
    name: 'Risk Register',
    statusLabel: 'Designed. Build to follow.',
    statusVariant: 'designed',
    vignette: 'risks',
    body: 'Structured risk capture tagged to glass-ball objectives. Mitigation tracked alongside the actions that close it.',
  },
  {
    name: 'Programme Tracker',
    statusLabel: 'Designed. Build to follow.',
    statusVariant: 'designed',
    vignette: 'programme',
    body: 'Critical-path visibility with dependencies, float, and schedule impact. The institutional scheduler, finally built for developers without a PMO.',
  },
  {
    name: 'Executive Dashboard',
    statusLabel: 'Planned.',
    statusVariant: 'planned',
    vignette: 'dashboard',
    body: 'Cross-project health summary. Stakeholder-specific views. The view a JV partner, lender, or board member needs in one place.',
  },
];

function Vignette({ kind }) {
  if (kind === 'initiation') {
    return (
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.vgSteps}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className={styles.vgStepLink} />}
              <span
                className={`${styles.vgStep} ${
                  i < 4 ? styles.vgStepDone : i === 4 ? styles.vgStepCurrent : ''
                }`}
              />
            </span>
          ))}
        </div>
        <div className={styles.vgDoc}>
          <span className={styles.vgDocTitle} />
          <span className={styles.vgDocLine} />
          <span className={`${styles.vgDocLine} ${styles.vgDocLineShort}`} />
          <span className={styles.vgDocSeal}>Baseline locked</span>
        </div>
      </div>
    );
  }

  if (kind === 'actions') {
    return (
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.vgRow}>
          <span className={`${styles.vgChip} ${styles.vgChipCritical}`}>
            Critical
          </span>
          <span className={styles.vgText} />
          <span className={styles.vgSeg}>
            <span className={styles.vgSegItem} />
            <span className={`${styles.vgSegItem} ${styles.vgSegOn}`} />
            <span className={styles.vgSegItem} />
          </span>
        </div>
        <div className={`${styles.vgRow} ${styles.vgRowFaded}`}>
          <span className={styles.vgChip}>Standard</span>
          <span className={`${styles.vgText} ${styles.vgTextShort}`} />
          <span className={styles.vgSeg}>
            <span className={`${styles.vgSegItem} ${styles.vgSegOn}`} />
            <span className={styles.vgSegItem} />
            <span className={styles.vgSegItem} />
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'risks') {
    return (
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.vgRow}>
          <span className={`${styles.vgChip} ${styles.vgChipCritical}`}>
            Critical
          </span>
          <span className={styles.vgText} />
          <span className={styles.vgSev}>Serious</span>
        </div>
        <div className={`${styles.vgRow} ${styles.vgRowFaded}`}>
          <span className={styles.vgChip}>Standard</span>
          <span className={`${styles.vgText} ${styles.vgTextShort}`} />
          <span className={`${styles.vgSev} ${styles.vgSevQuiet}`}>
            Watching
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'programme') {
    return (
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.vgBars}>
          <span className={styles.vgToday} />
          <span className={styles.vgBar} style={{ width: '72%' }} />
          <span
            className={`${styles.vgBar} ${styles.vgBarAmber}`}
            style={{ width: '54%', marginLeft: '18%' }}
          />
          <span className={styles.vgBar} style={{ width: '34%', marginLeft: '44%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vignette} aria-hidden="true">
      <div className={styles.vgKpis}>
        <span className={styles.vgKpi}>
          <span className={styles.vgKpiNum}>12</span>
          <span className={styles.vgKpiLabel}>Open</span>
        </span>
        <span className={styles.vgKpi}>
          <span className={`${styles.vgKpiNum} ${styles.vgKpiNumAmber}`}>3</span>
          <span className={styles.vgKpiLabel}>Critical</span>
        </span>
        <span className={styles.vgKpi}>
          <span className={styles.vgKpiNum}>82%</span>
          <span className={styles.vgKpiLabel}>On track</span>
        </span>
      </div>
    </div>
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
        <h2 id="modules-heading" className={styles.sectionHeading} data-reveal>
          Five modules. One discipline.
        </h2>
        <p className={styles.modulesSub} data-reveal>
          PULSE is being built one module at a time. Each module shares
          the same glass-ball and rubber-ball spine. What you classify in
          Project Initiation drives what gets flagged everywhere else.
        </p>

        <div className={styles.moduleGrid}>
          {MODULES.map((mod) => (
            <article
              key={mod.name}
              className={`${styles.moduleCard} ${
                mod.featured ? styles.moduleCardFeatured : ''
              }`}
              data-reveal
            >
              <Vignette kind={mod.vignette} />
              <div className={styles.moduleCardBody}>
                <span
                  className={`${styles.statusPill} ${pillClassFor(mod.statusVariant)}`}
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
   Section 9: Footer
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
              href="https://www.linkedin.com/company/flitrr/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
              aria-label="Flitrr on LinkedIn (opens in new tab)"
            >
              LinkedIn
            </a>
            <a href="/privacy" className={styles.footerLink}>
              Privacy
            </a>
            <a href="/terms" className={styles.footerLink}>
              Terms
            </a>
            <a href="/" className={styles.footerLink}>
              Back to Flitrr
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
      <main id="main-content" className={styles.main}>
        <PulseHero />
        <Wedge />
        <GatingStory />
        <Modules />
        <PulseFaq />
        <PulseDesignPartner />
      </main>
      <PulseFooter />
    </>
  );
}

import { createClient } from '../lib/supabase/server';
import HomeNav from './components/HomeNav';
import HomeDesignPartner from './components/HomeDesignPartner';
import BriefDocument from './pulse/app/components/BriefDocument';
import { assembleBrief } from './pulse/app/components/briefModel';
import styles from './page.module.css';

// A realistic sample project, assembled through the real brief pipeline
// (assembleBrief) so the marketing preview renders the genuine BriefDocument
// rather than a hand-built div mock. Decorative only; the live product sits
// behind the login. Figures are illustrative.
const SAMPLE_BRIEF_STATE = {
  def: {
    name: 'Holloway Place',
    project_type: 'Residential',
    category: 'New build',
    size: '24 units',
    location: 'Salford',
    target_completion_date: '2027-03-31',
    currency: 'GBP',
    budget: '6400000',
    projected_gdv: '9200000',
    projected_roi: '28',
    financial_detail_url: '',
  },
  ctx: {
    strategic_rationale: 'Funded by a senior facility with developer equity.',
    exit_strategy: '',
    target_end_user: '',
    strategic_alignment: '',
  },
  objectives: [
    { id: 'o-scope', objective_type: 'scope', classification: 'non_negotiable', definition: '24 residential units, 4,200 m2 GIA.', tolerance: '' },
    { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable', definition: 'Delivery within the GBP 6.4m budget.', tolerance: '' },
    { id: 'o-time', objective_type: 'time', classification: 'flexible', definition: 'Practical completion in Q1 2027.', tolerance: 'Up to 8 weeks of slippage before sales are affected.' },
    { id: 'o-quality', objective_type: 'quality', classification: 'flexible', definition: 'Local market specification.', tolerance: 'Internal finishes can flex to protect cost.' },
    { id: 'o-funding', objective_type: 'funding', classification: 'non_negotiable', definition: 'Senior facility plus equity, drawn to programme.', tolerance: '' },
  ],
  rankOrder: ['funding', 'cost', 'scope', 'time', 'quality'],
  lists: {
    milestones: [
      { name: 'Funding close', target_date: '2026-07-31', criticality: 'critical', linked_objective_id: 'o-funding' },
      { name: 'Planning approval', target_date: '2026-09-30', criticality: 'standard', linked_objective_id: 'o-scope' },
      { name: 'Contractor appointed', target_date: '2026-11-30', criticality: 'critical', linked_objective_id: 'o-cost' },
      { name: 'Practical completion', target_date: '2027-03-31', criticality: 'standard', linked_objective_id: 'o-time' },
    ],
    workstreams: [
      { name: 'Funding and finance', lead: 'A. Mensah', criticality: 'critical', linked_objective_id: 'o-funding' },
      { name: 'Design and planning', lead: 'R. Okafor', criticality: 'standard', linked_objective_id: 'o-scope' },
      { name: 'Cost and commercial', lead: 'J. Bello', criticality: 'critical', linked_objective_id: 'o-cost' },
    ],
    risks: [
      { description: 'Funding tranche delayed past the construction start', likelihood: 'medium', impact: 'high', criticality: 'critical', linked_objective_id: 'o-funding', mitigation: 'Conditions tracked weekly with the lender.' },
      { description: 'Construction costs exceed the fixed budget', likelihood: 'high', impact: 'high', criticality: 'critical', linked_objective_id: 'o-cost', mitigation: 'Two-stage tender with a held contingency.' },
      { description: 'Planning conditions force a redesign', likelihood: 'medium', impact: 'medium', criticality: 'critical', linked_objective_id: 'o-scope', mitigation: 'Pre-application advice secured.' },
      { description: 'Programme slips beyond the spring sales window', likelihood: 'medium', impact: 'medium', criticality: 'critical', linked_objective_id: 'o-time', mitigation: 'Float held in the early works.' },
      { description: 'Sales slower than forecast', likelihood: 'low', impact: 'medium', criticality: 'standard', linked_objective_id: null, mitigation: 'Phased release of units.' },
    ],
  },
};

/* ─────────────────────────────────────────
   Static (server-renderable) sections live in this file.
   Interactive client components live in ./components/.
───────────────────────────────────────── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className="container">
        <div className={styles.heroContent}>
          <p
            className={`${styles.heroWordmark} riseIn`}
            aria-hidden="true"
          >
            Flitrr
          </p>
          <h1
            id="hero-heading"
            className={`${styles.heroHeading} riseIn`}
            style={{ '--rise-delay': '80ms' }}
          >
            One platform. End-to-end property development lifecycle solutions.
          </h1>
          <p
            className={`${styles.heroSub} riseIn`}
            style={{ '--rise-delay': '160ms' }}
          >
            Built for independent and SME real estate developers.
          </p>
          <div
            className={`${styles.heroCtas} riseIn`}
            style={{ '--rise-delay': '240ms' }}
          >
            <a href="#design-partner" className={styles.btnPrimary}>
              Become a design partner
            </a>
            <a href="/pulse" className={styles.heroCtaSecondary}>
              See how PULSE works
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8h9M8.5 4l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// The eight lifecycle stages (the PULSE framework, Section 4), land to
// disposal. The stages are the universal developer lifecycle; PULSE is shown
// as an overlay spanning the delivery arc (Stage 1 to 7), not a single stage.
// Each stage carries a simple line icon.
const LIFECYCLE_STAGES = [
  {
    label: 'Land & acquisition',
    paths: (
      <>
        <path d="M12 21.5c3.8-4.3 5.8-7.3 5.8-10.5a5.8 5.8 0 1 0-11.6 0c0 3.2 2 6.2 5.8 10.5z" />
        <circle cx="12" cy="10.8" r="2.1" />
      </>
    ),
  },
  {
    label: 'Objectives & funding',
    paths: (
      <>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="3.3" />
      </>
    ),
  },
  {
    label: 'Consultant appointment',
    paths: (
      <>
        <circle cx="12" cy="8.5" r="3.2" />
        <path d="M5.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      </>
    ),
  },
  {
    label: 'Design & approvals',
    paths: (
      <>
        <path d="M5 19l1.2-4.2L16 5l3 3-9.8 9.8L5 19z" />
        <path d="M14.2 6.8l3 3" />
      </>
    ),
  },
  {
    label: 'Contractor procurement',
    paths: (
      <>
        <path d="M7 3.5h6.5L18 8v12.5H7z" />
        <path d="M13.5 3.5V8H18" />
        <path d="M9.5 13h6M9.5 16h4" />
      </>
    ),
  },
  {
    label: 'Construction',
    paths: (
      <>
        <path d="M3.5 17.5h17" />
        <path d="M5.5 17.5a6.5 6.5 0 0 1 13 0" />
        <path d="M12 6.5v4.5" />
        <path d="M9.5 11h5" />
      </>
    ),
  },
  {
    label: 'Completion & handover',
    paths: (
      <>
        <circle cx="8" cy="11.5" r="3.3" />
        <path d="M11.2 11.5H20" />
        <path d="M16.5 11.5v3" />
        <path d="M19 11.5v2.4" />
      </>
    ),
  },
  {
    label: 'Sales & disposal',
    paths: (
      <>
        <path d="M20 4.5h-7L4.5 13l6.5 6.5L20 11z" />
        <circle cx="16.2" cy="8.3" r="1.3" />
      </>
    ),
  },
];

function LifecycleTrack() {
  return (
    <div
      className={styles.track}
      role="list"
      aria-label="The eight stages of a development project, from land to disposal"
    >
      {LIFECYCLE_STAGES.map((stage) => (
        <div key={stage.label} role="listitem" className={styles.trackStage} data-reveal>
          <span className={styles.trackNode}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={styles.trackIcon}
            >
              {stage.paths}
            </svg>
          </span>
          <span className={styles.trackLabel}>{stage.label}</span>
        </div>
      ))}

      {/* PULSE coverage: it runs the delivery arc, Stage 1 through 7. */}
      <div className={styles.pulseBand} aria-hidden="true">
        <span className={styles.pulseBandLabel}>PULSE</span>
        <span className={styles.pulseBar}>
          <span className={styles.pulseGlow} />
        </span>
      </div>
    </div>
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
        <h2 id="lifecycle-heading" className={styles.sectionHeading} data-reveal>
          From land to disposal, end to end.
        </h2>
        <p className={styles.lifecycleSub} data-reveal>
          A development project runs through eight stages, each with a decision
          gate before the next begins. Flitrr is building products for every
          stage. PULSE is our first, for setting a project up properly and
          monitoring what matters from there.
        </p>

        <div className={styles.lifecycleTrackWrap}>
          <LifecycleTrack />
        </div>

        <p className={styles.lifecycleFootline} data-reveal>
          One platform. Practical solutions for property development.
        </p>
      </div>
    </section>
  );
}

// The marketing preview: the real BriefDocument, assembled from the sample
// project above and rendered into a scaled, clipped paper frame so the genuine
// locked brief peeks in. This is the actual product component (the skill's
// "real component preview"), not a div replica, so it never drifts from what
// the app produces. Decorative and aria-hidden; the brief's own text is read
// in context inside the app, not here.
//
// To pin a static exported image instead (e.g. a PDF page captured from the
// app's Download PDF), replace the inner BriefDocument with a next/image
// pointing at the asset; the frame and caption stay as they are.
function BriefPreview() {
  const model = assembleBrief(SAMPLE_BRIEF_STATE);
  return (
    <div className={styles.briefPreview} aria-hidden="true">
      <div className={styles.briefViewport}>
        <div className={styles.briefScale}>
          <BriefDocument
            model={model}
            lens="jv"
            lockState={{
              locked: true,
              version: 1,
              generatedAt: '2026-06-01T09:00:00.000Z',
            }}
          />
        </div>
        <div className={styles.briefFade} />
      </div>
    </div>
  );
}

function Products() {
  return (
    <section
      id="products"
      className={styles.products}
      aria-labelledby="products-heading"
    >
      <div className="container">
        <h2 id="products-heading" className={styles.sectionHeading} data-reveal>
          Our first product.
        </h2>

        <div className={styles.productLayout}>
          <article className={styles.productCard} data-reveal>
            <span className={styles.productPill}>Live for design partners</span>
            <h3 className={styles.productHeading}>PULSE</h3>
            <p className={styles.productLede}>Defined. Classified. Monitored.</p>
            <p className={styles.productBody}>
              Set a project up properly, then watch what matters across every
              stage. PULSE gives independent developers the delivery discipline
              big firms buy from consultancies: classified objectives, a
              version-locked brief built for your lender or JV partner, and
              monitoring that scales to what you cannot afford to get wrong.
            </p>
            <div className={styles.productCtas}>
              <a href="/pulse" className={styles.btnPrimary}>
                See how PULSE works
              </a>
              <a href="#design-partner" className={styles.productCta}>
                Become a design partner
              </a>
            </div>
          </article>

          <div className={styles.productPreview} data-reveal>
            <BriefPreview />
            <p className={styles.productPreviewCaption}>
              A locked PULSE brief, framed for a JV partner.
            </p>
          </div>
        </div>

        <p className={styles.productsFootline} data-reveal>
          More products on the way. Each will tackle a different stage of
          the development lifecycle.
        </p>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className={styles.footerCta} aria-labelledby="fcta-heading">
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
        <div className={styles.footerCtaInner} data-reveal>
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
            <a href="/privacy" className={styles.footerLink}>
              Privacy
            </a>
            <a href="/terms" className={styles.footerLink}>
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
   Page (server component)

   Reads the auth user via the SERVER Supabase client and passes it to
   the client Nav so the initial render matches the auth state with
   no hydration flicker.
───────────────────────────────────────── */

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The server client returns a plain user object or null. The Nav
  // only needs to know if the session exists, but we pass the whole
  // object so a future header avatar can use email / metadata.
  const navUser = user ? { id: user.id, email: user.email } : null;

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <HomeNav user={navUser} />
      <main id="main-content">
        <Hero />
        <Lifecycle />
        <Products />
        <HomeDesignPartner />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}

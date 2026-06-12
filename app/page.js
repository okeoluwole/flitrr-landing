import Image from 'next/image';
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
      <div className={styles.heroMedia} aria-hidden="true">
        <Image
          src="/images/hero-crane-dusk.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImg}
        />
      </div>
      <div className={`container ${styles.heroContent}`}>
        <h1 id="hero-heading" className={`${styles.heroHeading} riseIn`}>
          One platform for the whole property development lifecycle.
        </h1>
        <p
          className={`${styles.heroSub} riseIn`}
          style={{ '--rise-delay': '80ms' }}
        >
          Built for independent and SME real estate developers in the UK and
          Nigeria. From the land you secure to the asset you sell.
        </p>
        <div
          className={`${styles.heroCtas} riseIn`}
          style={{ '--rise-delay': '160ms' }}
        >
          <a href="#design-partner" className={styles.btnPrimary}>
            Become a design partner
          </a>
          <a href="/pulse" className={styles.btnGhost}>
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
    </section>
  );
}

// The eight lifecycle stages (the PULSE framework, Section 4), land to
// disposal, each carried by a graded photograph. PULSE covers the delivery
// arc, stages 1 to 7: the amber pulse line runs through those frames, and
// every tick on it is a gate. Swap any frame for real project photography by
// replacing the file in /public/images/lifecycle (see CREDITS.md).
const LIFECYCLE_STAGES = [
  {
    n: '0',
    label: 'Land & acquisition',
    desc: 'Secure the site, clear the title.',
    img: '/images/lifecycle/land.jpg',
    alt: 'Open land at sunset, before acquisition',
    covered: false,
  },
  {
    n: '1',
    label: 'Objectives & funding',
    desc: 'Classify what cannot move. Confirm the money.',
    img: '/images/lifecycle/signing.jpg',
    alt: 'Signing the funding agreement',
    covered: true,
  },
  {
    n: '2',
    label: 'Consultant appointment',
    desc: 'Scope and appoint the professional team.',
    img: '/images/lifecycle/consultants.jpg',
    alt: 'An architect working over drawings',
    covered: true,
  },
  {
    n: '3',
    label: 'Design & approvals',
    desc: 'Freeze the design. Secure permission.',
    img: '/images/lifecycle/drafting.jpg',
    alt: 'Hands drafting against a timber scale rule',
    covered: true,
  },
  {
    n: '4',
    label: 'Contractor procurement',
    desc: 'Tender, negotiate, execute the contract.',
    img: '/images/lifecycle/crew.jpg',
    alt: 'A crew mobilised on rebar columns',
    covered: true,
  },
  {
    n: '5',
    label: 'Construction',
    desc: 'Build it. Watch cost, time and quality.',
    img: '/images/lifecycle/cranes.jpg',
    alt: 'Tower cranes over a scaffolded structure',
    covered: true,
  },
  {
    n: '6',
    label: 'Completion & handover',
    desc: 'Practical completion, snagging, final accounts.',
    img: '/images/lifecycle/handover.jpg',
    alt: 'A finished home at dusk with the lights on',
    covered: true,
  },
  {
    n: '7',
    label: 'Sales & disposal',
    desc: 'Realise the value. Close the loop.',
    img: '/images/lifecycle/sales.jpg',
    alt: 'An apartment block at blue hour, windows lit',
    covered: true,
  },
];

function Filmstrip() {
  return (
    <div className={styles.strip}>
      <div
        className={styles.stripScroller}
        role="region"
        aria-label="The eight stages of a development project, from land to disposal"
        tabIndex={0}
      >
        <div className={styles.stripInner} role="list">
          {LIFECYCLE_STAGES.map((stage, i) => (
            <figure
              key={stage.n}
              role="listitem"
              className={`${styles.frame} ${stage.covered ? styles.frameCovered : ''}`}
              data-reveal
            >
              <Image
                src={stage.img}
                alt={stage.alt}
                fill
                sizes="(max-width: 760px) 100vw, 320px"
                className={styles.frameImg}
              />
              {stage.covered && (
                <span
                  className={`${styles.frameSpine} ${i === 1 ? styles.frameSpineFirst : ''}`}
                  aria-hidden="true"
                />
              )}
              <span className={styles.frameNum} aria-hidden="true">
                {stage.n}
              </span>
              <figcaption className={styles.frameText}>
                <span className={styles.frameLabel}>{stage.label}</span>
                <span className={styles.frameDesc}>{stage.desc}</span>
              </figcaption>
            </figure>
          ))}

          {/* PULSE coverage: the line runs the delivery arc, stages 1 to 7,
              with a gate tick at each stage boundary. */}
          <div className={styles.pulseLine} aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className={styles.pulseTick}
                style={{ '--i': i }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className={styles.stripCaption} data-reveal>
        <span className={styles.captionSwatch} aria-hidden="true" />
        <span>
          The amber line is PULSE: it runs the delivery arc, stages 1 to 7.
          Every tick is a gate, a deliberate go or no-go before the next stage
          begins.
        </span>
      </p>
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
          A development project runs through eight stages, each gated before
          the next begins. PULSE covers the delivery arc, stages one to seven:
          set the project up properly, then monitor what matters from there.
        </p>
      </div>

      <Filmstrip />
    </section>
  );
}

// The marketing preview: the real BriefDocument, assembled from the sample
// project above and rendered into a scaled, clipped paper frame so the genuine
// locked brief sits on the ink like a signed document. This is the actual
// product component, not a div replica, so it never drifts from what the app
// produces. Decorative and aria-hidden; the brief's own text is read in
// context inside the app, not here.
//
// To pin a static exported image instead (e.g. a PDF page captured from the
// app's Download PDF), replace the inner BriefDocument with a next/image
// pointing at the asset; the frame, seal, and caption stay as they are.
function BriefPreview() {
  const model = assembleBrief(SAMPLE_BRIEF_STATE);
  return (
    <div className={styles.briefPreview} aria-hidden="true">
      <span className={styles.briefSeal}>Baseline locked, v1</span>
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
          <article className={styles.productInfo} data-reveal>
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
          More products on the way. Each will tackle a different stage of the
          development lifecycle.
        </p>
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
      <main id="main-content" className={styles.main}>
        <Hero />
        <Lifecycle />
        <Products />
        <HomeDesignPartner />
      </main>
      <Footer />
    </>
  );
}

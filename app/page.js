import { createClient } from '../lib/supabase/server';
import HomeNav from './components/HomeNav';
import HomeDesignPartner from './components/HomeDesignPartner';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   Static (server-renderable) sections live in this file.
   Interactive client components live in ./components/.
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
// disposal. PULSE is the first product and begins at Stage 1.
const LIFECYCLE_STAGES = [
  { n: '0', label: 'Land & acquisition' },
  { n: '1', label: 'Objectives & funding' },
  { n: '2', label: 'Consultant appointment' },
  { n: '3', label: 'Design & approvals' },
  { n: '4', label: 'Contractor procurement' },
  { n: '5', label: 'Construction' },
  { n: '6', label: 'Completion & handover' },
  { n: '7', label: 'Sales & disposal' },
];

function LifecycleTrack() {
  return (
    <ol
      className={styles.track}
      aria-label="The eight stages of a development project, from land to disposal"
    >
      {LIFECYCLE_STAGES.map((stage) => {
        const isPulse = stage.n === '1';
        return (
          <li
            key={stage.n}
            className={`${styles.trackStage} ${isPulse ? styles.trackStagePulse : ''}`}
          >
            <span className={styles.trackNode} aria-hidden="true">
              {stage.n}
            </span>
            <span className={styles.trackText}>
              <span className={styles.trackLabel}>{stage.label}</span>
              {isPulse && <span className={styles.trackTag}>PULSE</span>}
            </span>
          </li>
        );
      })}
    </ol>
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
          From land to disposal, end to end.
        </h2>
        <p className={styles.lifecycleSub}>
          A development project runs through eight stages, each with a decision
          gate before the next begins. Flitrr is building products for every
          stage. PULSE is our first, for setting a project up properly and
          monitoring what matters from there.
        </p>

        <div className={styles.lifecycleTrackWrap}>
          <LifecycleTrack />
        </div>

        <p className={styles.lifecycleFootline}>
          One platform. Practical solutions for property development.
        </p>
      </div>
    </section>
  );
}

// A compact, illustrative replica of a locked PULSE brief. Decorative
// (aria-hidden): it shows what the product produces, not real data.
function BriefMock() {
  return (
    <div className={styles.mock} aria-hidden="true">
      <div className={styles.mockHead}>
        <div className={styles.mockBrand}>
          <span className={styles.mockBug}>P</span>
          <span className={styles.mockBrandName}>PULSE</span>
        </div>
        <div className={styles.mockTitle}>Holloway Place</div>
        <div className={styles.mockSub}>24 units, Salford</div>
        <div className={styles.mockChips}>
          <span className={styles.mockChipLock}>Baseline locked</span>
          <span className={styles.mockChip}>Version 1</span>
        </div>
      </div>
      <div className={styles.mockKpis}>
        <div className={styles.mockKpi}>
          <span>Budget</span>
          <b>£6.4m</b>
        </div>
        <div className={styles.mockKpi}>
          <span>Protected</span>
          <b>3 of 5</b>
        </div>
        <div className={styles.mockKpi}>
          <span>Critical risks</span>
          <b>4</b>
        </div>
      </div>
      <div className={styles.mockSection}>
        <span className={styles.mockSectionTitle}>Objectives</span>
        <div className={`${styles.mockRow} ${styles.mockRowNn}`}>
          <span className={styles.mockRowName}>Cost</span>
          <span className={styles.mockRowTagNn}>Protected</span>
        </div>
        <div className={`${styles.mockRow} ${styles.mockRowNn}`}>
          <span className={styles.mockRowName}>Funding</span>
          <span className={styles.mockRowTagNn}>Protected</span>
        </div>
        <div className={styles.mockRow}>
          <span className={styles.mockRowName}>Time</span>
          <span className={styles.mockRowTagFx}>Has flex</span>
        </div>
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
        <h2 id="products-heading" className={styles.sectionHeading}>
          Our first product.
        </h2>

        <div className={styles.productLayout}>
          <article className={styles.productCard}>
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

          <div className={styles.productPreview}>
            <BriefMock />
            <p className={styles.productPreviewCaption}>
              A PULSE brief, framed for a lender.
            </p>
          </div>
        </div>

        <p className={styles.productsFootline}>
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

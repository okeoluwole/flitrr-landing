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
          </div>
        </div>
      </div>
    </section>
  );
}

const LIFECYCLE_STAGES = [
  'Planning',
  'Design',
  'Procurement',
  'Construction',
  'Handover',
];

function LifecycleVisual() {
  // viewBox 1000 x 300. Rings at radius 70. Olympic-style 30% overlap →
  // pitch = 2r * 0.70 = 98. Five rings span 4 * 98 = 392, centred so
  // first cx = (1000 - 392)/2 = 304.
  const RING_RADIUS = 70;
  const RING_PITCH = 98;
  const FIRST_CX = 304;
  const CENTRE_Y = 150;

  // Swoosh anchors INSIDE the lifecycle. Entry: lower-left interior of
  // ring 1. Exit: upper-right interior of ring 5 with the arrowhead.
  const ENTRY_X = FIRST_CX - 38;
  const ENTRY_Y = CENTRE_Y + 38;
  const EXIT_X  = FIRST_CX + 4 * RING_PITCH + 38;
  const EXIT_Y  = CENTRE_Y - 38;

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

      <path
        d={SWOOSH_PATH}
        fill="none"
        stroke="var(--color-background-amber)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d={`M ${EXIT_X} ${EXIT_Y} l -11 -1 l 4 8 z`}
        fill="var(--color-background-amber)"
        stroke="var(--color-background-amber)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

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

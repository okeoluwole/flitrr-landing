import Image from 'next/image';
import { createClient } from '../lib/supabase/server';
import HomeNav from './components/HomeNav';
import HomeDesignPartner from './components/HomeDesignPartner';
import LifecycleJourney from './components/LifecycleJourney';
import RubiksCube from './components/RubiksCube';
import PulseGlance from './components/PulseGlance';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   Static (server-renderable) sections live in this file.
   Interactive client components live in ./components/.
───────────────────────────────────────── */

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.heroMedia} aria-hidden="true">
        <Image
          src="/images/hero-aerial-aylesbury-dusk.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImg}
        />
      </div>
      <span className={styles.heroScrim} aria-hidden="true" />
      <div className={`container ${styles.heroContent}`}>
        <div className={styles.heroCopy}>
          <h1 id="hero-heading" className={`${styles.heroHeading} riseIn`}>
            One platform for the whole property development lifecycle.
          </h1>
          <p
            className={`${styles.heroSub} riseIn`}
            style={{ '--rise-delay': '80ms' }}
          >
            Practical delivery solutions for independent and SME property
            developers, from land acquisition to asset disposal.
          </p>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className={styles.problem} aria-label="The problem Flitrr exists to solve">
      <div className="container">
        <div className={styles.problemInner} data-reveal>
          <span className={styles.problemMark} aria-hidden="true" />
          <p className={styles.problemText}>
            Property development is one of the most demanding delivery
            environments there is. Long lifecycles, high capital exposure,
            many parties, and decisions whose consequences surface years
            later. Major developers meet it with programme offices and
            dedicated delivery infrastructure.{' '}
            <span className={styles.problemTurn}>
              At independent and SME scale, that infrastructure has never
              existed. Flitrr is building it.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

// Band 2 opener: the Flitrr Framework. A landing-resident one-liner beside
// the self-solving cube; the deeper Framework positioning is owned by the
// team and lives on /framework. Anchor #framework feeds the nav.
function Framework() {
  return (
    <section
      id="framework"
      className={styles.framework}
      aria-labelledby="framework-heading"
    >
      <div className="container">
        <div className={styles.frameworkLayout}>
          <div className={styles.frameworkInner} data-reveal>
            <h2 id="framework-heading" className={styles.sectionHeading}>
              The Flitrr Framework.
            </h2>
            <p className={styles.frameworkLine}>
              The Flitrr Framework is a delivery methodology for independent and
              SME developers, the kind of discipline large developers have always
              had and smaller ones never did. It sets how a development is
              decided, governed, and delivered, from land to disposal.
            </p>
            <div className={styles.frameworkCta}>
              <a href="/framework" className={styles.btnGhost}>
                Explore the Framework
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
          <RubiksCube className={styles.frameworkVisual} />
        </div>
      </div>
    </section>
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
          One journey. Eight stages. One system.
        </h2>
        <p className={styles.lifecycleSub} data-reveal>
          Every development walks the same road. Flitrr maps it, stage by
          stage, so every decision lands where it belongs.
        </p>

        <LifecycleJourney />
      </div>
    </section>
  );
}

// Band 3: PULSE, the first product. A standalone product-line framing, the
// name and one-liner, the live interactive workspace (the real app, on), and
// the two CTAs. The methodology is not re-explained here; that is the Framework
// band and the /pulse page. The suite roadmap follows in Roadmap().
function Pulse() {
  return (
    <section id="pulse" className={styles.pulse} aria-labelledby="pulse-heading">
      <div className="container">
        <div className={styles.pulseLayout}>
          <div className={styles.pulseInfo} data-reveal>
            <p className={styles.pulseLead}>Our first product</p>
            <h2 id="pulse-heading" className={styles.pulseHeading}>
              PULSE.
            </h2>
            <p className={styles.pulseNameLine}>
              Project delivery and programme management for independent and SME
              developers.
            </p>
            <div className={styles.pulseCtas}>
              <a href="/pulse" className={styles.btnPrimary}>
                Discover PULSE
              </a>
              <a href="#design-partner" className={styles.btnGhost}>
                Become a design partner
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

          <div className={styles.pulseWindow} data-reveal>
            <PulseGlance />
            <p className={styles.pulseWindowCaption}>
              The PULSE workspace, at a glance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const ROADMAP_NODES = [
  { name: 'PULSE', status: 'Live', desc: 'Project delivery and programme management.', live: true },
  { name: 'STACK', status: 'In design', desc: 'Build and lock your funding.' },
  { name: 'ROUTE', status: 'In design', desc: 'Appoint the right team, and run the tender.' },
  { name: 'And more', status: '', desc: '' },
];

// The suite: PULSE live, three products in design, framed as direction (the
// problem each solves) not availability. Product copy is placeholder, pending
// sign-off.
function Roadmap() {
  return (
    <section
      id="roadmap"
      className={styles.roadmap}
      aria-labelledby="roadmap-label"
    >
      <div className="container">
        <div className={styles.roadmapGrid}>
          <div data-reveal>
            <h2 id="roadmap-label" className={styles.roadmapLabel}>
              The suite
            </h2>
            <p className={styles.roadmapText}>
              PULSE leads the suite. More follow it across the lifecycle, each
              built to the same discipline.
            </p>
          </div>
          <div className={styles.roadmapLine} data-reveal>
            {ROADMAP_NODES.map((node) => (
              <div
                key={node.name}
                className={`${styles.roadmapNode} ${
                  node.live ? styles.roadmapNodeLive : ''
                }`}
              >
                <span className={styles.roadmapName}>{node.name}</span>
                {node.status && (
                  <span className={styles.roadmapStatus}>{node.status}</span>
                )}
                {node.desc && (
                  <span className={styles.roadmapDesc}>{node.desc}</span>
                )}
              </div>
            ))}
          </div>
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
              One platform for the whole property development lifecycle.
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
        <Problem />
        <Framework />
        <Lifecycle />
        <Pulse />
        <Roadmap />
        <HomeDesignPartner />
      </main>
      <Footer />
    </>
  );
}

import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import HomeNav from '../components/HomeNav';
import homeStyles from '../page.module.css';
import styles from './page.module.css';

export const metadata = {
  title: 'The Flitrr Framework',
  description:
    'The Flitrr Framework: the 8-6-4 method for running a property development the way an institution would, from land to disposal. Eight stages, six principles, four mandates.',
};

/* ─────────────────────────────────────────
   The Flitrr Framework page.

   The 8-6-4 method is the spine of the page:
   the eight stages, the six principles, the
   four mandates, and the criticality discipline
   at the centre. Copy is distilled from the
   framework document in the house voice. The
   page shares the ink and amber system with the
   home and PULSE pages but stands on its own
   structure: typographic, not photographic.
   Criticality is explained in plain words; the
   glass and rubber image belongs to PULSE.
───────────────────────────────────────── */

const SHAPE = [
  {
    n: '8',
    label: 'Eight stages',
    gloss:
      'The lifecycle of a development, from securing the land to realising the finished asset.',
  },
  {
    n: '6',
    label: 'Six principles',
    gloss: 'The rules that govern how a project is run, at every stage.',
  },
  {
    n: '4',
    label: 'Four mandates',
    gloss: 'What each stage must deliver to be done well.',
  },
];

const OBJECTIVES = ['Scope', 'Cost', 'Time', 'Quality', 'Funding'];

const STAGES = [
  {
    n: '0',
    name: 'Land and Site Acquisition',
    desc: 'Confirm there is a feasible development here, and secure the site on terms that match your confidence.',
  },
  {
    n: '1',
    name: 'Project Objectives and Funding',
    desc: 'Turn the feasible hypothesis into a defined, funded, committed project, with its objectives classified.',
  },
  {
    n: '2',
    name: 'Consultant Appointment',
    desc: 'Assemble the right professional team for this scheme, on clear terms, before serious work begins.',
  },
  {
    n: '3',
    name: 'Design and Planning Approvals',
    desc: 'Develop the design to win its approvals and carry the project into construction.',
  },
  {
    n: '4',
    name: 'Contractor Procurement',
    desc: 'Appoint the contractor on terms that fit the project and protect what must hold.',
  },
  {
    n: '5',
    name: 'Construction',
    desc: 'Build to the defined project, defending what must hold through to the finish.',
  },
  {
    n: '6',
    name: 'Completion and Handover',
    desc: 'Close the project out properly: complete, certified, settled, and handed over.',
  },
  {
    n: '7',
    name: 'Sales and Disposal',
    desc: 'Realise the value the whole project was built to create, and close the loop on the case you set.',
  },
];

const PRINCIPLES = [
  {
    name: 'Objective criticality',
    body: 'Decide which objectives must hold firm and which can move. Every deliverable project keeps some give; the framework makes you choose where, on purpose.',
  },
  {
    name: 'Cascading classification',
    body: 'That weighting flows down to the milestones, risks, and workstreams that serve each objective, so nothing carries more protection than the objective it serves.',
  },
  {
    name: 'Staged delivery with gates',
    body: 'Each stage ends in a deliberate go or no-go, and the gate records what was agreed against what actually happened.',
  },
  {
    name: 'Locked baseline',
    body: 'Once defined, the project is the single agreed truth, changing only by deliberate re-approval, never by drift.',
  },
  {
    name: 'Proportional monitoring and escalation',
    body: 'Attention follows criticality. What must hold is watched closely and raised early, on thresholds agreed when the project is defined.',
  },
  {
    name: 'Tailoring within discipline',
    body: 'The method adapts to the type, size, and geography of the scheme. The principles stay fixed.',
  },
];

const MANDATE = [
  { name: 'Purpose', body: 'What the stage is for.' },
  {
    name: 'Establish or achieve',
    body: 'The decisions to lock and the objectives to set or advance.',
  },
  { name: 'Produce', body: 'The outputs the stage must deliver.' },
  {
    name: 'Success Factors',
    body: 'What decides whether the stage succeeds, and where developers most often come unstuck.',
  },
];

function Arrow() {
  return (
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
  );
}

export default async function FrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return (
    <>
      <a href="#main-content" className={homeStyles.skipLink}>
        Skip to content
      </a>
      <HomeNav user={navUser} />
      <div className={styles.page}>
        <main id="main-content">
          {/* Hero: the framework, and the 8-6-4 signature, unpacked. */}
          <section className={styles.hero} aria-labelledby="fw-heading">
            <div className="container">
              <span className={`${styles.eyebrow} riseIn`}>The 8-6-4 method</span>
              <h1
                id="fw-heading"
                className={`${styles.heading} riseIn`}
                style={{ '--rise-delay': '70ms' }}
              >
                The Flitrr Framework.
              </h1>
              <p
                className={`${styles.lead} riseIn`}
                style={{ '--rise-delay': '140ms' }}
              >
                The discipline a major developer keeps inside a programme office,
                set down as a method any developer can run. A large scheme has
                people whose whole job is to hold the line and catch drift before
                it costs anything; an independent developer carries the same
                demands with a fraction of that bandwidth. The framework gives
                them that discipline as a structured method, so holding the line
                no longer depends on the size of the team.
              </p>
              <dl
                className={`${styles.signature} riseIn`}
                style={{ '--rise-delay': '220ms' }}
              >
                {SHAPE.map((s) => (
                  <div key={s.n} className={styles.sigItem}>
                    <dt className={styles.sigTerm}>
                      <span className={`${styles.sigNum} tnum`} aria-hidden="true">
                        {s.n}
                      </span>
                      <span className={styles.sigLabel}>{s.label}</span>
                    </dt>
                    <dd className={styles.sigGloss}>{s.gloss}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Criticality: the centre, in plain words. No glass or rubber. */}
          <section
            className={`${styles.section} ${styles.sectionRaised}`}
            aria-labelledby="crit-heading"
          >
            <div className="container">
              <div className={styles.sectionHead} data-reveal>
                <h2 id="crit-heading" className={styles.sectionHeading}>
                  Criticality is the centre of the method.
                </h2>
                <p className={styles.sectionIntro}>
                  Every development is judged on five objectives. The
                  framework&rsquo;s first move is to define them, then to weigh
                  them by criticality: which must hold firm, and which can move.
                </p>
              </div>

              <div className={styles.critGrid}>
                <div data-reveal>
                  <ul className={styles.objList} aria-label="The five objectives">
                    {OBJECTIVES.map((o) => (
                      <li key={o} className={styles.objChip}>
                        {o}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.objCaption}>
                    Each is set to hold firm or to flex, once, at the outset.
                  </p>
                </div>

                <div className={styles.critStates} data-reveal>
                  <p className={styles.critState}>
                    <span
                      className={`${styles.stateDot} ${styles.stateHold}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong className={styles.stateName}>Protected.</strong> It
                      must hold firm, because compromise causes damage you cannot
                      recover.
                    </span>
                  </p>
                  <p className={styles.critState}>
                    <span
                      className={`${styles.stateDot} ${styles.stateFlex}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong className={styles.stateName}>Flexible.</strong> It
                      can move, absorbing reality and still delivering.
                    </span>
                  </p>
                </div>
              </div>

              <div className={styles.trap} data-reveal>
                <p className={styles.trapText}>
                  The trap is protecting everything. A project with every
                  objective set to hold has no give when reality bites, and is
                  usually undeliverable. The framework forces the choice at the
                  outset, while it is still cheap to make.
                </p>
              </div>
            </div>
          </section>

          {/* The eight stages: a structural ladder, gates between them. */}
          <section className={styles.section} aria-labelledby="stages-heading">
            <div className="container">
              <div className={styles.sectionHead} data-reveal>
                <h2 id="stages-heading" className={styles.sectionHeading}>
                  Eight stages, land to disposal.
                </h2>
                <p className={styles.sectionIntro}>
                  Each stage is a distinct phase with a single job. Between every
                  stage and the next sits a deliberate decision, a gate: the
                  project advances because the stage is genuinely done and still
                  the project that was committed to, decided each time rather than
                  allowed to slide.
                </p>
              </div>
              <ol className={styles.ladder}>
                {STAGES.map((s) => (
                  <li key={s.n} className={styles.rung} data-reveal>
                    <span className={`${styles.rungNum} tnum`} aria-hidden="true">
                      {s.n}
                    </span>
                    <div className={styles.rungBody}>
                      <h3 className={styles.rungName}>{s.name}</h3>
                      <p className={styles.rungDesc}>{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* The six principles. */}
          <section
            className={`${styles.section} ${styles.sectionRaised}`}
            aria-labelledby="principles-heading"
          >
            <div className="container">
              <div className={styles.sectionHead} data-reveal>
                <h2 id="principles-heading" className={styles.sectionHeading}>
                  Six principles hold it together.
                </h2>
                <p className={styles.sectionIntro}>They apply at every stage.</p>
              </div>
              <ol className={styles.principles}>
                {PRINCIPLES.map((p, i) => (
                  <li key={p.name} className={styles.principle} data-reveal>
                    <span className={`${styles.principleNum} tnum`} aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className={styles.principleName}>{p.name}</h3>
                      <p className={styles.principleBody}>{p.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* The four mandates: the anatomy of every stage. */}
          <section className={styles.section} aria-labelledby="mandate-heading">
            <div className="container">
              <div className={styles.sectionHead} data-reveal>
                <h2 id="mandate-heading" className={styles.sectionHeading}>
                  Every stage meets a four-part mandate.
                </h2>
                <p className={styles.sectionIntro}>
                  Within the structure, every stage is defined the same way. It is
                  how the framework holds eight different phases to one standard.
                </p>
              </div>
              <ol className={styles.mandates}>
                {MANDATE.map((m, i) => (
                  <li key={m.name} className={styles.mandate} data-reveal>
                    <span className={`${styles.mandateNum} tnum`} aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className={styles.mandateName}>{m.name}</h3>
                    <p className={styles.mandateBody}>{m.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Close: the products built on the framework. */}
          <section
            className={`${styles.section} ${styles.sectionRaised}`}
            aria-labelledby="close-heading"
          >
            <div className="container">
              <div className={styles.closeInner} data-reveal>
                <h2 id="close-heading" className={styles.sectionHeading}>
                  The framework, and the products built on it.
                </h2>
                <p className={styles.closeBody}>
                  The framework is the method. The products are how you run it.
                  PULSE is the first product built on the Flitrr Framework: it
                  sets a project up properly, classifies its objectives, locks the
                  brief, then monitors only what matters across every stage. More
                  will follow it across the lifecycle, each built to the same
                  discipline.
                </p>
                <div className={styles.closeCtas}>
                  <Link href="/pulse" className={homeStyles.btnPrimary}>
                    Discover PULSE
                  </Link>
                  <Link href="/#design-partner" className={homeStyles.btnGhost}>
                    Become a design partner
                    <Arrow />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer} role="contentinfo">
          <div className="container">
            <div className={styles.footerRow}>
              <div className={styles.footerBrand}>
                <Link href="/" className={styles.footerWordmark}>
                  Flitrr
                </Link>
                <p className={styles.footerTagline}>
                  One platform for the whole property development lifecycle.
                </p>
              </div>
              <div className={styles.footerLinks}>
                <a href="mailto:hello@flitrr.com" className={styles.footerLink}>
                  hello@flitrr.com
                </a>
                <Link href="/pulse" className={styles.footerLink}>
                  PULSE
                </Link>
                <Link href="/privacy" className={styles.footerLink}>
                  Privacy
                </Link>
                <Link href="/terms" className={styles.footerLink}>
                  Terms
                </Link>
              </div>
            </div>
            <p className={styles.footerCopy}>&copy; 2026 Flitrr Ltd. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

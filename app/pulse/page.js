import Image from 'next/image';
import { createClient } from '../../lib/supabase/server';
import PulseNav from './components/PulseNav';
import PulseDesignPartner from './components/PulseDesignPartner';
import HeroBoard from './components/HeroBoard';
import HowItWorks from './components/HowItWorks';
import BriefKeystone from './components/BriefKeystone';
import ClassificationScene from './components/ClassificationScene';
import PlaybookDemo from './components/PlaybookDemo';
import styles from './page.module.css';

/* ─────────────────────────────────────────
   The PULSE product page. Static sections
   are server components in this file; the
   two interactive moments (the classification
   scene, the playbook demo) are client
   components in ./components/.
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
        <div className={styles.heroCopy}>
          <p className={`${styles.heroEyebrow} riseIn`}>
            Monitoring What Matters.
          </p>
          <h1 id="hero-heading" className={`${styles.heroHeading} riseIn`} style={{ '--rise-delay': '70ms' }}>
            Run your development like you have a programme office.
          </h1>
          <p
            className={`${styles.heroSub} riseIn`}
            style={{ '--rise-delay': '150ms' }}
          >
            PULSE is project delivery and programme management for independent
            and SME property developers. It makes you run your project the way
            a seasoned programme director would, because one is built in.
          </p>
          <div
            className={`${styles.heroCtas} riseIn`}
            style={{ '--rise-delay': '230ms' }}
          >
            <a href="#design-partner" className={styles.btnPrimary}>
              Become a design partner
            </a>
            <a href="#product" className={styles.btnGhost}>
              See it work
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3v9M4 8.5l4 4 4-4"
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
        <HeroBoard className={styles.heroBoard} />
      </div>
    </section>
  );
}

/* The problem: drift made visible. The dashed line is the plan; the
   solid line is the project leaving it quietly; the amber mark is the
   moment attention should have caught it. */
function DriftFigure() {
  return (
    <div className={styles.driftWrap} aria-hidden="true">
      <svg
        viewBox="0 0 600 86"
        className={styles.driftSvg}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path className={styles.driftBase} d="M0 18 H600" />
        <path
          className={styles.driftPath}
          pathLength="1"
          d="M0 18 C 140 18, 220 19, 300 30 C 380 41, 470 62, 600 74"
        />
        <circle className={styles.driftHalo} cx="300" cy="30" r="9" />
        <circle className={styles.driftFlag} cx="300" cy="30" r="3.5" />
      </svg>
    </div>
  );
}

function PulseProblem() {
  return (
    <section
      className={styles.problem}
      aria-label="The problem PULSE exists to solve"
    >
      <div className="container">
        <div className={styles.problemInner} data-reveal>
          <p className={styles.problemText}>
            A development can fail politely. No single disaster, just a
            hundred small drifts nobody was watching: objectives blur, the
            baseline moves, a critical risk goes unreviewed for months.{' '}
            <span className={styles.problemTurn}>
              PULSE is built so that what matters cannot drift quietly.
            </span>
          </p>
          <DriftFigure />
        </div>
      </div>
    </section>
  );
}

/* ── The PULSE Framework ───────────────── */

function DefinedSpine() {
  return (
    <div className={styles.definedSpine} aria-hidden="true">
      <div className={styles.dsTrack}>
        <div className={styles.dsFill} />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span key={i} className={styles.dsGate} style={{ '--i': i }} />
        ))}
      </div>
      <ol className={styles.dsNums}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <li key={i} className={`${styles.dsNum} tnum`}>
            {i}
          </li>
        ))}
      </ol>
      <p className={styles.dsCaption}>
        Eight stages, land to disposal. Every tick is a gate.
      </p>
    </div>
  );
}

function MonitorTraces() {
  return (
    <div className={styles.monitor} aria-hidden="true">
      <div className={styles.traceRow}>
        <span className={`${styles.traceLabel} ${styles.traceLabelHot}`}>
          Non-negotiable
        </span>
        <span className={`${styles.trace} ${styles.traceHot}`}>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className={styles.traceTick} />
          ))}
          <span className={styles.sweep} />
        </span>
      </div>
      <div className={styles.traceRow}>
        <span className={styles.traceLabel}>Flexible</span>
        <span className={`${styles.trace} ${styles.traceCool}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={styles.traceTick} />
          ))}
          <span className={styles.sweep} />
        </span>
      </div>
      <p className={styles.monitorCaption}>
        Monitoring intensity follows the classification.
      </p>
    </div>
  );
}

const PRINCIPLES = [
  {
    name: 'Staged delivery with gates.',
    body: 'Every stage transition is a deliberate go or no-go decision, never an automatic slide.',
  },
  {
    name: 'Objective criticality.',
    body: 'Every objective is classified by the consequence of compromise, set once, at the start.',
  },
  {
    name: 'Cascading classification.',
    body: 'Criticality flows down from objectives to milestones, risks, and workstreams. Nothing inherits more protection than the objective it serves.',
  },
  {
    name: 'Locked baseline.',
    body: 'The Brief is version-locked and becomes the single shared truth. Change is explicit and re-approved, never by drift.',
  },
  {
    name: 'Proportional monitoring and escalation.',
    body: 'Monitoring intensity scales with criticality, and escalation rules are agreed before pressure arrives, not negotiated under it.',
  },
  {
    name: 'Tailoring within discipline.',
    body: 'The framework adapts to project type and geography. The principles never do.',
  },
];

function Framework() {
  return (
    <section
      id="framework"
      className={styles.framework}
      aria-labelledby="framework-heading"
    >
      <div className="container">
        <h2 id="framework-heading" className={styles.sectionHeading} data-reveal>
          The PULSE Framework.
        </h2>
        <p className={styles.frameworkIntro} data-reveal>
          PULSE runs on its own delivery methodology, built specifically for
          the developer&rsquo;s seat. The industry has plans of work organised
          around the architect&rsquo;s workflow, and delivery methodologies
          sized for global consultancies. The PULSE Framework is built around
          the developer&rsquo;s decisions, at independent and SME scale, and
          it exists nowhere else.{' '}
          <span className={styles.introStrong}>
            Large developers buy this discipline from firms most independent
            developers are priced out of. PULSE gives it to you directly.
          </span>
        </p>

        <div className={styles.beats}>
          <div className={styles.beat} data-reveal>
            <div>
              <h3 className={styles.beatWord}>Defined.</h3>
              <p className={styles.beatBody}>
                Eight lifecycle stages, land to disposal, each with a job and
                a deliberate checkpoint before the next begins. Your project
                always knows where it is.
              </p>
            </div>
            <DefinedSpine />
          </div>

          <div className={`${styles.beat} ${styles.beatFull}`} data-reveal>
            <div>
              <h3 className={styles.beatWord}>Classified.</h3>
              <p className={styles.beatBody}>
                At the start, you decide what your project cannot compromise
                on and what can flex, across five objectives: scope, cost,
                time, quality, funding. Some objectives are glass: drop them
                and they shatter. Some are rubber: they can flex and recover.
                You decide which is which, once, honestly, and that decision
                governs everything after it.
              </p>
            </div>
            <div className={styles.beatScene}>
              <ClassificationScene />
            </div>
          </div>

          <div className={styles.beat} data-reveal>
            <div>
              <h3 className={styles.beatWord}>Monitored.</h3>
              <p className={styles.beatBody}>
                Attention in proportion to what you protected. What you said
                cannot move is watched closely and flagged early. What has
                room to move is watched, not fussed over. And at every stage
                transition, one deliberate question:{' '}
                <em>
                  is the stage done, and is the project still the project you
                  committed to?
                </em>
              </p>
            </div>
            <MonitorTraces />
          </div>
        </div>

        <ul className={styles.principles}>
          {PRINCIPLES.map((p) => (
            <li key={p.name} className={styles.principle} data-reveal>
              <h3 className={styles.principleName}>{p.name}</h3>
              <p className={styles.principleBody}>{p.body}</p>
            </li>
          ))}
        </ul>

        <p className={styles.frameworkClose} data-reveal>
          <span className={styles.frameworkCloseMark} aria-hidden="true" />
          That is the discipline a large developer&rsquo;s project office
          gives them. PULSE gives it to you.
        </p>
      </div>
    </section>
  );
}

/* ── The product walk ──────────────────── */

function WalkArrow() {
  return (
    <svg
      className={styles.walkArrow}
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

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={styles.vgCheckIcon}
    >
      <path
        d="M2 6.5l2.6 2.5L10 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InitiationPanel() {
  return (
    <div className={styles.panel} aria-hidden="true">
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
      <span className={styles.vgStepsCaption}>Eight steps, once</span>
    </div>
  );
}

function BriefPanel() {
  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.vgDoc}>
        <span className={styles.vgDocTitle} />
        <span className={styles.vgDocLine} />
        <span className={`${styles.vgDocLine} ${styles.vgDocLineShort}`} />
        <span className={styles.vgDocSeal}>Baseline locked, v1</span>
      </div>
    </div>
  );
}

function GatePanel() {
  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.vgGateChecks}>
        <span className={styles.vgCheck}>
          <CheckIcon />
          Stage checklist complete
        </span>
        <span className={styles.vgCheck}>
          <CheckIcon />
          Protected objectives intact
        </span>
      </div>
      <div className={styles.vgGateBar}>
        <span className={`${styles.vgStageChip} tnum`}>2</span>
        <span className={styles.vgGateLine} />
        <span className={styles.vgGateTick}>Go</span>
        <span className={styles.vgGateLine} />
        <span className={`${styles.vgStageChip} ${styles.vgStageNext} tnum`}>
          3
        </span>
      </div>
    </div>
  );
}

const SPOKES = [
  {
    name: 'Risk Register',
    body: 'Risks in plain language, scored with two honest questions, surfaced by criticality. The serious ones ask for a response; the quiet ones stay quiet.',
    vignette: 'risks',
  },
  {
    name: 'Programme Tracker',
    body: 'The baseline against reality. Milestones, workstreams, and the variance between the plan you locked and the project you have.',
    vignette: 'programme',
  },
  {
    name: 'Executive Dashboard',
    body: 'The whole project on one screen: stage, objective health, critical risks, critical actions.',
    vignette: 'dashboard',
  },
];

function SpokeVignette({ kind }) {
  if (kind === 'risks') {
    return (
      <div className={styles.vgMini} aria-hidden="true">
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
          <span className={`${styles.vgSev} ${styles.vgSevQuiet}`}>Quiet</span>
        </div>
      </div>
    );
  }

  if (kind === 'programme') {
    return (
      <div className={styles.vgMini} aria-hidden="true">
        <div className={styles.vgBars}>
          <span className={styles.vgToday} />
          <span className={styles.vgBar} style={{ width: '72%' }} />
          <span
            className={`${styles.vgBar} ${styles.vgBarAmber}`}
            style={{ width: '54%', marginLeft: '18%' }}
          />
          <span
            className={styles.vgBar}
            style={{ width: '34%', marginLeft: '44%' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vgMini} aria-hidden="true">
      <div className={styles.vgKpis}>
        <span className={styles.vgKpi}>
          <span className={`${styles.vgKpiNum} tnum`}>12</span>
          <span className={styles.vgKpiLabel}>Open</span>
        </span>
        <span className={styles.vgKpi}>
          <span className={`${styles.vgKpiNum} ${styles.vgKpiNumAmber} tnum`}>
            3
          </span>
          <span className={styles.vgKpiLabel}>Critical</span>
        </span>
        <span className={styles.vgKpi}>
          <span className={`${styles.vgKpiNum} tnum`}>82%</span>
          <span className={styles.vgKpiLabel}>On track</span>
        </span>
      </div>
    </div>
  );
}

function ProductWalk() {
  return (
    <section
      id="product"
      className={styles.walk}
      aria-labelledby="walk-heading"
    >
      <div className="container">
        <h2 id="walk-heading" className={styles.sectionHeading} data-reveal>
          Fifteen minutes of discipline. A lifecycle of control.
        </h2>

        <div className={styles.walkBeats}>
          <div className={styles.walkBeat} data-reveal>
            <InitiationPanel />
            <h3 className={styles.beatLabel}>Project Initiation</h3>
            <p className={styles.beatText}>
              A guided flow that produces your Project Brief: vision,
              objectives, classification, constraints, milestones, risks.
              Fifteen minutes, once.
            </p>
          </div>

          <div className={styles.walkArrowWrap} aria-hidden="true">
            <WalkArrow />
          </div>

          <div className={styles.walkBeat} data-reveal>
            <BriefPanel />
            <h3 className={styles.beatLabel}>The Brief</h3>
            <p className={styles.beatText}>
              The keystone document. Lock it, and it becomes the baseline
              every module reads from. Export it, share it, hold your whole
              team to it.
            </p>
          </div>

          <div className={styles.walkArrowWrap} aria-hidden="true">
            <WalkArrow />
          </div>

          <div className={styles.walkBeat} data-reveal>
            <GatePanel />
            <h3 className={styles.beatLabel}>The Gate</h3>
            <p className={styles.beatText}>
              Advancing a stage is a decision, not a date. PULSE checks the
              work against your protected objectives before the project
              moves.
            </p>
          </div>
        </div>

        {/* The modules: everything feeding the Action Log at the centre. */}
        <div className={styles.hub}>
          <div className={styles.hubGrid}>
            <div className={styles.spokes}>
              {SPOKES.map((spoke) => (
                <article key={spoke.name} className={styles.spokeCard} data-reveal>
                  <SpokeVignette kind={spoke.vignette} />
                  <h3 className={styles.spokeName}>{spoke.name}</h3>
                  <p className={styles.spokeBody}>{spoke.body}</p>
                </article>
              ))}
            </div>

            <div className={styles.laneCol} aria-hidden="true">
              <span className={styles.lane} style={{ '--lane-delay': '0ms' }} />
              <span className={styles.lane} style={{ '--lane-delay': '850ms' }} />
              <span className={styles.lane} style={{ '--lane-delay': '1700ms' }} />
            </div>

            <article className={styles.hubCard} data-reveal>
              <div className={styles.vgBand} aria-hidden="true">
                <span className={styles.vgBandLabel}>Needs your response</span>
                <div className={styles.vgRow}>
                  <span className={`${styles.vgChip} ${styles.vgChipCritical}`}>
                    Critical
                  </span>
                  <span className={styles.vgText} />
                  <span className={styles.vgRespond}>Respond</span>
                </div>
                <div className={`${styles.vgRow} ${styles.vgRowFaded}`}>
                  <span className={styles.vgChip}>Standard</span>
                  <span className={`${styles.vgText} ${styles.vgTextShort}`} />
                </div>
              </div>
              <h3 className={styles.hubName}>Action Log</h3>
              <p className={styles.hubBody}>
                The centre of PULSE. Everything that needs you, from every
                module, in one place, pushed by the platform and sorted by
                what you protected. Your critical actions reach your inbox
                weekly.
              </p>
            </article>

            <div className={styles.laneCol} aria-hidden="true">
              <span className={styles.lane} style={{ '--lane-delay': '400ms' }} />
            </div>

            <div className={styles.digest} data-reveal>
              <svg
                width="22"
                height="18"
                viewBox="0 0 22 18"
                aria-hidden="true"
                className={styles.digestIcon}
              >
                <rect
                  x="1"
                  y="1"
                  width="20"
                  height="16"
                  rx="2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M2 3.5l9 7 9-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={styles.digestName}>Weekly digest</span>
              <span className={styles.digestNote}>
                Critical actions, in your inbox
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── The playbook ──────────────────────── */

function Playbook() {
  return (
    <section
      id="playbook"
      className={styles.playbook}
      aria-labelledby="playbook-heading"
    >
      <span className={styles.playbookBloom} aria-hidden="true" />
      <div className="container">
        <div className={styles.playbookGrid}>
          <div data-reveal>
            <h2 id="playbook-heading" className={styles.sectionHeading}>
              The knowledge you were never handed.
            </h2>
            <p className={styles.playbookBody}>
              Most developers learn programme management by paying for the
              lessons. PULSE ships with the playbook instead: at every stage,
              it proposes the actions and risks a veteran programme director
              would already be watching for, each one explained in a single
              plain sentence, each one prioritised by the objectives you
              protected. Accept with a tap, or dismiss it. Your project, your
              call, with the experience already in the room.
            </p>
          </div>
          <div data-reveal>
            <PlaybookDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────── */

/* ── Band 5: the Flitrr Framework credit, a slim doorway to /framework ── */

function FrameworkCredit() {
  return (
    <section
      id="framework-credit"
      className={styles.fwCredit}
      aria-labelledby="fw-credit-heading"
    >
      <div className="container" data-reveal>
        <a href="/framework" className={styles.fwLink}>
          <span className={styles.fwText}>
            <span className={styles.fwEyebrow}>Built on the Flitrr Framework</span>
            <span id="fw-credit-heading" className={styles.fwLine}>
              The delivery discipline behind every Flitrr product. PULSE is the
              first to run on it.
            </span>
          </span>
          <span className={styles.fwCta}>
            Explore the Framework
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 8h9M8.5 4l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </a>
      </div>
    </section>
  );
}

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
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <PulseNav user={navUser} />
      <main id="main-content" className={styles.main}>
        <PulseHero />
        <HowItWorks />
        <BriefKeystone />
        <Playbook />
        <FrameworkCredit />
        <PulseDesignPartner />
      </main>
      <PulseFooter />
    </>
  );
}

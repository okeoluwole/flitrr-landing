'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteNav from '../components/considered/SiteNav';
import SiteFooter from '../components/considered/SiteFooter';
import styles from './framework.module.css';

const OBJECTIVES = [
  { k: 'Scope', prot: true },
  { k: 'Cost', prot: true },
  { k: 'Time', prot: false },
  { k: 'Quality', prot: true },
  { k: 'Funding', prot: true },
];

const PRINCIPLES = [
  ['Objective criticality', 'Each objective is set to hold firm or to flex. That weighting governs every decision after it.'],
  ['Cascading classification', 'The criticality set at the top flows down into every risk, action and decision.'],
  ['Staged delivery with gates', 'The project advances one stage at a time, and only through a deliberate gate.'],
  ['Locked baseline', 'The brief is version-locked, so change is a decision made on purpose, never a drift.'],
  ['Proportional monitoring and escalation', 'Attention follows criticality. What matters most is watched hardest.'],
  ['Tailoring within discipline', 'The method flexes to fit the scheme, without giving up the structure.'],
];

const STAGES = [
  ['Land and Site Acquisition', 'Confirm there is a feasible development here, and secure the site on terms that match your confidence.', '/images/lifecycle/land.jpg', 'Land'],
  ['Project Objectives and Funding', 'Turn the feasible hypothesis into a defined, funded, committed project, with its objectives classified.', '/images/lifecycle/signing.jpg', 'Objectives'],
  ['Consultant Appointment', 'Assemble the right professional team for this scheme, on clear terms, before serious work begins.', '/images/lifecycle/consultants.jpg', 'Consultants'],
  ['Design and Planning Approvals', 'Develop the design to win its approvals and carry the project into construction.', '/images/lifecycle/drafting.jpg', 'Design'],
  ['Contractor Procurement', 'Appoint the contractor on terms that fit the project and protect what must hold.', '/images/lifecycle/crew.jpg', 'Procurement'],
  ['Construction', 'Build to the defined project, defending what must hold through to the finish.', '/images/lifecycle/cranes.jpg', 'Construction'],
  ['Completion and Handover', 'Close the project out properly: complete, certified, settled, and handed over.', '/images/lifecycle/handover.jpg', 'Completion'],
  ['Sales and Disposal', 'Realise the value the whole project was built to create, and close the loop on the case you set.', '/images/lifecycle/sales.jpg', 'Sales'],
];

const pad = (n) => String(n).padStart(2, '0');

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const h = () => setReduce(m.matches);
    m.addEventListener?.('change', h);
    return () => m.removeEventListener?.('change', h);
  }, []);
  return reduce;
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* The centre of the method, live: classify five objectives and watch the give.
   Protect all five and the "trap" fires. */
function CriticalityInstrument() {
  const [objs, setObjs] = useState(OBJECTIVES);
  const prot = objs.filter((o) => o.prot).length;
  const flex = objs.length - prot;
  const none = prot === 5;
  const give = none ? 0 : Math.max(Math.round((flex / objs.length) * 100), 8);
  const giveLab = none ? 'no give' : flex >= 3 ? 'plenty of give' : 'some give';

  let ic = 'Balanced';
  let tx = 'Some objectives hold firm, some can flex. The project can absorb reality and still deliver.';
  if (none) {
    ic = 'The trap';
    tx = 'Everything is protected. Nothing can move when reality bites, so the project is usually undeliverable.';
  } else if (prot === 0) {
    ic = 'Too loose';
    tx = 'Nothing is protected. Decide what genuinely cannot compromise, and hold it firm.';
  }

  const toggle = (i) =>
    setObjs((prev) => prev.map((o, idx) => (idx === i ? { ...o, prot: !o.prot } : o)));

  return (
    <div className={styles.inst} aria-label="Classify the five objectives">
      <div className={styles.inst__head}>
        <div className={styles.pj}>
          Five objectives<small>Weigh each by criticality, once, at the outset</small>
        </div>
        <span className={`${styles.protc} ${none ? styles.full : ''}`}>Protecting {prot} of 5</span>
      </div>
      <div className={`${styles.give} ${none ? styles.none : ''}`}>
        <div className={styles.give__labs}>
          <span className={styles.gk}>Room to absorb reality</span>
          <span className={styles.gv}>{giveLab}</span>
        </div>
        <div className={styles.give__track}>
          <span className={styles.give__fill} style={{ width: `${give}%` }} />
        </div>
      </div>
      <div className={styles.objlist} role="group" aria-label="The five objectives, each Protected or Flexible">
        {objs.map((o, i) => (
          <button key={o.k} type="button" className={styles.clobj} aria-pressed={o.prot} onClick={() => toggle(i)}>
            <span className={styles.nm}>{o.k}</span>
            <span className={`${styles.clpill} ${o.prot ? styles.prot : styles.flexc}`}>
              {o.prot ? 'Protected' : 'Flexible'}
            </span>
          </button>
        ))}
      </div>
      <div className={`${styles.inst__signal} ${none ? styles.alarm : ''}`}>
        <span className={styles.ic}>{ic}</span>
        <span className={styles.tx}>{tx}</span>
      </div>
      <p className={styles.inst__hint}>Tap an objective to reclassify it</p>
    </div>
  );
}

/* The eight stages as a deliberate walk: step through the gate between each. */
function GateWalk() {
  const reduce = usePrefersReducedMotion();
  const [cur, setCur] = useState(0);
  const [clearing, setClearing] = useState(false);
  const last = STAGES.length - 1;
  const onLast = cur === last;

  const go = (i) => setCur(i);
  const advance = () => {
    const nx = (cur + 1) % STAGES.length;
    if (reduce) {
      go(nx);
      return;
    }
    setClearing(true);
    setTimeout(() => {
      setClearing(false);
      go(nx);
    }, 260);
  };

  const [name, desc, img] = STAGES[cur];

  return (
    <>
      <div className={styles.walk}>
        <div className={styles.walk__stage}>
          <div className={styles.walk__frame}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={name} />
            <div className={styles.walk__grad} aria-hidden="true" />
            <span className={styles.walk__num} aria-hidden="true">
              <b className="tnum">{pad(cur + 1)}</b>
              <i>/ 08</i>
            </span>
          </div>
          <div className={styles.walk__body}>
            <span className={styles.label}>
              Stage <span className="tnum">{pad(cur + 1)}</span> &middot; the single job
            </span>
            <h3>{name}</h3>
            <p>{desc}</p>
            <span className={styles.mchip}>
              <Check /> Meets the four-part mandate
            </span>
          </div>
        </div>
        <div className={`${styles.gate} ${clearing ? styles.clear : ''}`} aria-live="polite">
          <span className={styles.gate__dia} aria-hidden="true" />
          <div className={styles.gate__body}>
            <span className={styles.gate__k}>
              {onLast ? 'The loop closes' : `The gate, ${pad(cur + 1)} to ${pad(cur + 2)}`}
            </span>
            <p className={styles.gate__q}>
              {onLast
                ? 'The value the whole project was built to create is realised, and the case you set at the outset is closed out.'
                : 'Is this stage genuinely done, and still the project you committed to? The project advances only on yes.'}
            </p>
          </div>
          <button type="button" className={styles.gate__go} onClick={advance}>
            {onLast ? 'Walk it again' : 'Pass the gate'}{' '}
            <span className={styles.arw} aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>
      <div
        className={styles.rail}
        role="tablist"
        aria-label="The eight stages"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go((cur + 1) % STAGES.length);
          if (e.key === 'ArrowLeft') go((cur - 1 + STAGES.length) % STAGES.length);
        }}
      >
        {STAGES.map((st, i) => (
          <button
            key={st[0]}
            role="tab"
            aria-selected={i === cur}
            className={i < cur ? styles.reached : ''}
            title={st[0]}
            onClick={() => go(i)}
          >
            <span className={`${styles.rn} tnum`}>{pad(i + 1)}</span>
            <span className={styles.rl}>{st[3]}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function FrameworkMain({ user }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className={`${styles.page} ${ready ? styles.ready : ''}`}>
      <SiteNav user={user} current="framework" />
      <main id="main-content">
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="fw-heading">
          <div className={styles.hero__bg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-aerial-aylesbury-dusk.jpg"
              alt="A property development at dusk seen from the air, the whole scheme in one view"
            />
          </div>
          <div className={styles.wrap}>
            <span className={styles.hero__pill}>
              <span className={styles.sq} /> The 8-6-4 method
            </span>
            <h1 id="fw-heading">The Flitrr Framework.</h1>
            <p className={styles.hero__sub}>
              One method for running a property development the way an institution would, from
              land acquisition to delivery and sales. Set the discipline once, and every stage,
              decision and risk answers to it. Eight stages, six principles, four mandates, with
              objective criticality at the centre.
            </p>
          </div>
        </section>

        {/* 8-6-4 SIGNATURE / SPINE */}
        <section className={styles.sigband} aria-label="The shape of the method">
          <div className={styles.wrap}>
            <nav className={styles.sig__grid} aria-label="The three parts of the method">
              <a className={styles.sig__item} href="#stages">
                <span className={`${styles.sig__n} tnum`}>8</span>
                <span className={styles.sig__lab}>
                  Eight stages <span className={styles.sig__jump} aria-hidden="true">&darr;</span>
                </span>
                <span className={styles.sig__gloss}>
                  The lifecycle of a development, from securing the land to realising the finished asset.
                </span>
              </a>
              <a className={styles.sig__item} href="#principles">
                <span className={`${styles.sig__n} tnum`}>6</span>
                <span className={styles.sig__lab}>
                  Six principles <span className={styles.sig__jump} aria-hidden="true">&darr;</span>
                </span>
                <span className={styles.sig__gloss}>
                  The rules that govern how a project is run, at every stage.
                </span>
              </a>
              <a className={styles.sig__item} href="#mandate">
                <span className={`${styles.sig__n} tnum`}>4</span>
                <span className={styles.sig__lab}>
                  Four mandates <span className={styles.sig__jump} aria-hidden="true">&darr;</span>
                </span>
                <span className={styles.sig__gloss}>
                  What each stage must deliver to be done well.
                </span>
              </a>
            </nav>
          </div>
        </section>

        {/* CRITICALITY */}
        <section className={styles.crit} id="criticality" aria-labelledby="crit-h">
          <div className={styles.wrap}>
            <div className={styles.crit__copy}>
              <h2 id="crit-h">Criticality is the centre of the method.</h2>
              <p className={styles.intro}>
                Every development is judged on five objectives. The framework&rsquo;s first move is to
                define them, then to weigh them by criticality: which must hold firm, and which can move.
              </p>
              <div className={styles.states}>
                <div className={styles.state}>
                  <span className={`${styles.sdot} ${styles.hold}`} />
                  <p>
                    <b>Protected.</b> It must hold firm, because compromise causes damage you cannot recover.
                  </p>
                </div>
                <div className={styles.state}>
                  <span className={`${styles.sdot} ${styles.flex}`} />
                  <p>
                    <b>Flexible.</b> It can move, absorbing reality and still delivering.
                  </p>
                </div>
              </div>
              <p className={styles.trap}>
                The trap is protecting everything. A project with every objective set to hold has no give
                when reality bites, and is usually undeliverable.{' '}
                <b>The framework forces the choice at the outset, while it is still cheap to make.</b>
              </p>
            </div>
            <div>
              <CriticalityInstrument />
            </div>
          </div>
        </section>

        {/* EIGHT STAGES: the gate walk */}
        <section className={styles.stages} id="stages" aria-labelledby="stages-h">
          <div className={styles.wrap}>
            <div className={styles.stages__head}>
              <h2 id="stages-h">
                Eight stages, and a gate between each.
              </h2>
              <p>
                Each stage has a single job, and meets the same four-part mandate. The gate between them is
                a deliberate decision, that the stage is genuinely done and still the project you committed
                to, decided each time rather than allowed to slide. Step through it.
              </p>
            </div>
            <div>
              <GateWalk />
            </div>
          </div>
        </section>

        {/* SIX PRINCIPLES */}
        <section className={styles.principles} id="principles" aria-labelledby="prin-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="prin-h">Six principles hold it together.</h2>
              <p>They apply at every stage, on every scheme, whatever its size.</p>
            </div>
            <div className={styles.prin__list}>
              {PRINCIPLES.map(([nm, gloss], i) => (
                <div className={styles.prin} key={nm}>
                  <span className={`${styles.prin__n} tnum`}>{pad(i + 1)}</span>
                  <div>
                    <h3 className={styles.prin__name}>{nm}</h3>
                    <p className={styles.prin__gloss}>{gloss}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOUR-PART MANDATE */}
        <section className={styles.mandate} id="mandate" aria-labelledby="mand-h">
          <div className={styles.wrap}>
            <div className={styles.mandate__mark}>
              <b className="tnum">4</b>
              <span>
                mandates,
                <br />
                one standard
              </span>
            </div>
            <div className={styles.mandate__copy}>
              <h2 id="mand-h">Every stage meets a four-part mandate.</h2>
              <p>
                Every stage you step through is defined the same way, against the same four-part mandate.
                It is how the framework holds eight different phases, from land acquisition to delivery and
                sales, to a single standard.
              </p>
            </div>
          </div>
        </section>

        {/* CLOSE */}
        <section className={styles.close} id="close" aria-labelledby="close-h">
          <div className={styles.wrap}>
            <div className={styles.close__inner}>
              <h2 id="close-h">
                The framework, and the products <em>built on it</em>.
              </h2>
              <p className={styles.body}>
                The framework is the method. The products are how you run it. PULSE is the first product
                built on the Flitrr Framework: it sets a project up properly, classifies its objectives,
                locks the brief, then monitors only what matters across every stage. More will follow it
                across the lifecycle, each built to the same discipline.
              </p>
              <div className={styles.cta}>
                <Link href="/pulse" className={`${styles.btn} ${styles.btnSolid}`}>
                  Discover PULSE <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="/#design-partner" className={`${styles.btn} ${styles.btnDim}`}>
                  Become a design partner
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter variant="flitrr" />
    </div>
  );
}

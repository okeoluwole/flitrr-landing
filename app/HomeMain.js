'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';
import SiteNav from './components/considered/SiteNav';
import SiteFooter from './components/considered/SiteFooter';
import styles from './home.module.css';

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

const pad = (n) => String(n).padStart(2, '0');

const LIFE = [
  ['Land and Site Acquisition', 'Secure control of the site and clear title.', '/images/lifecycle/land.jpg', 'Land'],
  ['Project Objectives and Funding', 'Define the project, classify its objectives, confirm the funding.', '/images/lifecycle/objectives.jpg', 'Objectives'],
  ['Consultant Appointment', 'Assemble and scope the professional team.', '/images/lifecycle/appointment.jpg', 'Consultants'],
  ['Design and Planning Approvals', 'Freeze the design and secure permission to build.', '/images/lifecycle/design.jpg', 'Design'],
  ['Contractor Procurement', 'Tender, negotiate and execute the contract.', '/images/lifecycle/procurement.jpg', 'Procurement'],
  ['Construction', 'Build it, watching cost, time and quality.', '/images/lifecycle/construction.jpg', 'Construction'],
  ['Completion and Handover', 'Practical completion, defects and final accounts.', '/images/lifecycle/completion.jpg', 'Completion'],
  ['Sales and Disposal', 'Realise the value the project was set up to deliver.', '/images/lifecycle/disposal.jpg', 'Sales'],
];

function LifecycleReel() {
  const reduce = usePrefersReducedMotion();
  const [cur, setCur] = useState(0);
  const rootRef = useRef(null);
  const inViewRef = useRef(false);
  const timerRef = useRef(null);

  const schedule = () => {
    clearTimeout(timerRef.current);
    if (reduce || !inViewRef.current) return;
    timerRef.current = setTimeout(() => setCur((c) => (c + 1) % LIFE.length), 4200);
  };

  useEffect(() => {
    schedule();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, reduce]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !('IntersectionObserver' in window)) {
      inViewRef.current = true;
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          inViewRef.current = e.isIntersecting;
          if (e.isIntersecting) schedule();
          else clearTimeout(timerRef.current);
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (i) => setCur(i);
  const [name, desc] = LIFE[cur];

  return (
    <div className={styles.life}>
      <div className={styles.wrap}>
        <div className={styles.life__head}>
          <h2>One continuous line of sight.</h2>
          <p>
            Eight stages, each with a single job. Between every stage sits a gate, a deliberate decision
            that the stage is genuinely done before the project advances.
          </p>
        </div>
        <div className={styles.stage} ref={rootRef}>
          {LIFE.map(([nm, , img], i) => (
            <div key={nm} className={`${styles.stage__frame} ${i === cur ? styles.on : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className={styles.stage__grad} />
          <span className={styles.stage__big} aria-hidden="true">
            <b className="tnum">{pad(cur + 1)}</b>
            <i>/ 08</i>
          </span>
          <div className={styles.stage__cap}>
            <h3>{name}</h3>
            <p>{desc}</p>
          </div>
        </div>
        <div
          className={styles.rail}
          role="tablist"
          aria-label="The eight stages"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go((cur + 1) % LIFE.length);
            if (e.key === 'ArrowLeft') go((cur - 1 + LIFE.length) % LIFE.length);
          }}
        >
          {LIFE.map((st, i) => (
            <button
              key={st[0]}
              role="tab"
              aria-selected={i === cur}
              className={i < cur ? styles.reached : ''}
              title={st[0]}
              onClick={() => go(i)}
              onMouseEnter={() => go(i)}
            >
              <span className={`${styles.rn} tnum`}>{pad(i + 1)}</span>
              <span className={styles.rl}>{st[3]}</span>
            </button>
          ))}
        </div>
        <div className={styles.life__foot}>
          <span className={styles['cover-note']}>
            <span className={styles.sw} /> PULSE monitors stages 02 to 07, where a scheme is won or lost
          </span>
        </div>
      </div>
    </div>
  );
}

const OBJ = [
  { k: 'Scope', prot: true, dev: 0, status: 'Locked to the brief. No change requests are open against it.', needs: '' },
  { k: 'Cost', prot: true, dev: 38, status: 'Drifting. Running over the locked baseline, so a decision is due before it compounds.', needs: 'Cost is a protected objective and it is moving. A decision is due.' },
  { k: 'Time', prot: false, dev: 16, status: 'Flexed by design. A flexible objective absorbing reality, still delivering.', needs: '' },
  { k: 'Quality', prot: true, dev: 3, status: 'Holding to the baseline standard. Monitored, with no action needed.', needs: '' },
  { k: 'Funding', prot: true, dev: 22, status: 'Exposed. Facility headroom is tightening as cost moves against the baseline.', needs: 'Funding headroom is tightening. Review the facility.' },
];

const SPARK_PTS = [64, 66, 67, 69, 71, 74, 76, 79, 84, 86, 85, 82];

function buildSpark() {
  const w = 320,
    h = 46,
    n = SPARK_PTS.length,
    min = 60,
    max = 90;
  const xs = (i) => (i / (n - 1)) * w;
  const ys = (v) => h - ((v - min) / (max - min)) * (h - 6) - 3;
  let d = `M${xs(0)},${ys(SPARK_PTS[0])}`;
  for (let i = 1; i < n; i++) {
    const xc = (xs(i - 1) + xs(i)) / 2;
    d += ` C${xc},${ys(SPARK_PTS[i - 1])} ${xc},${ys(SPARK_PTS[i])} ${xs(i)},${ys(SPARK_PTS[i])}`;
  }
  return { d, fill: `${d} L${w},${h} L0,${h} Z`, ex: xs(n - 1), ey: ys(SPARK_PTS[n - 1]) };
}

function PulseInstrument() {
  const reduce = usePrefersReducedMotion();
  const [sel, setSel] = useState(1);
  const [num, setNum] = useState(reduce ? 82 : 0);
  const [drawn, setDrawn] = useState(false);
  const spark = useRef(buildSpark()).current;

  useEffect(() => {
    if (reduce) {
      setNum(82);
      setDrawn(true);
      return;
    }
    const t = setTimeout(() => {
      setDrawn(true);
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / 1200, 1);
        setNum(Math.round(82 * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 300);
    // safety: guarantee the final value even where rAF is throttled (background tab)
    const done = setTimeout(() => setNum(82), 1800);
    return () => {
      clearTimeout(t);
      clearTimeout(done);
    };
  }, [reduce]);

  const o = OBJ[sel];
  const mag = Math.min(Math.abs(o.dev), 100) / 2;
  const varLabel = o.dev === 0 ? 'on baseline' : o.dev > 0 ? `+${o.dev} vs baseline` : `${o.dev} vs baseline`;
  const gates = { 2: true, 6: true };
  const nowStage = 6;

  return (
    <div className={`${styles.inst} ${styles['live-on']}`} aria-label="A glance inside PULSE">
      <div className={styles.inst__head}>
        <div className={styles.pj}>
          Holloway Place<small>Mixed-use, 42 units &nbsp;&middot;&nbsp; In construction</small>
        </div>
        <span className={styles.mon}>
          <span className={styles.d} /> Monitoring
        </span>
      </div>
      <div className={styles.inst__metric}>
        <div>
          <div className={styles.mk}>Programme confidence</div>
          <div className={styles.mv}>
            <span className="tnum">{num}</span>
            <sup>%</sup>
          </div>
        </div>
        <div className={styles.delta}>holding, down 3 points this week</div>
        <div className={styles.spark}>
          <svg viewBox="0 0 320 46" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="homesg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#C77E33" stopOpacity="0.35" />
                <stop offset="1" stopColor="#C77E33" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className={styles.fillarea} d={spark.fill} style={{ opacity: drawn ? 0.5 : 0, transition: 'opacity 1s ease' }} />
            <path className={styles.ln} d={spark.d} />
            <circle className={styles.endc} cx={spark.ex} cy={spark.ey} r="3.2" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.4s ease 1.2s' }} />
          </svg>
        </div>
      </div>
      <div className={styles.inst__objs} role="group" aria-label="The five objectives">
        {OBJ.map((ob, i) => (
          <button
            key={ob.k}
            type="button"
            className={`${styles.obj} ${ob.prot ? styles.prot : ''}`}
            aria-pressed={i === sel}
            onClick={() => setSel(i)}
            onMouseEnter={() => setSel(i)}
          >
            <span className={styles.cd} />
            {ob.k}
          </button>
        ))}
      </div>
      <div className={styles.inst__detail}>
        <div className={styles.det__top}>
          <span className={styles.dn}>{o.k}</span>
          <span className={`${styles.tag} ${o.prot ? styles.prot : styles.flexc}`}>
            {o.prot ? 'Protected' : 'Flexible'}
          </span>
        </div>
        <p className={styles.det__status}>{o.status}</p>
        <div className={styles.var}>
          <div className={styles.var__labs}>
            <span>under baseline</span>
            <span>{varLabel}</span>
            <span>over baseline</span>
          </div>
          <div className={styles.var__track}>
            <span className={styles.var__base} />
            <span
              className={`${styles.var__fill} ${o.dev < 0 ? styles.under : ''} ${o.needs ? styles.alarm : ''}`}
              style={{ width: `${mag}%` }}
            />
          </div>
        </div>
      </div>
      <div className={`${styles.inst__signal} ${o.needs ? '' : styles.calm}`}>
        <span className={styles.ic}>{o.needs ? 'Needs you' : 'Clear'}</span>
        <span className={styles.tx}>
          {o.needs ? o.needs : 'No action on this objective. Monitored against the baseline.'}
        </span>
        <span className={styles.go}>&rarr;</span>
      </div>
      <div style={{ marginTop: '1.2rem' }}>
        <div className={styles.inst__timeline}>
          {Array.from({ length: 8 }, (_, idx) => {
            const t = idx + 1;
            return (
              <div key={t} className={`${styles.tl} ${t < nowStage ? styles.done : ''} ${t === nowStage ? styles.now : ''}`}>
                <span className={`${styles.nd} ${gates[t] ? styles.gate : ''}`} />
                {t < 8 && <span className={styles.bar} />}
              </div>
            );
          })}
        </div>
        <div className={styles.inst__tlabs}>
          <span>Land</span>
          <span>Construction</span>
          <span>Disposal</span>
        </div>
      </div>
    </div>
  );
}

function DesignPartnerForm() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [market, setMarket] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !company.trim() || !portfolio || !market) {
      setError('Please complete every field with a valid value.');
      return;
    }
    setBusy(true);
    const { error: insertError } = await supabase.from('design_partner_submissions').insert({
      email,
      company_name: company.trim(),
      portfolio_size: portfolio,
      primary_market: market,
      source_page: 'flitrr_com',
    });
    setBusy(false);
    if (insertError) {
      setError('Something went wrong. Please try again or email hello@flitrr.com.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className={styles.dp__done} role="status">
        <span className={styles.tk}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <strong>Request received.</strong> We will be in touch within 48 hours.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.flab} htmlFor="hdp-email">Email address</label>
        <input className={styles.in} id="hdp-email" type="email" placeholder="your@email.com" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }} />
      </div>
      <div className={styles.field}>
        <label className={styles.flab} htmlFor="hdp-company">Company name</label>
        <input className={styles.in} id="hdp-company" type="text" placeholder="e.g. Northpoint Developments" autoComplete="organization" value={company} onChange={(e) => { setCompany(e.target.value); if (error) setError(null); }} />
      </div>
      <div className={styles.frow}>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="hdp-portfolio">Portfolio size</label>
          <select className={styles.in} id="hdp-portfolio" value={portfolio} onChange={(e) => { setPortfolio(e.target.value); if (error) setError(null); }}>
            <option value="">Select...</option>
            <option value="1">1 project</option>
            <option value="2_to_3">2 to 3 projects</option>
            <option value="4_plus">4 plus projects</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="hdp-market">Primary market</label>
          <select className={styles.in} id="hdp-market" value={market} onChange={(e) => { setMarket(e.target.value); if (error) setError(null); }}>
            <option value="">Select...</option>
            <option value="uk">UK</option>
            <option value="nigeria">Nigeria</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>
      {error && <p className={styles.err} role="alert">{error}</p>}
      <button type="submit" className={`${styles.btn} ${styles.btnWarm} ${styles.submit}`} disabled={busy}>
        {busy ? 'Sending...' : 'Become a design partner'}
      </button>
    </form>
  );
}

export default function HomeMain({ user }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div className={`${styles.page} ${ready ? styles.ready : ''}`}>
      <SiteNav user={user} current="home" />
      <main id="main-content">
        {/* HERO */}
        <header className={styles.hero}>
          <div className={styles.hero__img}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-aerial-aylesbury-dusk.jpg"
              alt="A town at dusk seen from the air, the whole development context in one view"
            />
          </div>
          <div className={styles.hero__scrim} />
          <div className={styles.hero__inner}>
            <div className={styles.wrap}>
              <h1>One platform for the whole property development lifecycle.</h1>
              <p className={styles.hero__sub}>
                Institutional delivery discipline for independent and SME property developers: objectives defined
                and classified. Monitor what matters. From initiation to completion.
              </p>
              <div className={styles.hero__cta}>
                <Link href="/pulse" className={`${styles.btn} ${styles.btnSolid}`}>
                  Discover PULSE <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="#design-partner" className={`${styles.btn} ${styles.btnGhost}`}>
                  Become a design partner
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* PROBLEM */}
        <section className={styles.problem} aria-label="The problem Flitrr exists to solve">
          <div className={styles.problem__bg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/hero-crane-dusk.jpg" alt="" />
          </div>
          <div className={styles.problem__scrim} />
          <div className={`${styles.wrap} ${styles.problem__grid}`}>
            <p className={styles.problem__setup}>
              Property development is one of the most demanding delivery environments there is. Long
              lifecycles, high capital exposure, many parties, and decisions whose consequences surface
              years later. Major property developers meet it with programme offices and dedicated delivery
              infrastructure.
            </p>
            <p className={styles.problem__turn}>
              At independent and SME scale, that infrastructure has never existed. Flitrr is building it.
            </p>
          </div>
        </section>

        {/* FRAMEWORK */}
        <section className={styles.fw} id="framework" aria-labelledby="fw-heading">
          <div className={styles.fw__intro}>
            <div className={styles.wrap}>
              <div>
                <div className={styles.label}>The Flitrr Framework</div>
                <h2 id="fw-heading">The backbone behind everything we build.</h2>
              </div>
              <div>
                <p>
                  The 8-6-4 methodology: a delivery framework that brings independent and SME property developers
                  the rigour large developers have always had.
                </p>
                <div className={styles.cta}>
                  <Link className={styles.ghostlink} href="/framework">
                    Explore the Flitrr Framework <span className={styles.arw} aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.sig}>
            <div className={styles.wrap}>
              <div className={styles.sig__grid}>
                <div className={styles.sig__item}>
                  <span className={`${styles.sig__n} tnum`}>8</span>
                  <span className={styles.sig__lab}>Eight stages</span>
                  <p className={styles.sig__gloss}>The lifecycle of a development, from securing the land to realising the finished asset.</p>
                </div>
                <div className={styles.sig__item}>
                  <span className={`${styles.sig__n} tnum`}>6</span>
                  <span className={styles.sig__lab}>Six principles</span>
                  <p className={styles.sig__gloss}>The rules that govern how a project is run, at every stage.</p>
                </div>
                <div className={styles.sig__item}>
                  <span className={`${styles.sig__n} tnum`}>4</span>
                  <span className={styles.sig__lab}>Four mandates</span>
                  <p className={styles.sig__gloss}>What each stage must deliver to be done well.</p>
                </div>
              </div>
            </div>
          </div>
          <LifecycleReel />
        </section>

        {/* PULSE */}
        <section className={styles.pulse} id="pulse" aria-labelledby="pulse-heading">
          <div className={styles.wrap}>
            <div className={styles.lead}>
              <p className={styles.kick}>Our first product</p>
              <h2 id="pulse-heading">PULSE.</h2>
              <p>
                Project delivery and programme management. One screen tells you where a scheme stands, and
                the one thing that needs you.
              </p>
              <div className={styles.cta}>
                <Link href="/pulse" className={`${styles.btn} ${styles.btnWarm}`}>
                  Discover PULSE <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="#design-partner" className={`${styles.btn} ${styles.btnDim}`}>
                  Become a design partner
                </Link>
              </div>
            </div>
            <PulseInstrument />
          </div>
        </section>

        {/* SUITE */}
        <section className={styles.suite} id="roadmap" aria-labelledby="suite-heading">
          <div className={styles.wrap}>
            <div className={styles.suite__intro}>
              <h2 id="suite-heading">The suite.</h2>
              <p>PULSE leads the suite. More follow it across the lifecycle, each built to the same discipline.</p>
            </div>
            <div className={styles.suite__list}>
              <div className={`${styles.suite__row} ${styles.live}`}>
                <span className={styles.suite__nm}><span className={styles.dot} />PULSE</span>
                <span className={styles.suite__st}>Live</span>
                <span className={styles.suite__ds}>Project delivery and programme management.</span>
              </div>
              <div className={styles.suite__row}>
                <span className={styles.suite__nm}><span className={styles.dot} />STACK</span>
                <span className={styles.suite__st}>In design</span>
                <span className={styles.suite__ds}>Feasibility, budgets, and funding.</span>
              </div>
              <div className={styles.suite__row}>
                <span className={styles.suite__nm}><span className={styles.dot} />ROUTE</span>
                <span className={styles.suite__st}>In design</span>
                <span className={styles.suite__ds}>Strategy, tenders, and appointments.</span>
              </div>
              <div className={`${styles.suite__row} ${styles.ghost}`}>
                <span className={styles.suite__nm}><span className={styles.dot} />And more</span>
                <span className={styles.suite__st}>&nbsp;</span>
                <span className={styles.suite__ds}>Across the lifecycle, each to the same discipline.</span>
              </div>
            </div>
          </div>
        </section>

        {/* DESIGN PARTNER */}
        <section className={styles.dp} id="design-partner" aria-labelledby="dp-heading">
          <div className={styles.wrap}>
            <div>
              <h2 id="dp-heading">Built with property developers, not just for them.</h2>
              <p className={styles.sub}>
                Flitrr is being shaped with a small group of property developers. If you want the
                infrastructure before everyone else has it, talk to us.
              </p>
              <p className={styles.reassure}>
                Prefer email? Reach us directly at <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>.
              </p>
            </div>
            <div>
              <DesignPartnerForm />
            </div>
          </div>
        </section>

        {/* CLOSE */}
        <section className={styles.close}>
          <div className={styles.wrap}>
            <div>
              <h2>
                The whole lifecycle, <em>under control</em>.
              </h2>
              <div className={styles.cta}>
                <Link href="/pulse" className={`${styles.btn} ${styles.btnSolid}`}>
                  Discover PULSE <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="#design-partner" className={`${styles.btn} ${styles.btnDim}`}>
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

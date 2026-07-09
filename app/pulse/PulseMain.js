'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import SiteNav from '../components/considered/SiteNav';
import SiteFooter from '../components/considered/SiteFooter';
import styles from './pulse.module.css';

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

function HeroBoard() {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 250);
    return () => clearTimeout(t);
  }, []);
  const obj = [
    ['Scope', true],
    ['Cost', true],
    ['Time', false],
    ['Quality', true],
    ['Funding', true],
  ];
  return (
    <div className={`${styles.inst} ${styles['live-on']}`} aria-label="The PULSE workspace at a glance">
      <div className={styles.inst__head}>
        <div className={styles.pj}>
          Holloway Place<small>24 homes, Salford &middot; Stage 05, Construction</small>
        </div>
        <span className={styles.mon}>
          <span className={styles.d} /> Monitoring
        </span>
      </div>
      <div className={styles.metric}>
        <div>
          <div className={styles.mk}>Programme confidence</div>
          <div className={styles.mv}>
            <span className="tnum">82</span>
            <sup>%</sup>
          </div>
        </div>
        <div className={styles.delta}>holding, down 3 this week</div>
        <div className={styles.prog}>
          <span style={{ width: filled ? '82%' : '0' }} />
        </div>
      </div>
      <div className={styles.objrow}>
        {obj.map(([nm, p]) => (
          <span key={nm} className={`${styles.ochip} ${p ? styles.prot : ''}`}>
            <span className={styles.cd} />
            {nm}
          </span>
        ))}
      </div>
      <div className={styles.band}>
        <span className={styles.ic}>Needs you</span>
        <span className={styles.tx}>Cost is drifting over the locked baseline.</span>
        <span className={styles.go}>Respond</span>
      </div>
      <div className={styles.metric}>
        <div className={styles.kpis}>
          <span className={styles.kpi}>
            <b className="tnum">12</b>
            <span>Open actions</span>
          </span>
          <span className={styles.kpi}>
            <b className={`${styles.amber} tnum`}>3</b>
            <span>Critical</span>
          </span>
          <span className={styles.kpi}>
            <b className="tnum">4</b>
            <span>Risks watched</span>
          </span>
        </div>
      </div>
    </div>
  );
}

const BRIEF_OBJ = [
  ['Scope', 'Protected', true],
  ['Cost', 'Protected', true],
  ['Time', 'Flexible', false],
  ['Quality', 'Protected', true],
  ['Funding', 'Protected', true],
];

function BriefDoc() {
  const reduce = usePrefersReducedMotion();
  const [sealed, setSealed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce) {
      setSealed(true);
      return;
    }
    if (paused) return;
    const t = setTimeout(() => setSealed((s) => !s), sealed ? 3000 : 4400);
    return () => clearTimeout(t);
  }, [reduce, paused, sealed]);

  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => setPaused(false), 7000);
    return () => clearTimeout(t);
  }, [paused]);

  const toggle = () => {
    if (reduce) return;
    setSealed((s) => !s);
    setPaused(true);
  };

  return (
    <div className={styles['doc-wrap']}>
      <button
        type="button"
        className={`${styles.doc} ${sealed ? styles.sealed : ''}`}
        onClick={toggle}
        aria-label="A project Brief, locking as the baseline. Activate to lock or unlock."
      >
        <div className={styles.doc__c}>
          <div className={styles.doc__k}>Project Brief</div>
          <div className={styles.doc__t}>Holloway Place</div>
          <div className={styles.doc__s}>24 homes, Salford</div>
          <p className={styles.doc__v}>
            A 24-home residential scheme, delivered to a fixed budget with funding closed before
            construction begins.
          </p>
          <div className={styles.doc__oh}>Objectives</div>
          <div className={styles.doc__ol}>
            {BRIEF_OBJ.map(([nm, cls, hot]) => (
              <div key={nm} className={styles.doc__or}>
                <span style={{ color: '#fff' }}>{nm}</span>
                <span className={`${styles.cls} ${hot ? styles.hot : ''}`}>{cls}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.doc__cover}>
          <span className={styles.lk}>
            <svg width="22" height="24" viewBox="0 0 14 16" fill="none" aria-hidden="true">
              <rect x="2.2" y="6.6" width="9.6" height="7.4" rx="1.6" fill="currentColor" />
              <path d="M4.2 6.6V4.7a2.8 2.8 0 0 1 5.6 0v1.9" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          </span>
          <span className={styles.cl}>Baseline locked</span>
          <span className={styles.cp}>Holloway Place, v1</span>
        </div>
      </button>
      <span className={styles['doc-hint']}>{sealed ? 'Click to unlock' : 'Click to lock'}</span>
    </div>
  );
}

function Classified() {
  const [objs, setObjs] = useState([
    ['Scope', 1],
    ['Cost', 1],
    ['Time', 0],
    ['Quality', 1],
    ['Funding', 1],
  ]);
  const n = objs.filter((o) => o[1]).length;
  const toggle = (i) =>
    setObjs((prev) => prev.map((o, idx) => (idx === i ? [o[0], o[1] ? 0 : 1] : o)));
  return (
    <div className={styles.clpanel}>
      <div className={styles.ph}>
        <span className={styles.label}>Classification</span>
        <small>tap an objective to reclassify</small>
      </div>
      <div>
        {objs.map((o, i) => (
          <button key={o[0]} type="button" className={styles.clobj} onClick={() => toggle(i)}>
            <span className={styles.nm}>{o[0]}</span>
            <span className={`${styles.clpill} ${o[1] ? styles.prot : styles.flexc}`}>
              {o[1] ? 'Protected' : 'Flexible'}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.clnote}>
        Protecting <b>{n} of 5</b>. Monitoring intensity follows the classification.
      </div>
    </div>
  );
}

const PLAYBOOK = [
  ['Confirm the fixed-price contract holds before the next valuation, so cost cannot drift unnoticed.', ['Protects Cost', 'Risk']],
  ['Re-baseline the programme after the planning delay, and re-approve it, rather than letting the dates slide.', ['Protects Time', 'Milestone']],
  ['Review the funding conditions with the lender before the stage gate, while there is still room to act.', ['Protects Funding', 'Action']],
];

function Playbook() {
  const reduce = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);
  const advance = () => {
    const nx = (i + 1) % PLAYBOOK.length;
    if (reduce) {
      setI(nx);
      return;
    }
    setFading(true);
    setTimeout(() => {
      setI(nx);
      setFading(false);
    }, 180);
  };
  const [text, meta] = PLAYBOOK[i];
  return (
    <div className={styles.pbcard} style={fading ? { opacity: 0, transform: 'translateY(8px)' } : undefined}>
      <div className={styles.pbk}>
        <span className={`${styles.mdot} ${styles.hot}`} /> Playbook suggestion &middot; Stage 05, Construction
      </div>
      <div className={styles.pbt}>{text}</div>
      <div className={styles.pbm}>
        {meta.map((m, mi) => (
          <span key={m} className={`${styles.m} ${mi === 0 ? styles.hot : ''}`}>
            {m}
          </span>
        ))}
      </div>
      <div className={styles.pbact}>
        <button type="button" className={`${styles.pbbtn} ${styles.acc}`} onClick={advance}>
          Accept
        </button>
        <button type="button" className={`${styles.pbbtn} ${styles.dis}`} onClick={advance}>
          Dismiss
        </button>
        <span className={styles.pbcount}>
          {i + 1} of {PLAYBOOK.length}
        </span>
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
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !company.trim() ||
      !portfolio ||
      !market
    ) {
      setError('Please complete every field with a valid value.');
      return;
    }
    setBusy(true);
    const { error: insertError } = await supabase.from('design_partner_submissions').insert({
      email,
      company_name: company.trim(),
      portfolio_size: portfolio,
      primary_market: market,
      source_page: 'pulse_page',
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
        <label className={styles.flab} htmlFor="pdp-email">
          Email address
        </label>
        <input
          className={styles.in}
          id="pdp-email"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.flab} htmlFor="pdp-company">
          Company / practice name
        </label>
        <input
          className={styles.in}
          id="pdp-company"
          type="text"
          placeholder="e.g. Northpoint Developments"
          autoComplete="organization"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      <div className={styles.frow}>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="pdp-portfolio">
            Portfolio size
          </label>
          <select
            className={styles.in}
            id="pdp-portfolio"
            value={portfolio}
            onChange={(e) => {
              setPortfolio(e.target.value);
              if (error) setError(null);
            }}
          >
            <option value="">Select...</option>
            <option value="1">1 project</option>
            <option value="2_to_3">2 to 3 projects</option>
            <option value="4_plus">4 plus projects</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.flab} htmlFor="pdp-market">
            Primary market
          </label>
          <select
            className={styles.in}
            id="pdp-market"
            value={market}
            onChange={(e) => {
              setMarket(e.target.value);
              if (error) setError(null);
            }}
          >
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

export default function PulseMain({ user }) {
  return (
    <div className={styles.page}>
      <SiteNav user={user} current="pulse" product="PULSE" />
      <main id="main-content">
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="pulse-h">
          <div className={styles.hero__bg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/texture-facades.jpg" alt="" />
          </div>
          <div className={styles.wrap}>
            <div>
              <span className={styles.hero__pill}>
                <span className={styles.live} /> Monitoring what matters
              </span>
              <h1 id="pulse-h">Run your development like you have a programme office.</h1>
              <p className={styles.hero__sub}>
                PULSE is project delivery and programme management for independent and SME property
                developers. It runs your project the way a seasoned programme director would, because
                one is built in.
              </p>
              <div className={styles.hero__cta}>
                <Link href="#design-partner" className={`${styles.btn} ${styles.btnWarm}`}>
                  Become a design partner <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="#product" className={`${styles.btn} ${styles.btnDim}`}>
                  See it work
                </Link>
              </div>
            </div>
            <HeroBoard />
          </div>
        </section>

        {/* PROBLEM: the quiet-drift ledger */}
        <section className={styles.problem} aria-label="The problem PULSE solves">
          <div className={styles.wrap}>
            <div>
              <p className={styles.pstmt}>
                A development can fail politely. No single disaster, just a hundred small drifts nobody
                was watching. <span className={styles.turn}>PULSE is built so that what matters cannot drift quietly.</span>
              </p>
              <p className={styles.pdiff}>
                Large property developers buy this discipline from firms most independent developers are priced
                out of. <b>PULSE gives it to you directly.</b>
              </p>
            </div>
            <div className={styles.ledger} aria-label="Three quiet drifts on an unwatched project">
              <div className={styles.ledger__h}>
                <span className={styles.ln}>Holloway Place</span>
                <span className={styles.lg}>The quiet drift, unwatched</span>
              </div>
              <div className={styles.lrow}>
                <span className={styles.ldot} />
                <span className={styles.lk}>Cost objective</span>
                <span className={styles.lv}>not confirmed in 3 months</span>
              </div>
              <div className={styles.lrow}>
                <span className={styles.ldot} />
                <span className={styles.lk}>Locked baseline</span>
                <span className={styles.lv}>changed twice, never re-approved</span>
              </div>
              <div className={`${styles.lrow} ${styles.crit}`}>
                <span className={styles.ldot} />
                <span className={styles.lk}>Critical risk</span>
                <span className={styles.lv}>unreviewed for 94 days</span>
              </div>
              <div className={styles.ledger__f}>Three drifts. None of them shouted.</div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={styles.how} id="product" aria-labelledby="how-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="how-h">Set it up once. PULSE watches the rest.</h2>
              <p>
                A guided start, then a system that keeps what matters in front of you, from the first
                decision to the last.
              </p>
            </div>
            <div className={styles.beats}>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.mrow}>
                    <span className={styles.nm}>Scope</span>
                    <span className={`${styles.mtag} ${styles.hot}`}>Protected</span>
                  </div>
                  <div className={styles.mrow}>
                    <span className={styles.nm}>Cost</span>
                    <span className={`${styles.mtag} ${styles.hot}`}>Protected</span>
                  </div>
                  <div className={styles.mrow}>
                    <span className={styles.nm}>Time</span>
                    <span className={styles.mtag}>Flexible</span>
                  </div>
                  <div className={styles.mseal}>
                    <span className={`${styles.mdot} ${styles.hot}`} />
                    Baseline locked, v1
                  </div>
                </div>
                <div className={styles.beat__n}>1</div>
                <h3>Set it up once</h3>
                <p>
                  A nine-step guided start turns your project into a formal Brief, version-locked as the
                  baseline every module reads from.
                </p>
              </div>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.mflag}>
                    <span className={`${styles.mdot} ${styles.hot}`} />
                    Construction costs exceed the fixed budget
                    <span className={`${styles.sev} ${styles.hot}`}>Critical</span>
                  </div>
                  <div className={`${styles.mflag} ${styles.muted}`}>
                    <span className={`${styles.mdot} ${styles.cool}`} />
                    Sales slower than forecast
                    <span className={styles.sev}>Quiet</span>
                  </div>
                </div>
                <div className={styles.beat__n}>2</div>
                <h3>It flags what matters</h3>
                <p>
                  PULSE watches your objectives, risks and milestones, and raises the ones that threaten
                  what you said you cannot compromise.
                </p>
              </div>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.band} style={{ marginTop: '0.2rem' }}>
                    <span className={styles.ic}>Needs you</span>
                    <span className={styles.tx} style={{ fontSize: '0.82rem' }}>
                      Confirm the funding conditions
                    </span>
                  </div>
                  <div className={styles.mseal} style={{ color: 'var(--on-deep-mut)' }}>
                    <span className={`${styles.mdot} ${styles.cool}`} />
                    In your inbox weekly
                  </div>
                </div>
                <div className={styles.beat__n}>3</div>
                <h3>You respond in one place</h3>
                <p>
                  Everything that needs a decision, from every module, lands in the Action Log, sorted by
                  what you protected.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BRIEF */}
        <section className={styles.brief} id="brief" aria-labelledby="brief-h">
          <div className={styles.brief__bg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/texture-site-overview.jpg" alt="" />
          </div>
          <div className={styles.wrap}>
            <BriefDoc />
            <div className={styles.brief__copy}>
              <h2 id="brief-h">The brief the whole project answers to.</h2>
              <p>
                PULSE turns your project into a formal Brief: the vision, the objectives, what you cannot
                compromise and what can flex, and version-locks it as the baseline every module reads
                from. From there, change is a decision you make on purpose, never a drift you find out
                about later.
              </p>
              <p className={styles.tag}>The discipline to start right.</p>
            </div>
          </div>
        </section>

        {/* CLASSIFIED */}
        <section className={styles.classified} aria-labelledby="cl-h">
          <div className={styles.wrap}>
            <div>
              <h2 id="cl-h">Decide what holds, and what can move.</h2>
              <p className={styles.ctext}>
                At the start, across five objectives, scope, cost, time, quality and funding, you decide
                what the project cannot compromise on and what can flex. Some must hold; some can move.
                You make the call once, and it governs everything after it.
              </p>
              <p className={styles.ctrap}>
                Protect everything, and nothing has give when reality bites.
              </p>
            </div>
            <Classified />
          </div>
        </section>

        {/* MODULES */}
        <section className={styles.modules} aria-labelledby="mod-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="mod-h">Everything that needs you, in one place.</h2>
              <p>
                Risk, programme and the executive view each do their job, then push what needs a decision
                into the Action Log, sorted by what you protected.
              </p>
            </div>
            <div className={styles.hublayout}>
              <article className={styles.actionlog}>
                <div className={styles.al__h}>
                  <span className={styles.al__t}>Action Log</span>
                  <span className={styles.mon}>
                    <span className={styles.d} /> Live
                  </span>
                </div>
                <div className={styles.al__band}>
                  <div className={`${styles.al__row} ${styles.crit}`}>
                    <span className={`${styles.chip} ${styles.crit}`}>Critical</span>
                    <span className={styles.al__tx}>Confirm the funding conditions with the lender</span>
                    <span className={styles.al__resp}>Respond</span>
                  </div>
                  <div className={`${styles.al__row} ${styles.crit}`}>
                    <span className={`${styles.chip} ${styles.crit}`}>Critical</span>
                    <span className={styles.al__tx}>Cost is drifting over the locked baseline</span>
                    <span className={styles.al__resp}>Respond</span>
                  </div>
                  <div className={styles.al__row}>
                    <span className={styles.chip}>Standard</span>
                    <span className={styles.al__tx}>Consultant appointment due next week</span>
                    <span className={styles.al__resp} style={{ color: 'var(--on-deep-mut)' }}>Later</span>
                  </div>
                </div>
                <p className={styles.al__note}>
                  Everything that needs you, from every module, pushed here and sorted by what you
                  protected. The critical rises; the quiet waits its turn.
                </p>
              </article>
              <div className={styles.feeders}>
                <div className={styles.feeders__h}>Fed by every module</div>
                <div className={styles.feeder}>
                  <div className={styles.feeder__vg}>
                    <div className={styles['fvg-row']}>
                      <span className={`${styles['fvg-dot']} ${styles.hot}`} />
                      <span className={styles['fvg-t']} />
                    </div>
                    <div className={styles['fvg-row']}>
                      <span className={`${styles['fvg-dot']} ${styles.cool}`} />
                      <span className={styles['fvg-t']} style={{ maxWidth: '60%' }} />
                    </div>
                  </div>
                  <div>
                    <b>Risk Register</b>
                    <span className={styles.d}>Risks in plain language, surfaced by criticality.</span>
                  </div>
                </div>
                <div className={styles.feeder}>
                  <div className={styles.feeder__vg}>
                    <span className={styles['fvg-bar']} style={{ maxWidth: '78%' }} />
                    <span className={`${styles['fvg-bar']} ${styles.hot}`} style={{ maxWidth: '52%', marginLeft: '14%' }} />
                    <span className={styles['fvg-bar']} style={{ maxWidth: '40%', marginLeft: '34%' }} />
                  </div>
                  <div>
                    <b>Programme Tracker</b>
                    <span className={styles.d}>The baseline against reality, and the variance between them.</span>
                  </div>
                </div>
                <div className={styles.feeder}>
                  <div className={styles.feeder__vg}>
                    <span className={styles['fvg-kpi']}>
                      <b>3</b> critical, unresolved
                    </span>
                    <span className={styles['fvg-kpi']}>82% on track</span>
                  </div>
                  <div>
                    <b>Executive Dashboard</b>
                    <span className={styles.d}>The whole project on one screen.</span>
                  </div>
                </div>
                <div className={styles.digest2}>
                  <span className={styles.di} aria-hidden="true" />
                  <div>
                    <b>Weekly digest.</b>{' '}
                    <span className={styles.dn}>Your critical actions, in your inbox every Monday.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLAYBOOK */}
        <section className={styles.playbook} id="playbook" aria-labelledby="pb-h">
          <div className={styles.wrap}>
            <div>
              <h2 id="pb-h">The knowledge you were never handed.</h2>
              <p className={styles.body}>
                Most property developers learn programme management by paying for the lessons. PULSE ships with the
                playbook instead: at every stage, it proposes the actions and risks a veteran programme
                director would already be watching for, each explained in one plain sentence, each
                prioritised by the objectives you protected. Accept with a tap, or dismiss it.
              </p>
            </div>
            <Playbook />
          </div>
        </section>

        {/* FRAMEWORK CREDIT */}
        <section className={styles.fwc} id="framework-credit">
          <div className={styles.wrap}>
            <Link href="/framework">
              <span>
                <span className={styles.ey}>Built on the Flitrr Framework</span>
                <span className={styles.ln}>
                  The delivery discipline behind every Flitrr product. PULSE is the first to run on it.
                </span>
              </span>
              <span className={styles.cta}>
                Explore the Framework <span className={styles.arw} aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          </div>
        </section>

        {/* DESIGN PARTNER */}
        <section className={styles.dp} id="design-partner" aria-labelledby="dp-h">
          <div className={styles.wrap}>
            <div>
              <h2 id="dp-h">Built with property developers, not just for them.</h2>
              <p className={styles.sub}>
                PULSE is being shaped with a small group of property developers. If you want the
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
      </main>
      <SiteFooter variant="pulse" />
    </div>
  );
}

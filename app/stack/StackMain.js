'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import SiteNav from '../components/considered/SiteNav';
import SiteFooter from '../components/considered/SiteFooter';
import StackGlance from '../components/considered/StackGlance';
import styles from './stackLanding.module.css';

/**
 * The STACK landing page: the public face of the feasibility and funding
 * product, on the "Considered" dark system beside the PULSE page. It sells the
 * product's ground (feasibility, budgets and funding) and shows the live
 * feature, the guided development appraisal and funding model at /stack/app.
 * The hero glance (StackGlance, shared with the home products band) is a
 * worked illustration in the engine's own vocabulary (GO, CONSIDER, NO GO).
 */

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
      source_page: 'stack_page',
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
        <label className={styles.flab} htmlFor="sdp-email">
          Email address
        </label>
        <input
          className={styles.in}
          id="sdp-email"
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
        <label className={styles.flab} htmlFor="sdp-company">
          Company / practice name
        </label>
        <input
          className={styles.in}
          id="sdp-company"
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
          <label className={styles.flab} htmlFor="sdp-portfolio">
            Portfolio size
          </label>
          <select
            className={styles.in}
            id="sdp-portfolio"
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
          <label className={styles.flab} htmlFor="sdp-market">
            Primary market
          </label>
          <select
            className={styles.in}
            id="sdp-market"
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

export default function StackMain({ user }) {
  const signedIn = Boolean(user);
  return (
    <div className={styles.page}>
      <SiteNav user={user} current="stack" product="STACK" />
      <main id="main-content">
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="stack-h">
          <div className={styles.hero__bg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/texture-brick-detail.jpg" alt="" />
          </div>
          <div className={styles.wrap}>
            <div>
              <span className={styles.hero__pill}>
                <span className={styles.live} /> Feasibility and funding
              </span>
              <h1 id="stack-h">Know it stacks up before you commit.</h1>
              <p className={styles.hero__sub}>
                STACK is feasibility, budgets and funding for independent and SME property
                developers. It answers the two questions every scheme starts with: does this stack
                up, and how do I fund it.
              </p>
              <div className={styles.hero__cta}>
                {signedIn ? (
                  <Link href="/stack/app" className={`${styles.btn} ${styles.btnWarm}`}>
                    Open STACK <span className={styles.arw} aria-hidden="true">&rarr;</span>
                  </Link>
                ) : (
                  <Link href="#design-partner" className={`${styles.btn} ${styles.btnWarm}`}>
                    Become a design partner <span className={styles.arw} aria-hidden="true">&rarr;</span>
                  </Link>
                )}
                <Link href="#product" className={`${styles.btn} ${styles.btnDim}`}>
                  See the product
                </Link>
              </div>
            </div>
            <StackGlance />
          </div>
        </section>

        {/* PROBLEM: the blind spreadsheet */}
        <section className={styles.problem} aria-label="The problem STACK solves">
          <div className={styles.wrap}>
            <div>
              <p className={styles.pstmt}>
                Most schemes are committed on a spreadsheet nobody fully trusts.{' '}
                <span className={styles.turn}>STACK is built so the decision can defend itself.</span>
              </p>
              <p className={styles.pdiff}>
                Large developers answer these questions with appraisal teams, cost consultants and
                specialist viability tools. <b>STACK gives that to you directly</b>, guided for
                someone with only basic financial knowledge.
              </p>
            </div>
            <div className={styles.ledger} aria-label="The spreadsheet, trusted blind">
              <div className={styles.ledger__h}>
                <span className={styles.ln}>The old way</span>
                <span className={styles.lg}>A spreadsheet, trusted blind</span>
              </div>
              <div className={styles.lrow}>
                <span className={styles.ldot} />
                <span className={styles.lk}>Build cost</span>
                <span className={styles.lv}>pasted in, source unknown</span>
              </div>
              <div className={styles.lrow}>
                <span className={styles.ldot} />
                <span className={styles.lk}>Interest formula</span>
                <span className={styles.lv}>broken since the last edit</span>
              </div>
              <div className={`${styles.lrow} ${styles.crit}`}>
                <span className={styles.ldot} />
                <span className={styles.lk}>The bottom line</span>
                <span className={styles.lv}>does not reconcile</span>
              </div>
              <div className={styles.ledger__f}>It looked right. Nobody could prove it.</div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={styles.how} id="product" aria-labelledby="how-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="how-h">Choose the route. Enter the scheme. Read the answer.</h2>
              <p>
                A guided appraisal you can run with basic financial knowledge, and a result a
                lender can interrogate.
              </p>
            </div>
            <div className={styles.beats}>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.mchips}>
                    <span className={styles.mchip}>Self-funded</span>
                    <span className={`${styles.mchip} ${styles.hot}`}>Debt-financed</span>
                    <span className={styles.mchip}>Joint venture</span>
                    <span className={styles.mchip}>Off-plan</span>
                  </div>
                </div>
                <div className={styles.beat__n}>1</div>
                <h3>Choose the funding strategy</h3>
                <p>
                  The strategy is the main switch. It drives what you are asked and how the result
                  is computed, so you only ever see the fields your route needs.
                </p>
              </div>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.mfield}>
                    <span className={styles.fk}>Gross development value</span>
                    <span className={styles.fh}>The sale value of the finished scheme.</span>
                  </div>
                  <div className={styles.mfield}>
                    <span className={styles.fk}>Senior interest rate</span>
                    <span className={styles.fh}>Per year, rolled up. Typical 6.5 to 9%.</span>
                  </div>
                </div>
                <div className={styles.beat__n}>2</div>
                <h3>Enter the scheme, guided</h3>
                <p>
                  Every field carries plain guidance and a typical range, with forced choices where
                  possible, so you are never left guessing what a number means.
                </p>
              </div>
              <div className={styles.beat}>
                <div className={styles.beat__mini}>
                  <div className={styles.mverdict}>
                    <span className={styles.vt}>On or above target</span>
                    <span className={styles.vg}>GO</span>
                  </div>
                  <div className={styles.mfigrow}>
                    <div className={styles.mfig}>
                      <b className="tnum">21.5%</b>
                      <span>Profit on cost</span>
                    </div>
                    <div className={styles.mfig}>
                      <b className="tnum">&pound;1,050,000</b>
                      <span>Residual land</span>
                    </div>
                  </div>
                </div>
                <div className={styles.beat__n}>3</div>
                <h3>Read the answer</h3>
                <p>
                  A summary with a plain GO, CONSIDER or NO GO, the monthly cashflow behind it, a
                  side-by-side comparison of funding routes, and sensitivity on the variables that
                  bite. Export it as a PDF report or a values-only workbook.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THE EDGE */}
        <section className={styles.edge} aria-labelledby="edge-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="edge-h">No invented numbers. No unexplained ones.</h2>
              <p>
                Two properties separate STACK from a generic calculator, and from a generative tool
                that produces a confident figure it cannot stand behind.
              </p>
            </div>
            <div className={styles.edge__grid}>
              <div className={styles.ecard}>
                <span className={styles.ey}>Deterministic</span>
                <p className={styles.et}>Every output is a pure function of the inputs.</p>
                <p className={styles.ed}>
                  Run it twice and get the same answer. The model reconciles exactly:{' '}
                  <b>cash uses funded equals cash uses</b>, and{' '}
                  <b>net value equals redemption plus distributions</b>. Both read zero on every
                  strategy, every time.
                </p>
              </div>
              <div className={styles.ecard}>
                <span className={styles.ey}>Traceable</span>
                <p className={styles.et}>Every assumption carries its basis.</p>
                <p className={styles.ed}>
                  You, a lender or a partner can see where each figure comes from and challenge it.
                  The decision is made on numbers that can be interrogated, <b>not hoped about</b>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THE FOUR ROUTES */}
        <section className={styles.routes} aria-labelledby="routes-h">
          <div className={styles.wrap}>
            <div className={styles.shead}>
              <h2 id="routes-h">Four ways to fund a scheme. One model.</h2>
              <p>Pick your route, or compare them side by side on the same scheme.</p>
            </div>
            <div className={styles.routes__grid}>
              <div className={styles.route}>
                <span className={styles.rn}>01</span>
                <h3>Self-funded</h3>
                <p>All your own money. The cleanest read of whether the scheme itself works.</p>
              </div>
              <div className={styles.route}>
                <span className={styles.rn}>02</span>
                <h3>Debt-financed</h3>
                <p>
                  A senior loan sized by loan to cost and loan to GDV caps, with an optional
                  mezzanine top-up.
                </p>
              </div>
              <div className={styles.route}>
                <span className={styles.rn}>03</span>
                <h3>Joint venture</h3>
                <p>
                  A partner brings cash, land or both, with a preferred return and a promote. Land
                  for equity included.
                </p>
              </div>
              <div className={styles.route}>
                <span className={styles.rn}>04</span>
                <h3>Off-plan</h3>
                <p>Pre-sales fund the build, the route that leads in Lagos as often as in Leeds.</p>
              </div>
            </div>
            <div className={styles.geo}>
              <span className={styles.gd} aria-hidden="true" />
              <p>
                <b>Built for the United Kingdom and Nigeria from day one.</b> SDLT, Section 106 and
                the Community Infrastructure Levy on one side; off-plan-led funding and naira
                reporting on the other. Six currencies, GBP by default.
              </p>
            </div>
          </div>
        </section>

        {/* THE SUITE */}
        <section className={styles.suite} aria-label="One platform">
          <div className={styles.wrap}>
            <div className={styles.suite__grid}>
              <Link href="/pulse" className={styles.scard}>
                <span>
                  <span className={styles.ey}>One platform</span>
                  <span className={styles.ln}>
                    STACK produces the decision. PULSE delivers it. One platform for the whole
                    lifecycle.
                  </span>
                </span>
                <span className={styles.cta}>
                  Discover PULSE <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </span>
              </Link>
              <Link href="/framework" className={styles.scard}>
                <span>
                  <span className={styles.ey}>Built on the Flitrr Framework</span>
                  <span className={styles.ln}>
                    The delivery discipline behind every Flitrr product, carried upstream to the
                    decision.
                  </span>
                </span>
                <span className={styles.cta}>
                  Explore the Framework <span className={styles.arw} aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* DESIGN PARTNER */}
        <section className={styles.dp} id="design-partner" aria-labelledby="dp-h">
          <div className={styles.wrap}>
            <div>
              <h2 id="dp-h">Shape the tool you will fund schemes with.</h2>
              <p className={styles.sub}>
                STACK is being shaped with a small group of property developers. If you want the
                appraisal discipline before everyone else has it, talk to us.
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
      <SiteFooter variant="stack" />
    </div>
  );
}

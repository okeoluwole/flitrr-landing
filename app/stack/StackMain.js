'use client';

import { useState } from 'react';
import Link from 'next/link';
import Photo from '../components/considered/Photo';
import SiteNav from '../components/considered/SiteNav';
import DesignPartnerForm from '../components/considered/DesignPartnerForm';
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


/* The appraisal, live: drag the value or the build cost and the verdict
   recomputes. The same worked Fenwick Yard scheme as the hero glance
   (GDV 4,200,000; build 2,400,000 of a 3,458,000 total), so the two panels
   corroborate each other. Deterministic: the verdict is a pure function of
   the two adjustments. */
const SENS_BASE = { gdv: 4200000, build: 2400000, other: 1058000 };

function fmtMoney(n) {
  const v = Math.round(Math.abs(n));
  return (n < 0 ? '-\u00A3' : '\u00A3') + v.toLocaleString('en-GB');
}

function SensitivityInstrument() {
  const [gdvAdj, setGdvAdj] = useState(0);
  const [buildAdj, setBuildAdj] = useState(0);

  const gdv = SENS_BASE.gdv * (1 + gdvAdj / 100);
  const cost = SENS_BASE.other + SENS_BASE.build * (1 + buildAdj / 100);
  const profit = gdv - cost;
  const poc = (profit / cost) * 100;
  const verdict = poc >= 20 ? 'GO' : poc >= 12 ? 'CONSIDER' : 'NO GO';
  const verdictText =
    verdict === 'GO'
      ? 'On or above target, with the funding sized.'
      : verdict === 'CONSIDER'
        ? 'Below the 20% target. Workable, if the scheme or the price tightens.'
        : 'The margin is gone. Do not commit on these numbers.';
  const touched = gdvAdj !== 0 || buildAdj !== 0;

  return (
    <div className={styles.sens} aria-label="Sensitivity on the worked appraisal">
      <div className={styles.sens__head}>
        <div className={styles.pj}>
          Fenwick Yard, Leeds<small>The same appraisal, moved by hand</small>
        </div>
        <button
          type="button"
          className={styles.sens__reset}
          onClick={() => {
            setGdvAdj(0);
            setBuildAdj(0);
          }}
          disabled={!touched}
        >
          Reset to appraised
        </button>
      </div>
      <div className={styles.sens__row}>
        <div className={styles.sens__lab}>
          <span>Gross development value</span>
          <b className="tnum">{fmtMoney(gdv)}</b>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={gdvAdj}
          onChange={(e) => setGdvAdj(Number(e.target.value))}
          aria-label="Adjust gross development value, percent"
        />
        <div className={styles.sens__ticks} aria-hidden="true">
          <span>-12%</span>
          <span>appraised</span>
          <span>+12%</span>
        </div>
      </div>
      <div className={styles.sens__row}>
        <div className={styles.sens__lab}>
          <span>Build cost</span>
          <b className="tnum">{fmtMoney(SENS_BASE.build * (1 + buildAdj / 100))}</b>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={buildAdj}
          onChange={(e) => setBuildAdj(Number(e.target.value))}
          aria-label="Adjust build cost, percent"
        />
        <div className={styles.sens__ticks} aria-hidden="true">
          <span>-12%</span>
          <span>tendered</span>
          <span>+12%</span>
        </div>
      </div>
      <div className={styles.sens__read}>
        <div>
          <div className={styles.mk}>Profit on cost</div>
          <div className={`${styles.mv} ${poc < 20 ? styles.below : ''}`}>
            <span className="tnum">{poc.toFixed(1)}</span>
            <sup>%</sup>
          </div>
        </div>
        <div className={styles.sens__figs}>
          <span>
            <b className="tnum">{fmtMoney(profit)}</b>
            <i>Profit</i>
          </span>
          <span>
            <b className="tnum">{fmtMoney(cost)}</b>
            <i>Total cost</i>
          </span>
        </div>
      </div>
      <div className={styles.sens__band}>
        <span className={styles.ic}>Verdict</span>
        <span className={styles.tx}>{verdictText}</span>
        <span
          className={`${styles.vg} ${verdict === 'CONSIDER' ? styles.vmid : ''} ${verdict === 'NO GO' ? styles.vno : ''}`}
        >
          {verdict}
        </span>
      </div>
      <p className={styles.sens__note}>Reconciles to zero on every move.</p>
    </div>
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
            <Photo src="/images/texture-brick-detail.jpg" priority />
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
              <p className={styles.pstmt} data-reveal>
                Most schemes are committed on a spreadsheet nobody fully trusts.{' '}
                <span className={styles.turn}>STACK is built so the decision can defend itself.</span>
              </p>
              <p className={styles.pdiff}>
                Large developers answer these questions with appraisal teams, cost consultants and
                specialist viability tools. <b>STACK gives that to you directly</b>, guided for
                someone with only basic financial knowledge.
              </p>
            </div>
            <div className={styles.ledger} data-reveal aria-label="The spreadsheet, trusted blind">
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
            <div className={styles.shead} data-reveal>
              <h2 id="how-h">Choose the route. Enter the scheme. Read the answer.</h2>
              <p>
                A guided appraisal you can run with basic financial knowledge, and a result a
                lender can interrogate.
              </p>
            </div>
            <div className={styles.beats}>
              <div className={styles.beat} data-reveal>
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
              <div className={styles.beat} data-reveal>
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
              <div className={styles.beat} data-reveal>
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

        {/* SENSITIVITY: the model, moved by hand */}
        <section className={styles.sensitivity} aria-labelledby="sens-h">
          <div className={styles.wrap}>
            <div data-reveal>
              <h2 id="sens-h" className={styles.sens__title}>Move the numbers. Watch it answer.</h2>
              <p className={styles.sens__body}>
                A scheme rarely fails at appraisal. It fails when the numbers move later. Drag the
                value or the build cost and the verdict recomputes, deterministically, exactly as
                the full model does.
              </p>
              <p className={styles.sens__micro}>
                A worked illustration in the engine&rsquo;s own vocabulary: GO, CONSIDER, NO GO.
              </p>
            </div>
            <SensitivityInstrument />
          </div>
        </section>

        {/* THE PROOF: the two identities the model reconciles to */}
        <section className={styles.recon} aria-labelledby="edge-h">
          <div className={styles.wrap}>
            <div className={styles.shead} data-reveal>
              <h2 id="edge-h">No invented numbers. No unexplained ones.</h2>
              <p>
                Every output is a pure function of the inputs, and every assumption carries its
                basis. The model proves it by reconciling to zero, twice, on every strategy.
              </p>
            </div>
            <div className={styles.recon__rows}>
              <div className={styles.recon__row} data-reveal>
                <div>
                  <p className={styles.recon__id}>cash uses funded = cash uses</p>
                  <p className={styles.recon__gloss}>
                    Run it twice and get the same answer. Nothing is sampled, nothing is guessed.
                  </p>
                </div>
                <div className={styles.recon__zero}>
                  <b className="tnum">0.00</b>
                  <span>difference, every strategy</span>
                </div>
              </div>
              <div className={styles.recon__row} data-reveal>
                <div>
                  <p className={styles.recon__id}>net value = redemption + distributions</p>
                  <p className={styles.recon__gloss}>
                    You, a lender or a partner can see where each figure comes from and challenge it.
                  </p>
                </div>
                <div className={styles.recon__zero}>
                  <b className="tnum">0.00</b>
                  <span>difference, every run</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE FOUR ROUTES */}
        <section className={styles.routes} aria-labelledby="routes-h">
          <div className={styles.wrap}>
            <div className={styles.shead} data-reveal>
              <h2 id="routes-h">Four ways to fund a scheme. One model.</h2>
              <p>Pick your route, or compare them side by side on the same scheme.</p>
            </div>
            <div className={styles.routes__grid}>
              <div className={styles.route} data-reveal>
                <span className={styles.rn}>01</span>
                <h3>Self-funded</h3>
                <p>All your own money. The cleanest read of whether the scheme itself works.</p>
                <div className={styles.route__mix} aria-hidden="true">
                  <span className={styles.mA} style={{ width: '100%' }} />
                </div>
                <span className={styles.route__cap}>Your equity alone</span>
              </div>
              <div className={styles.route} data-reveal>
                <span className={styles.rn}>02</span>
                <h3>Debt-financed</h3>
                <p>
                  A senior loan sized by loan to cost and loan to GDV caps, with an optional
                  mezzanine top-up.
                </p>
                <div className={styles.route__mix} aria-hidden="true">
                  <span className={styles.mB} style={{ width: '65%' }} />
                  <span className={styles.mA} style={{ width: '35%' }} />
                </div>
                <span className={styles.route__cap}>Senior debt + your equity</span>
              </div>
              <div className={styles.route} data-reveal>
                <span className={styles.rn}>03</span>
                <h3>Joint venture</h3>
                <p>
                  A partner brings cash, land or both, with a preferred return and a promote. Land
                  for equity included.
                </p>
                <div className={styles.route__mix} aria-hidden="true">
                  <span className={styles.mB} style={{ width: '60%' }} />
                  <span className={styles.mA} style={{ width: '40%' }} />
                </div>
                <span className={styles.route__cap}>Partner capital + your equity</span>
              </div>
              <div className={styles.route} data-reveal>
                <span className={styles.rn}>04</span>
                <h3>Off-plan</h3>
                <p>Pre-sales fund the build, the route that leads in Lagos as often as in Leeds.</p>
                <div className={styles.route__mix} aria-hidden="true">
                  <span className={styles.mC} style={{ width: '55%' }} />
                  <span className={styles.mB} style={{ width: '20%' }} />
                  <span className={styles.mA} style={{ width: '25%' }} />
                </div>
                <span className={styles.route__cap}>Pre-sales + debt + equity</span>
              </div>
            </div>
          </div>
        </section>

        {/* GEOGRAPHY: the two markets, from day one */}
        <section className={styles.geoband} aria-label="Built for the United Kingdom and Nigeria">
          <div className={styles.geoband__bg}>
            <Photo src="/images/texture-rebar-crew.jpg" />
          </div>
          <div className={styles.wrap}>
            <div className={styles.geoband__inner} data-reveal>
              <h2>Built for the United Kingdom and Nigeria from day one.</h2>
              <p>
                SDLT, Section 106 and the Community Infrastructure Levy on one side; off-plan-led
                funding and naira reporting on the other. Six currencies, GBP by default.
              </p>
            </div>
          </div>
        </section>

        {/* THE SUITE */}
        <section className={styles.suite} aria-label="One platform">
          <div className={styles.wrap}>
            <div className={styles.suite__grid}>
              <Link href="/pulse" className={styles.scard} data-reveal>
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
              <Link href="/framework" className={styles.scard} data-reveal>
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
              <h2 id="dp-h" data-reveal>Shape the tool you will fund schemes with.</h2>
              <p className={styles.sub}>
                STACK is being shaped with a small group of property developers. If you want the
                appraisal discipline before everyone else has it, talk to us.
              </p>
              <p className={styles.reassure}>
                Prefer email? Reach us directly at <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>.
              </p>
            </div>
            <div data-reveal>
              <DesignPartnerForm sourcePage="stack_page" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter variant="stack" />
    </div>
  );
}

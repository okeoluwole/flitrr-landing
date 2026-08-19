'use client';

import { useEffect, useState } from 'react';
import styles from './StackGlance.module.css';

/**
 * The STACK appraisal at a glance, shared by the STACK landing page and the
 * home products band. The figures are a worked illustration, internally
 * consistent, in the engine's own vocabulary (GO, CONSIDER, NO GO).
 */
export default function StackGlance() {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 250);
    return () => clearTimeout(t);
  }, []);
  // Profit on cost 21.5% against a 20% target, drawn on a 25% scale.
  const fillPct = (21.5 / 25) * 100;
  const tickPct = (20 / 25) * 100;
  return (
    <div className={`${styles.inst} ${styles['live-on']}`} aria-label="A STACK appraisal at a glance">
      <div className={styles.inst__head}>
        <div className={styles.pj}>
          Fenwick Yard, Leeds<small>12 homes &middot; Debt-financed, senior only</small>
        </div>
        <span className={styles.mon}>
          <span className={styles.d} /> Appraised
        </span>
      </div>
      <div className={styles.metric}>
        <div>
          <div className={styles.mk}>Profit on cost</div>
          <div className={styles.mv}>
            <span className="tnum">21.5</span>
            <sup>%</sup>
          </div>
        </div>
        <div className={styles.delta}>1.5 points clear of the target</div>
        <div className={styles.tbar}>
          <span className={styles.fill} style={{ width: filled ? `${fillPct}%` : '0' }} />
          <span className={styles.tick} style={{ left: `${tickPct}%` }} />
          <span className={styles.ticklab} style={{ left: `${tickPct}%` }}>
            Target 20%
          </span>
        </div>
      </div>
      <div className={styles.figs}>
        <div className={styles.fig}>
          <b className="tnum">&pound;4,200,000</b>
          <span>GDV</span>
        </div>
        <div className={styles.fig}>
          <b className="tnum">&pound;3,458,000</b>
          <span>Total cost</span>
        </div>
        <div className={styles.fig}>
          <b className="tnum">&pound;742,000</b>
          <span>Profit</span>
        </div>
      </div>
      <div className={styles.src}>
        <div className={styles.srcbar} aria-hidden="true">
          <span className={styles.senior} style={{ width: '65%' }} />
          <span className={styles.equity} style={{ width: '35%' }} />
        </div>
        <div className={styles.legend}>
          <span>
            Senior debt <b className="tnum">&pound;2,248,000</b>
          </span>
          <span>
            Your equity <b className="tnum">&pound;1,210,000</b>
          </span>
        </div>
      </div>
      <div className={styles.band}>
        <span className={styles.ic}>Verdict</span>
        <span className={styles.tx}>On or above target, with the funding sized.</span>
        <span className={styles.go}>GO</span>
      </div>
      <div className={styles.seal}>
        <span className={styles.sd} />
        Reconciles to zero: uses funded equals uses, value equals redemption plus distributions.
      </div>
    </div>
  );
}

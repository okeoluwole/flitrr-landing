'use client';

import { useEffect, useRef } from 'react';
import styles from './PulseGlance.module.css';

/* ─────────────────────────────────────────
   The homepage PULSE teaser: a single dark
   command view, lit on the ink. This is the front
   card of the deck on /pulse, so the teaser and the
   product page speak one language. Replaces the old
   light/white workspace panel. Floats, tilts to the
   cursor; no WebGL, paints instantly; reduced motion
   holds it still. Seeded with Holloway Place.
───────────────────────────────────────── */

const KPIS = [
  { num: '82', suffix: '%', label: 'On track' },
  { num: '2', label: 'Critical risks', hot: true },
  { num: '2', of: '/8', label: 'Current stage' },
];
const HEALTH = [
  { name: 'Scope' },
  { name: 'Cost', risk: true },
  { name: 'Time' },
  { name: 'Funding' },
];

export default function PulseGlance({ className }) {
  const frameRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frame = frameRef.current;
    if (!frame) return;
    let inView = true;
    let raf = 0;
    const cur = { x: 0, y: 0 };
    const tgt = { x: 0, y: 0 };
    const tick = () => {
      raf = 0;
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      frame.style.transform = `rotateX(${(-cur.y * 4).toFixed(2)}deg) rotateY(${(cur.x * 5.5).toFixed(2)}deg)`;
      if (Math.abs(tgt.x - cur.x) > 0.001 || Math.abs(tgt.y - cur.y) > 0.001) {
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e) => {
      if (!inView) return;
      tgt.x = (e.clientX / window.innerWidth) * 2 - 1;
      tgt.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; }, { threshold: 0 });
    io.observe(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      io.disconnect();
    };
  }, []);

  return (
    <div className={`${className || ''} ${styles.glance}`} aria-hidden="true">
      <span className={styles.bloom} />
      <div ref={frameRef} className={styles.frame}>
        <div className={styles.topbar}>
          <span className={styles.brand}>
            <span className={styles.brandMark} />
            PULSE
          </span>
          <span className={styles.live}>
            <span className={styles.liveDot} />
            Monitoring
          </span>
        </div>

        <div className={styles.header}>
          <div className={styles.projName}>Holloway Place</div>
          <div className={styles.projMeta}>24 homes · Salford · Stage 2 of 8</div>
        </div>

        <div className={styles.kpis}>
          {KPIS.map((k, i) => (
            <div className={styles.kpi} key={i}>
              <div className={`${styles.kpiNum} ${k.hot ? styles.kpiNumHot : ''}`}>
                {k.num}
                {k.suffix && <span className={styles.kpiSuffix}>{k.suffix}</span>}
                {k.of && <span className={styles.kpiOf}>{k.of}</span>}
              </div>
              <div className={styles.kpiLabel}>{k.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.health}>
          <span className={styles.healthLabel}>Objective health</span>
          <div className={styles.healthRow}>
            {HEALTH.map((h, i) => (
              <span className={styles.hpill} key={i}>
                <span className={`${styles.hdot} ${h.risk ? styles.hdotRisk : ''}`} />
                {h.name}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.respondBand}>
          <span className={styles.bandLabel}>Needs your response</span>
          <div className={styles.bandRow}>
            <span className={styles.critDot} />
            <span className={styles.rowText}>
              Confirm the funding conditions with the lender
            </span>
            <span className={styles.respondBtn}>Respond</span>
          </div>
        </div>

        <div className={styles.statusbar}>
          <span className={styles.statusLeft}>
            <span className={styles.statusDot} /> Baseline locked · v1
          </span>
          <span>Updated today</span>
        </div>
      </div>
    </div>
  );
}

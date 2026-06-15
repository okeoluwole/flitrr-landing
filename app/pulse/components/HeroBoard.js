'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './HeroBoard.module.css';

/* ─────────────────────────────────────────
   The PULSE command deck.

   A stack of real module views, rendered as dark
   instruments lit on the ink and arranged in 3D
   depth. The deck revolves on its own, bringing
   each module to the front in turn; it tilts and
   parallaxes to the cursor; and any card can be
   clicked to pull it forward, which pauses the
   rotation and resumes once you leave. The breadth
   of the product, alive, instead of one static
   screen. No WebGL, so it paints instantly.

   Seeded with the Holloway Place sample, the same
   project the rest of the page uses.
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
const RISKS = [
  { hot: true, text: 'Construction costs exceed the fixed budget', meta: 'Serious' },
  { hot: true, text: 'Funding tranche delayed past start', meta: 'Serious' },
  { hot: true, text: 'Planning conditions force a redesign', meta: 'Watch' },
  { hot: false, text: 'Sales slower than the spring forecast', meta: 'Quiet' },
];
const MILES = [
  { name: 'Funding close', x: 2, w: 22 },
  { name: 'Planning approval', x: 18, w: 30 },
  { name: 'Contractor appointed', x: 40, w: 30, crit: true },
  { name: 'Practical completion', x: 64, w: 33 },
];
const TODAY = 46;
const TRACKED = [
  { text: 'Book pre-application planning advice', meta: 'Open' },
  { text: 'Issue the two-stage tender', meta: 'In progress' },
];

const MODULES = [
  { key: 'dashboard', title: 'Dashboard' },
  { key: 'risk', title: 'Risk register' },
  { key: 'programme', title: 'Programme' },
  { key: 'actions', title: 'Action Log' },
];
const N = MODULES.length;
const RADIUS = 380; // carousel radius; the deck is pulled back by this so the front card sits at the screen plane

function Body({ kind }) {
  if (kind === 'risk') {
    return (
      <div className={styles.list}>
        {RISKS.map((r, i) => (
          <div className={styles.rRow} key={i}>
            <span className={`${styles.rDot} ${r.hot ? styles.rDotHot : ''}`} />
            <span className={styles.rText}>{r.text}</span>
            <span className={`${styles.rMeta} ${r.hot ? styles.rMetaHot : ''}`}>{r.meta}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'programme') {
    return (
      <div className={styles.prog}>
        {MILES.map((m, i) => (
          <div className={styles.pRow} key={i}>
            <span className={styles.pName}>{m.name}</span>
            <span className={styles.pTrack}>
              <span
                className={`${styles.pBar} ${m.crit ? styles.pBarCrit : ''}`}
                style={{ left: `${m.x}%`, width: `${m.w}%` }}
              />
              <span className={styles.pToday} style={{ left: `${TODAY}%` }} />
            </span>
          </div>
        ))}
        <div className={styles.pKey}>
          <span className={styles.pKeyItem}><span className={styles.pKeyDot} /> On the baseline</span>
          <span className={styles.pKeyItem}><span className={`${styles.pKeyDot} ${styles.pKeyDotCrit}`} /> Critical path at risk</span>
        </div>
      </div>
    );
  }
  if (kind === 'actions') {
    return (
      <>
        <div className={styles.respondBand}>
          <span className={styles.bandLabel}>Needs your response</span>
          <div className={styles.bandRow}>
            <span className={styles.critDot} />
            <span className={styles.rowText}>Confirm the funding conditions with the lender</span>
            <span className={styles.respondBtn}>Respond</span>
          </div>
        </div>
        <span className={styles.trackedLabel}>Tracked</span>
        <div className={styles.list}>
          {TRACKED.map((a, i) => (
            <div className={styles.rRow} key={i}>
              <span className={styles.rDot} />
              <span className={styles.rText}>{a.text}</span>
              <span className={styles.rMeta}>{a.meta}</span>
            </div>
          ))}
        </div>
      </>
    );
  }
  // dashboard
  return (
    <>
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
          <span className={styles.rowText}>Confirm the funding conditions with the lender</span>
          <span className={styles.respondBtn}>Respond</span>
        </div>
      </div>
    </>
  );
}

export default function HeroBoard({ className }) {
  const [active, setActive] = useState(0);
  const deckRef = useRef(null);
  const pausedRef = useRef(false);
  const inRef = useRef(true);
  const autoRef = useRef(0);
  const resumeRef = useRef(0);

  // Auto-revolve: advance the front card on a timer, unless paused or off-screen.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tick = () => {
      autoRef.current = window.setTimeout(() => {
        // recede the front card into the deck and roll the next up from behind
        if (!pausedRef.current && inRef.current) setActive((a) => (a - 1 + N) % N);
        tick();
      }, 3800);
    };
    tick();
    return () => {
      clearTimeout(autoRef.current);
      clearTimeout(resumeRef.current);
    };
  }, []);

  // Float + cursor parallax on the deck (continuous, idled off-screen).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const deck = deckRef.current;
    if (!deck) return;
    const BASE_Y = -8;
    const BASE_X = 2;
    let raf = 0;
    let t = 0;
    let last = 0;
    let started = false;
    const cur = { x: 0, y: 0 };
    const tgt = { x: 0, y: 0 };
    const loop = (ts) => {
      raf = 0;
      const prev = started ? last : ts;
      started = true;
      last = ts;
      t += Math.min((ts - prev) / 1000, 0.05);
      cur.x += (tgt.x - cur.x) * 0.06;
      cur.y += (tgt.y - cur.y) * 0.06;
      const ry = BASE_Y + Math.sin(t * 0.5) * 1.1 + cur.x * 4.5;
      const rx = BASE_X - cur.y * 2.6;
      const ty = Math.sin(t * 0.62) * 5;
      deck.style.transform = `translateZ(-${RADIUS}px) translateY(${ty.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      if (inRef.current) raf = requestAnimationFrame(loop);
    };
    const onMove = (e) => {
      tgt.x = (e.clientX / window.innerWidth) * 2 - 1;
      tgt.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const io = new IntersectionObserver(
      ([en]) => {
        inRef.current = en.isIntersecting;
        if (en.isIntersecting && !raf) raf = requestAnimationFrame(loop);
      },
      { threshold: 0 }
    );
    io.observe(deck);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      io.disconnect();
    };
  }, []);

  const onEnter = () => {
    pausedRef.current = true;
  };
  const onLeave = () => {
    pausedRef.current = false;
  };
  const onCard = (i) => {
    setActive(i);
    pausedRef.current = true;
    clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  };

  return (
    <div className={`${className || ''} ${styles.scene}`} aria-hidden="true">
      <span className={styles.bloom} />
      <div
        ref={deckRef}
        className={styles.deck}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        {MODULES.map((m, i) => {
          const slot = (i - active + N) % N;
          // Carousel orbit: each card sits on a cylinder (rotateY THEN
          // translateZ), so changing slot interpolates the angle and the card
          // genuinely rolls around the axis instead of sliding. No zIndex:
          // depth sorts by 3D position and transitions smoothly. The deck is
          // pulled back by the radius so the front card sits at the screen plane.
          // Depth of field: only the focused card is sharp + full opacity;
          // the rest recede as dim, blurred background (opacity + blur via CSS
          // vars so :hover can sharpen them). Set on the element so the roll
          // softens the receding card's text instead of clashing with the next.
          const style = {
            transform: `rotateY(${slot * 19}deg) translateZ(${RADIUS + (slot === 0 ? 110 : 0)}px)`,
            '--op': [1, 0.5, 0.3, 0.16][slot] ?? 0.12,
            '--blur': slot === 0 ? '0px' : `${(slot * 2.4).toFixed(1)}px`,
          };
          return (
            <div
              key={m.key}
              className={`${styles.card} ${slot === 0 ? styles.cardFront : ''}`}
              style={style}
              onClick={() => onCard(i)}
            >
              <div className={styles.cardTop}>
                <span className={styles.brand}>
                  <span className={styles.brandMark} />
                  PULSE
                </span>
                <span className={styles.cardModule}>{m.title}</span>
                <span className={styles.live}>
                  <span className={styles.liveDot} />
                  Live
                </span>
              </div>
              <div className={styles.cardBody}>
                <Body kind={m.key} />
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.statusLeft}>
                  <span className={styles.statusDot} /> Holloway Place
                </span>
                <span>Stage 2 · v1</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

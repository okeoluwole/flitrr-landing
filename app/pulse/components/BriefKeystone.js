'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './BriefKeystone.module.css';

/* ─────────────────────────────────────────
   Band 3: the keystone, as a living ritual.

   The Brief writes itself, objective by objective,
   then the cover seals shut over it with BASELINE
   LOCKED, holds, reopens, and loops, so the page is
   never static. Click the document to lock or unlock
   it by hand (which pauses the loop, then it resumes).
   Its own dusk ground sets it apart from the band
   above. Reduced motion / no-JS shows the written,
   locked Brief, still.

   Seeded with Holloway Place.
───────────────────────────────────────── */

const OBJECTIVES = [
  { name: 'Scope', c: 'Non-negotiable', hot: true },
  { name: 'Cost', c: 'Non-negotiable', hot: true },
  { name: 'Time', c: 'Flexible' },
  { name: 'Quality', c: 'Non-negotiable', hot: true },
  { name: 'Funding', c: 'Non-negotiable', hot: true },
];

const DRAFT_MS = 4400;
const SEAL_MS = 3000;

function LockIcon({ size = 11 }) {
  const h = (size / 11) * 12;
  return (
    <svg width={size} height={h} viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <rect x="2.2" y="6.6" width="9.6" height="7.4" rx="1.6" fill="currentColor" />
      <path
        d="M4.2 6.6V4.7a2.8 2.8 0 0 1 5.6 0v1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 16 14" fill="none" aria-hidden="true">
      <circle cx="5.4" cy="4" r="2.5" fill="currentColor" />
      <circle cx="11.4" cy="5" r="2" fill="currentColor" opacity="0.65" />
      <path d="M1 13c0-2.4 2-4.3 4.4-4.3S9.8 10.6 9.8 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10.4 13c0-1.7 1-3.2 2.5-3.9" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.65" />
    </svg>
  );
}

export default function BriefKeystone() {
  const sectionRef = useRef(null);
  const [phase, setPhase] = useState('draft'); // 'draft' | 'sealed'
  const pausedRef = useRef(false);
  const inRef = useRef(false);
  const reduceRef = useRef(false);
  const timers = useRef([]);
  const resumeRef = useRef(null);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const at = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  const loop = () => {
    if (reduceRef.current || !inRef.current || pausedRef.current) return;
    clear();
    setPhase('draft');
    at(() => {
      setPhase('sealed');
      at(loop, SEAL_MS);
    }, DRAFT_MS);
  };
  const stopLoop = () => clear();

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        inRef.current = e.isIntersecting;
        if (e.isIntersecting) {
          if (!pausedRef.current) loop();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
      if (resumeRef.current) clearTimeout(resumeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click to lock / unlock by hand: pause the loop, toggle, resume when idle.
  const toggle = () => {
    if (reduceRef.current) return;
    pausedRef.current = true;
    clear();
    setPhase((p) => (p === 'sealed' ? 'draft' : 'sealed'));
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => {
      pausedRef.current = false;
      loop();
    }, 7000);
  };

  const sealed = phase === 'sealed';

  return (
    <section ref={sectionRef} id="brief" className={styles.section} aria-labelledby="brief-heading">
      <div className={styles.media} aria-hidden="true">
        <Image
          src="/images/texture-site-overview.jpg"
          alt=""
          fill
          sizes="100vw"
          className={styles.mediaImg}
        />
      </div>

      <div className={`container ${styles.inner}`}>
        <div className={styles.layout}>
          <div className={styles.docWrap}>
            <span className={styles.bloom} aria-hidden="true" />
            <div
              className={`${styles.doc} ${sealed ? styles.sealedState : styles.draftState}`}
              onClick={toggle}
              role="button"
              tabIndex={-1}
              aria-hidden="true"
            >
              <div className={styles.content}>
                <div className={styles.docTop}>
                  <span className={styles.kicker}>Project Brief</span>
                  <span className={styles.statusDot} />
                </div>
                <div className={styles.docTitle}>Holloway Place</div>
                <div className={styles.docSub}>24 homes · Salford</div>
                <p className={styles.vision}>
                  A 24-home residential scheme, delivered to a fixed budget with
                  funding closed before construction begins.
                </p>
                <span className={styles.objHead}>Objectives</span>
                <div className={styles.objList}>
                  {OBJECTIVES.map((o, i) => (
                    <div className={styles.objRow} key={i} style={{ '--i': i }}>
                      <span className={styles.objName}>{o.name}</span>
                      <span className={`${styles.cls} ${o.hot ? styles.clsHot : ''}`}>
                        {o.c}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.docFoot}>
                  <span className={styles.footShare}>
                    <ShareIcon />
                    Shared with the team and lender
                  </span>
                </div>
              </div>

              <div className={styles.cover}>
                <span className={styles.coverLock}>
                  <LockIcon size={26} />
                </span>
                <span className={styles.coverLabel}>Baseline locked</span>
                <span className={styles.coverProj}>Holloway Place · v1</span>
              </div>
            </div>
            <span className={styles.hint} aria-hidden="true">
              {sealed ? 'Click to unlock' : 'Click to lock'}
            </span>
          </div>

          <div className={styles.copy} data-reveal>
            <h2 id="brief-heading" className={styles.heading}>
              The brief the whole project answers to.
            </h2>
            <p className={styles.body}>
              PULSE turns your project into a formal Brief, the vision, the
              objectives, what you cannot compromise and what can flex, and
              version-locks it as the baseline every module reads from. From
              there, change is a decision you make on purpose, never a drift you
              find out about later.
            </p>
            <p className={styles.tag}>The discipline to start right.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

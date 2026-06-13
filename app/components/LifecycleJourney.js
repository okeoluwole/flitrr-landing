'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './LifecycleJourney.module.css';

/* ─────────────────────────────────────────
   The lifecycle journey: the interactive
   centrepiece of the vision page.

   The spine (an ordered list of the eight
   stages, names verbatim from the agreed
   copy) IS the content; the photographic
   viewer is decoration synced to it. Scroll
   walks the journey stage by stage: the
   amber line draws down the spine, a gate
   tick lights at each boundary, and the
   viewer crossfades to the active stage.
   Every stage is also a button, so the
   journey can be driven directly by tap,
   click, or keyboard.

   Stage names are locked verbatim. The
   one-line descriptors are drawn from the
   framework's own stage definitions.
───────────────────────────────────────── */

const STAGES = [
  {
    name: 'Land and Site Acquisition',
    desc: 'Secure control of the site and clear title.',
    img: '/images/lifecycle/land.jpg',
  },
  {
    name: 'Project Objectives and Funding',
    desc: 'Define the project, classify its objectives, confirm the funding.',
    img: '/images/lifecycle/signing.jpg',
  },
  {
    name: 'Consultant Appointment',
    desc: 'Assemble and scope the professional team.',
    img: '/images/lifecycle/consultants.jpg',
  },
  {
    name: 'Design and Planning Approvals',
    desc: 'Freeze the design and secure permission to build.',
    img: '/images/lifecycle/drafting.jpg',
  },
  {
    name: 'Contractor Procurement',
    desc: 'Tender, negotiate and execute the contract.',
    img: '/images/lifecycle/crew.jpg',
  },
  {
    name: 'Construction',
    desc: 'Build it, watching cost, time and quality.',
    img: '/images/lifecycle/cranes.jpg',
  },
  {
    name: 'Completion and Handover',
    desc: 'Practical completion, defects and final accounts.',
    img: '/images/lifecycle/handover.jpg',
  },
  {
    name: 'Sales and Disposal',
    desc: 'Realise the value the project was set up to deliver.',
    img: '/images/lifecycle/sales.jpg',
  },
];

export default function LifecycleJourney() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef([]);
  const sceneRef = useRef(null);

  /* Scroll drives the journey: the stage whose list item sits in the
     centre band of the viewport becomes active. Buttons can override
     by scrolling their stage into that band. */
  useEffect(() => {
    const items = itemRefs.current.filter(Boolean);
    if (!items.length || typeof IntersectionObserver === 'undefined') return;

    // On phones the viewer is pinned across the top of the viewport, so
    // the activation band sits below it; on desktop it straddles centre.
    const compact = window.matchMedia('(max-width: 860px)').matches;
    const rootMargin = compact ? '-52% 0px -34% 0px' : '-42% 0px -42% 0px';

    const io = new IntersectionObserver(
      (entries) => {
        let best = null;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        });
        if (best) setActive(Number(best.target.dataset.index));
      },
      { rootMargin, threshold: 0 }
    );

    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jumpTo = (i) => {
    setActive(i);
    const el = itemRefs.current[i];
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      block: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <div className={styles.journey} ref={sceneRef}>
      {/* The photographic viewer: decorative, synced to the spine. It is
          the grid item itself so position: sticky constrains to the full
          journey in both layouts. */}
      <figure className={styles.viewer} aria-hidden="true">
        <span className={styles.viewerStack}>
          {STAGES.map((stage, i) => (
            <Image
              key={stage.name}
              src={stage.img}
              alt=""
              fill
              sizes="(max-width: 860px) 100vw, 54vw"
              className={`${styles.viewerImg} ${
                i === active ? styles.viewerImgActive : ''
              }`}
              priority={i === 0}
            />
          ))}
        </span>
        <span className={styles.viewerGrade} />
        <span key={`n-${active}`} className={`${styles.viewerNum} riseInSm`}>
          {active}
        </span>
        <figcaption
          key={`c-${active}`}
          className={`${styles.viewerLabel} riseInSm`}
        >
          {STAGES[active].name}
        </figcaption>
      </figure>

      {/* The spine: the content. Eight stages, names verbatim. */}
      <ol
        className={styles.spine}
        aria-label="The eight stages of a development project, from land to disposal"
      >
        {STAGES.map((stage, i) => {
          const reached = i <= active;
          return (
            <li
              key={stage.name}
              data-index={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`${styles.stageItem} ${
                reached ? styles.stageReached : ''
              } ${i === active ? styles.stageActive : ''}`}
            >
              <button
                type="button"
                className={styles.stageBtn}
                onClick={() => jumpTo(i)}
                aria-current={i === active ? 'step' : undefined}
              >
                <span className={`${styles.stageNum} tnum`} aria-hidden="true">
                  {i}
                </span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>{stage.name}</span>
                  <span className={styles.stageDesc}>{stage.desc}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

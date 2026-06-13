'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ClassificationScene.module.css';

/* ─────────────────────────────────────────
   The classification moment: the signature
   interactive scene of the PULSE page.

   Five objectives sit on a shelf. Each is a
   toggle: glass (non-negotiable, lit from
   within) or rubber (flexible, matte). Drop
   them and the metaphor plays out: glass
   shatters, rubber flexes and recovers.

   The choreography is deterministic CSS
   keyframes driven by React state, so it
   runs on the compositor, costs nothing on
   phones, and reduced-motion users jump
   straight to the settled states with the
   same information.

   One framework truth is wired in: classify
   all five as glass and the over-constraint
   warning surfaces, exactly as the real
   gate does before money is committed.
───────────────────────────────────────── */

const OBJECTIVES = [
  { key: 'scope', label: 'Scope' },
  { key: 'cost', label: 'Cost' },
  { key: 'time', label: 'Time' },
  { key: 'quality', label: 'Quality' },
  { key: 'funding', label: 'Funding' },
];

/* A believable opening position: the money protected, the rest flexing. */
const SEED = {
  scope: 'rubber',
  cost: 'glass',
  time: 'rubber',
  quality: 'rubber',
  funding: 'glass',
};

/* Sphere artwork. Gradient ids are suffixed per objective so five
   instances can live in one document without id collisions. */
function GlassOrb({ k }) {
  return (
    <svg viewBox="0 0 120 110" className={styles.orbSvg} aria-hidden="true">
      <defs>
        <radialGradient id={`gBody-${k}`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#EDF1F5" stopOpacity="0.36" />
          <stop offset="42%" stopColor="#EDF1F5" stopOpacity="0.1" />
          <stop offset="78%" stopColor="#0B141E" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0B141E" stopOpacity="0.32" />
        </radialGradient>
        <radialGradient id={`gGlow-${k}`} cx="50%" cy="76%" r="56%">
          <stop offset="0%" stopColor="#F4C031" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#F4C031" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#F4C031" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gRim-${k}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EDF1F5" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#EDF1F5" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F4C031" stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="55" r="44" fill={`url(#gBody-${k})`} />
      <circle cx="60" cy="55" r="44" fill={`url(#gGlow-${k})`} />
      <circle
        cx="60"
        cy="55"
        r="43.25"
        fill="none"
        stroke={`url(#gRim-${k})`}
        strokeWidth="1.5"
      />
      <ellipse
        cx="45"
        cy="36"
        rx="13"
        ry="7"
        fill="#EDF1F5"
        opacity="0.55"
        transform="rotate(-28 45 36)"
      />
      <ellipse cx="62" cy="86" rx="15" ry="4.5" fill="#F4C031" opacity="0.4" />
    </svg>
  );
}

function RubberOrb({ k }) {
  return (
    <svg viewBox="0 0 120 110" className={styles.orbSvg} aria-hidden="true">
      <defs>
        <radialGradient id={`rBody-${k}`} cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#4A7196" />
          <stop offset="55%" stopColor="#2C4A66" />
          <stop offset="100%" stopColor="#16273A" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="55" r="44" fill={`url(#rBody-${k})`} />
      <ellipse
        cx="46"
        cy="37"
        rx="14"
        ry="7.5"
        fill="#EDF1F5"
        opacity="0.14"
        transform="rotate(-26 46 37)"
      />
    </svg>
  );
}

/* The shatter: shards scatter and fade, a small pile remains. Each
   shard carries its own flight vector as CSS custom properties. */
const SHARDS = [
  { d: 'M60 28 L74 44 L56 50 Z', x: -34, y: -30, r: -118 },
  { d: 'M78 38 L92 58 L72 60 Z', x: 40, y: -22, r: 95 },
  { d: 'M44 40 L58 56 L38 60 Z', x: -46, y: -6, r: -70 },
  { d: 'M70 62 L88 74 L64 80 Z', x: 48, y: 10, r: 60 },
  { d: 'M40 64 L56 72 L36 84 Z', x: -38, y: 16, r: 80 },
  { d: 'M58 74 L72 84 L52 92 Z', x: 16, y: 26, r: -50 },
  { d: 'M52 52 L66 58 L54 70 Z', x: 6, y: -38, r: 140 },
];

function ShatterLayer({ k }) {
  return (
    <span className={styles.shatter} aria-hidden="true">
      <svg viewBox="0 0 120 110" className={styles.shardsSvg}>
        <defs>
          <linearGradient id={`shard-${k}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EDF1F5" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F4C031" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {SHARDS.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={`url(#shard-${k})`}
            strokeWidth="1.5"
            strokeLinejoin="round"
            className={styles.shard}
            style={{
              '--sx': `${s.x}px`,
              '--sy': `${s.y}px`,
              '--sr': `${s.r}deg`,
            }}
          />
        ))}
      </svg>
      <svg viewBox="0 0 120 24" className={styles.pileSvg}>
        <path
          d="M34 20 L44 10 L52 20 Z M50 20 L60 7 L70 20 Z M68 20 L77 12 L86 20 Z"
          fill="rgba(237, 241, 245, 0.28)"
          stroke="rgba(244, 192, 49, 0.5)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.glint} />
    </span>
  );
}

export default function ClassificationScene() {
  const [classes, setClasses] = useState(SEED);
  const [phase, setPhase] = useState('shelf'); // shelf | dropping | settled
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onShelf = phase === 'shelf';
  const glassCount = OBJECTIVES.filter((o) => classes[o.key] === 'glass').length;
  const rubberCount = OBJECTIVES.length - glassCount;
  const allGlass = glassCount === OBJECTIVES.length;

  const toggle = (key) => {
    if (!onShelf) return;
    setClasses((prev) => ({
      ...prev,
      [key]: prev[key] === 'glass' ? 'rubber' : 'glass',
    }));
  };

  const reduceMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const drop = () => {
    if (phase === 'dropping') return;
    if (phase === 'settled') {
      setPhase('shelf');
      return;
    }
    if (reduceMotion()) {
      setPhase('settled');
      return;
    }
    setPhase('dropping');
    timerRef.current = setTimeout(() => setPhase('settled'), 1700);
  };

  const stateWord = (material) => {
    if (phase === 'settled') {
      return material === 'glass' ? 'Shattered' : 'Recovered';
    }
    return material === 'glass' ? 'Glass' : 'Rubber';
  };

  let status;
  if (phase === 'shelf') {
    status = 'Tap an objective to switch it between glass and rubber.';
  } else if (phase === 'dropping') {
    status = 'Reality arrives.';
  } else if (glassCount === 0) {
    status =
      'Everything recovered. Flexibility is what protects the objectives that cannot move.';
  } else if (allGlass) {
    status =
      'All five shattered. With nothing flexible, there was nothing to absorb the hit.';
  } else {
    status = `${glassCount} of 5 shattered. ${rubberCount} recovered. The drop is why you decide before the project starts.`;
  }

  return (
    <div className={styles.scene} data-phase={phase}>
      <div
        className={styles.shelfRow}
        role="group"
        aria-label="Classify the five objectives as glass or rubber"
      >
        {OBJECTIVES.map((obj) => {
          const material = classes[obj.key];
          return (
            <button
              key={obj.key}
              type="button"
              className={styles.objBtn}
              data-material={material}
              data-phase={phase}
              aria-pressed={material === 'glass'}
              onClick={() => toggle(obj.key)}
              disabled={!onShelf}
            >
              <span className={styles.orbArea} aria-hidden="true">
                <span key={phase} className={styles.orbMotion}>
                  <span className={styles.orb}>
                    {material === 'glass' ? (
                      <GlassOrb k={obj.key} />
                    ) : (
                      <RubberOrb k={obj.key} />
                    )}
                  </span>
                </span>
                {material === 'glass' && <ShatterLayer k={obj.key} />}
                <span className={styles.groundShadow} />
              </span>
              <span className={styles.objName}>{obj.label}</span>
              <span className={styles.objState}>{stateWord(material)}</span>
            </button>
          );
        })}
        <span className={styles.floorLine} aria-hidden="true" />
      </div>

      {allGlass && onShelf && (
        <p className={`${styles.overWarn} riseInSm`}>
          All five are non-negotiable. The framework calls that
          over-constrained, and flags it at the first gate before money
          follows.
        </p>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.dropBtn}
          onClick={drop}
          disabled={phase === 'dropping'}
        >
          {phase === 'settled' ? 'Put them back' : 'Drop them'}
        </button>
        <p className={styles.status} aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}

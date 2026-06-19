import styles from './HowItWorks.module.css';

/* ─────────────────────────────────────────
   Band 2: how PULSE works, as a calm three-beat
   flow strung on the amber pulse line. Each beat
   is a small, still dark instrument (deliberately
   not the rolling hero deck). Set it up once, it
   flags what matters, you respond in one place.

   Static and server-rendered; the only motion is
   the pulse travelling the line (CSS, reduced-
   motion safe). Seeded with Holloway Place.
───────────────────────────────────────── */

const STEPS = [
  {
    n: '1',
    title: 'Set it up once',
    body: 'A nine-step guided start turns your project into a formal Brief, version-locked as the baseline every module reads from.',
    kind: 'brief',
  },
  {
    n: '2',
    title: 'It flags what matters',
    body: 'PULSE watches your objectives, risks and milestones, and raises the ones that threaten what you said you cannot compromise.',
    kind: 'flag',
  },
  {
    n: '3',
    title: 'You respond in one place',
    body: 'Everything that needs a decision, from every module, lands in the Action Log, sorted by what you protected.',
    kind: 'respond',
  },
];

function Fragment({ kind }) {
  if (kind === 'brief') {
    return (
      <div className={styles.frag} aria-hidden="true">
        <div className={styles.fragHead}>
          <span className={styles.fragTitle}>Holloway Place</span>
          <span className={styles.seal}>Baseline locked · v1</span>
        </div>
        <div className={styles.objRow}>
          <span className={styles.objName}>Scope</span>
          <span className={`${styles.pill} ${styles.pillHot}`}>Non-negotiable</span>
        </div>
        <div className={styles.objRow}>
          <span className={styles.objName}>Cost</span>
          <span className={`${styles.pill} ${styles.pillHot}`}>Non-negotiable</span>
        </div>
        <div className={styles.objRow}>
          <span className={styles.objName}>Time</span>
          <span className={styles.pill}>Flexible</span>
        </div>
      </div>
    );
  }
  if (kind === 'flag') {
    return (
      <div className={styles.frag} aria-hidden="true">
        <span className={styles.fragLabel}>Watching 4 risks</span>
        <div className={styles.flagRow}>
          <span className={`${styles.dot} ${styles.dotHot}`} />
          <span className={styles.flagText}>Construction costs exceed the fixed budget</span>
          <span className={styles.flagMetaHot}>Critical</span>
        </div>
        <div className={`${styles.flagRow} ${styles.flagRowMuted}`}>
          <span className={styles.dot} />
          <span className={styles.flagText}>Sales slower than the spring forecast</span>
          <span className={styles.flagMeta}>Quiet</span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.frag} aria-hidden="true">
      <div className={styles.respondBand}>
        <span className={styles.bandLabel}>Needs your response</span>
        <div className={styles.bandRow}>
          <span className={`${styles.dot} ${styles.dotHot}`} />
          <span className={styles.flagText}>Confirm the funding conditions with the lender</span>
          <span className={styles.respondBtn}>Respond</span>
        </div>
      </div>
      <span className={styles.digestNote}>Your critical actions reach your inbox weekly.</span>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="product" className={styles.section} aria-labelledby="how-heading">
      <div className="container">
        <h2 id="how-heading" className={styles.heading} data-reveal>
          Set it up once. PULSE watches the rest.
        </h2>
        <p className={styles.lead} data-reveal>
          A guided start, then a system that keeps what matters in front of you,
          from the first decision to the last.
        </p>

        <ol className={styles.flow}>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.pulse} />
          </span>
          {STEPS.map((s, i) => (
            <li
              className={styles.step}
              data-reveal
              key={s.n}
              style={{ '--d': `${(i * 1.55).toFixed(2)}s` }}
            >
              <span className={styles.node} aria-hidden="true" />
              <Fragment kind={s.kind} />
              <div className={styles.stepText}>
                <span className={styles.stepNum}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepBody}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

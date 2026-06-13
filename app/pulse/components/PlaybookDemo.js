'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PlaybookDemo.module.css';

/* ─────────────────────────────────────────
   The playbook, demonstrated: three stage-
   keyed proposals the reader can actually
   accept or dismiss, the way the product
   works. Accepting drops the item into a
   miniature Action Log below the card, so
   "accept with a tap" is felt, not claimed.

   Proposals are illustrative and drawn from
   the framework's own stage and gate logic.
───────────────────────────────────────── */

const PROPOSALS = [
  {
    stage: 'Stage 2. Consultant Appointment',
    kind: 'Proposed action',
    critical: true,
    text: 'Scope every consultant appointment against the locked Brief before fees are agreed.',
    why: 'Appointments that drift from the Brief are how cost drift starts.',
  },
  {
    stage: 'Stage 3. Design and Planning Approvals',
    kind: 'Proposed risk',
    critical: false,
    text: 'Planning conditions arrive late and force a redesign.',
    why: 'A late condition can move a frozen design and the programme behind it.',
  },
  {
    stage: 'Stage 4. Contractor Procurement',
    kind: 'Proposed action',
    critical: true,
    text: 'Confirm the contract sum sits inside the cost objective before signature.',
    why: 'A signed sum outside tolerance breaks the baseline on day one.',
  },
];

const LEAVE_MS = 340;

export default function PlaybookDemo() {
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState([]);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [leaving, setLeaving] = useState(null); // null | 'accept' | 'dismiss'
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const done = index >= PROPOSALS.length;
  const current = done ? null : PROPOSALS[index];
  const next = index + 1 < PROPOSALS.length ? PROPOSALS[index + 1] : null;

  const decide = (choice) => {
    if (leaving || done) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const commit = () => {
      if (choice === 'accept') {
        setAccepted((prev) => [...prev, PROPOSALS[index]]);
      } else {
        setDismissedCount((n) => n + 1);
      }
      setIndex((i) => i + 1);
      setLeaving(null);
    };

    if (reduce) {
      commit();
      return;
    }
    setLeaving(choice);
    timerRef.current = setTimeout(commit, LEAVE_MS);
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setIndex(0);
    setAccepted([]);
    setDismissedCount(0);
    setLeaving(null);
  };

  return (
    <div className={styles.demo}>
      <div className={styles.stack}>
        {next && !leaving && <div className={styles.cardBehind} aria-hidden="true" />}

        {current && (
          <article
            key={current.text}
            className={`${styles.card} ${
              leaving === 'accept' ? styles.cardAccept : ''
            } ${leaving === 'dismiss' ? styles.cardDismiss : ''}`}
          >
            <div className={styles.cardMeta}>
              <span className={`${styles.stageChip} tnum`}>{current.stage}</span>
              <span
                className={`${styles.kindChip} ${
                  current.critical ? styles.kindChipCritical : ''
                }`}
              >
                {current.critical ? 'Critical' : 'Standard'}
              </span>
            </div>
            <p className={styles.cardKind}>{current.kind}</p>
            <p className={styles.cardText}>{current.text}</p>
            <p className={styles.cardWhy}>{current.why}</p>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.acceptBtn}
                onClick={() => decide('accept')}
                disabled={Boolean(leaving)}
              >
                Accept
              </button>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => decide('dismiss')}
                disabled={Boolean(leaving)}
              >
                Dismiss
              </button>
            </div>
          </article>
        )}

        {done && (
          <div className={`${styles.donePanel} riseInSm`}>
            <p className={styles.doneLine}>
              Three proposals, three decisions, your call each time.
            </p>
            <button type="button" className={styles.resetBtn} onClick={reset}>
              Show them again
            </button>
          </div>
        )}
      </div>

      <div className={styles.log} aria-live="polite">
        <p className={styles.logHeading}>
          Accepted into the Action Log
          {dismissedCount > 0 && (
            <span className={styles.logDismissed}>
              {' '}
              · {dismissedCount} dismissed
            </span>
          )}
        </p>
        {accepted.length === 0 ? (
          <p className={styles.logEmpty}>Nothing yet. The call is yours.</p>
        ) : (
          <ul className={styles.logList}>
            {accepted.map((item) => (
              <li key={item.text} className={`${styles.logRow} riseInSm`}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                  className={styles.logTick}
                >
                  <path
                    d="M2.5 7.5l3 3 6-6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className={styles.logText}>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

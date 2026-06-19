import { SUITE_NUDGES } from './suiteNudges';
import styles from './SuiteNudge.module.css';

/**
 * SuiteNudge, a dormant pointer to a sibling Flitrr product (PULSE Framework
 * Section 10). It sits at the initiation field where that sibling does the
 * deeper job, ROUTE at the procurement route, STACK at the financial baseline,
 * and offers a light invitation to it.
 *
 * Two gates hold it in check, and both are deliberately closed today:
 *
 *   1. No overclaim. It renders only for a sibling that is actually live. That
 *      is the `available` flag in suiteNudges, false until the product ships,
 *      so the nudge is silent now.
 *   2. App-tier only. It is for developers on a single-app subscription, who do
 *      not yet have the sibling. A developer running under the Orchestrator
 *      already has the whole suite, so the nudge would be noise. Today there is
 *      no Orchestrator, so every developer is App-tier and `tier` defaults to
 *      'app'; the gate is wired now so it holds the day an orchestrated run
 *      exists.
 *
 * It is presentational and silent by default: with no live sibling it returns
 * null and adds nothing to the field. When a sibling ships, set its `available`
 * and `href` in suiteNudges and the nudge appears here with no change to this
 * component or the step.
 */
export default function SuiteNudge({ product, tier = 'app' }) {
  const cfg = SUITE_NUDGES[product];

  // Gate 1, no overclaim: nothing to point to until the sibling is live.
  if (!cfg || !cfg.available) return null;

  // Gate 2, App-tier only: an orchestrated run already has the sibling.
  if (tier !== 'app') return null;

  return (
    <div className={styles.nudge} role="note">
      <span className={styles.mark} aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path
            d="M5 8h6m0 0L8.5 5.5M11 8l-2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </span>
      <div className={styles.body}>
        <p className={styles.text}>
          <span className={styles.tag}>{cfg.name}</span>
          {cfg.blurb}
        </p>
        {cfg.href && (
          <a
            className={styles.link}
            href={cfg.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cfg.cta}
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M4 10l6-6M5 4h5v5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

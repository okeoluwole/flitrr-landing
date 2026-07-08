'use client';

import { useState } from 'react';
import { runAppraisal } from './actions';
import { resolveCurrencySymbol } from '../../lib/stack/engine/inputs.js';
import styles from './stack.module.css';

/**
 * The STACK tool (sub-step 2.1, the spine). For now it runs the base case
 * through the server action and shows the headline, proving the end-to-end path:
 * the form here is a client component, the engine runs server-side in the
 * action, and only the result crosses back. The guided input form and the full
 * read-only outputs are the next sub-steps.
 */

// Map a decision to its surface class, so the verdict reads at a glance.
const DECISION_CLASS = {
  GO: styles['decision--go'],
  CONSIDER: styles['decision--consider'],
  'NO GO': styles['decision--nogo'],
};

function formatMoney(value, currency) {
  const symbol = resolveCurrencySymbol(currency);
  return `${symbol}${Math.round(value).toLocaleString('en-GB')}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function StackTool() {
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setBusy(true);
    setError(null);
    const response = await runAppraisal({});
    setBusy(false);
    if (response.ok) {
      setResult(response.result);
      setMeta(response.meta);
    } else {
      setError(response.error);
    }
  }

  const currency = meta?.currency ?? 'GBP';

  return (
    <div className={styles.tool}>
      <button type="button" className={styles.runButton} onClick={run} disabled={busy}>
        {busy ? 'Working...' : 'Run the base case'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <section className={styles.headline} aria-live="polite">
          <span className={`${styles.decision} ${DECISION_CLASS[result.decision.decision]}`}>
            {result.decision.decision}
          </span>

          <div className={styles.figures}>
            <div className={styles.figure}>
              <span className={styles.figureLabel}>Project profit</span>
              <span className={`${styles.figureValue} tnum`}>
                {formatMoney(result.returns.projectProfit, currency)}
              </span>
            </div>
            <div className={styles.figure}>
              <span className={styles.figureLabel}>Profit on cost</span>
              <span className={`${styles.figureValue} tnum`}>
                {formatPercent(result.returns.profitOnCost)}
              </span>
            </div>
          </div>

          <p className={styles.verdict}>{result.verdict}</p>
        </section>
      )}
    </div>
  );
}

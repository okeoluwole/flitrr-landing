'use client';

import { useState } from 'react';
import { runAppraisal } from './actions';
import { baseCaseInputs, resolveCurrencySymbol } from '../../lib/stack/engine/inputs.js';
import { toDisplayValues, toEngineInputs, applyGuards, validate } from './formModel';
import StackForm from './StackForm';
import StackSummary from './StackSummary';
import StackCashflow from './StackCashflow';
import StackComparison from './StackComparison';
import StackSensitivity from './StackSensitivity';
import styles from './stack.module.css';

/**
 * The STACK tool (sub-step 2.3). Holds the form's display values, validates and
 * guards them, runs the appraisal through the server action, and renders the
 * read-only appraisal summary.
 */

export default function StackTool() {
  const [values, setValues] = useState(() => toDisplayValues(baseCaseInputs()));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const currencySymbol = resolveCurrencySymbol(values.reportingCurrency || 'GBP');

  function handleChange(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setError(null);
    const engineInputs = toEngineInputs(applyGuards(values));
    const response = await runAppraisal(engineInputs);
    setBusy(false);

    if (response.ok) {
      setResult(response.result);
      setMeta(response.meta);
    } else {
      setError(response.error);
    }
  }

  return (
    <div className={styles.tool}>
      <StackForm
        values={values}
        errors={errors}
        currencySymbol={currencySymbol}
        onChange={handleChange}
        onSubmit={handleSubmit}
        busy={busy}
      />

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.results}>
          <StackSummary result={result} meta={meta} />
          <StackCashflow result={result} meta={meta} />
          <StackComparison result={result} meta={meta} />
          <StackSensitivity result={result} meta={meta} />
        </div>
      )}
    </div>
  );
}

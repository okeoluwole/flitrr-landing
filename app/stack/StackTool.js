'use client';

import { useState } from 'react';
import { runAppraisal, saveScheme, openScheme, removeScheme } from './actions';
import { baseCaseInputs, resolveCurrencySymbol } from '../../lib/stack/engine/inputs.js';
import { toDisplayValues, toEngineInputs, applyGuards, validate } from './formModel';
import StackSchemes from './StackSchemes';
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
 *
 * Saved schemes (Bucket 3.2): the tool also owns the organisation's scheme
 * list. Saving stores the current inputs under a name; loading puts a stored
 * input set back into the form and recomputes it under the current engine. The
 * server actions and row level security decide what the viewer may write;
 * canEdit only makes the surface match that.
 *
 * Props:
 *   initialSchemes  the organisation's saved schemes, from the server render
 *   canEdit         whether the viewer is an organisation admin (may save and
 *                   delete); a member gets the list and load only
 *   adminContact    the contact line for the View only badge, member only
 */

export default function StackTool({
  initialSchemes = [],
  canEdit = false,
  adminContact = null,
}) {
  const [values, setValues] = useState(() => toDisplayValues(baseCaseInputs()));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [schemes, setSchemes] = useState(initialSchemes);
  const [activeScheme, setActiveScheme] = useState(null);
  const [engineNote, setEngineNote] = useState(null);
  const [schemeBusy, setSchemeBusy] = useState(false);
  const [schemeNotice, setSchemeNotice] = useState(null);
  const [schemeError, setSchemeError] = useState(null);

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

  // Save the current form values as a scheme: a new one, or over the loaded
  // one. The same validation as a run applies, so what is stored always
  // computes.
  async function handleSaveScheme(name, mode) {
    setSchemeNotice(null);
    setSchemeError(null);

    if (typeof name !== 'string' || name.trim() === '') {
      setSchemeError('Enter a scheme name.');
      return;
    }

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSchemeError('Fix the highlighted fields before saving.');
      return;
    }

    setSchemeBusy(true);
    const raw = toEngineInputs(applyGuards(values));
    const response = await saveScheme({
      name,
      raw,
      schemeId: mode === 'over' ? activeScheme?.id ?? null : null,
    });
    setSchemeBusy(false);

    if (response.ok) {
      setSchemes(response.schemes);
      setActiveScheme(response.scheme);
      // The stored stamp is now the current engine, so any stale note clears.
      setEngineNote(null);
      setSchemeNotice(`Saved "${response.scheme.name}".`);
    } else {
      setSchemeError(response.error);
    }
  }

  // Load a scheme back: the stored inputs into the form, and the recomputed
  // result straight onto the report.
  async function handleLoadScheme(id) {
    setSchemeNotice(null);
    setSchemeError(null);
    setSchemeBusy(true);
    const response = await openScheme(id);
    setSchemeBusy(false);

    if (response.ok) {
      setValues(toDisplayValues(response.inputs));
      setErrors({});
      setError(null);
      setResult(response.result);
      setMeta(response.meta);
      setActiveScheme(response.scheme);
      setEngineNote(response.engineNote);
      setSchemeNotice(`Loaded "${response.scheme.name}".`);
    } else {
      setSchemeError(response.error);
    }
  }

  async function handleDeleteScheme(id) {
    setSchemeNotice(null);
    setSchemeError(null);
    setSchemeBusy(true);
    const response = await removeScheme(id);
    setSchemeBusy(false);

    if (response.ok) {
      setSchemes(response.schemes);
      if (activeScheme?.id === id) {
        setActiveScheme(null);
        setEngineNote(null);
      }
      setSchemeNotice('Scheme deleted.');
    } else {
      setSchemeError(response.error);
    }
  }

  // Export via the browser's print-to-PDF, the same path the PULSE brief uses.
  // The print stylesheet hides the form and the app chrome and lays out the
  // report only. The engine is never in the download; the figures are static.
  function handleDownloadPdf() {
    if (typeof window === 'undefined') return;
    const label = `Flitrr STACK, ${meta?.strategy ?? ''} appraisal`.trim();
    const previous = document.title;
    document.title = label;
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.tool}>
      <StackSchemes
        schemes={schemes}
        activeScheme={activeScheme}
        canEdit={canEdit}
        adminContact={adminContact}
        busy={schemeBusy}
        notice={schemeNotice}
        error={schemeError}
        engineNote={engineNote}
        onSave={handleSaveScheme}
        onLoad={handleLoadScheme}
        onDelete={handleDeleteScheme}
      />

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
          <div className={styles.reportHead}>
            <div className={styles.printBanner} aria-hidden="true">
              <span className={styles.printBrand}>Flitrr STACK</span>
              <span className={styles.printReportTitle}>Development appraisal and funding report</span>
              <span className={styles.printMeta}>
                {meta.strategy} scheme, generated {generatedDate}
              </span>
            </div>
            <button type="button" className={styles.downloadBtn} onClick={handleDownloadPdf}>
              Download PDF report
            </button>
          </div>

          <StackSummary result={result} meta={meta} />
          <StackCashflow result={result} meta={meta} />
          <StackComparison result={result} meta={meta} />
          <StackSensitivity result={result} meta={meta} />

          <p className={styles.printStamp} aria-hidden="true">
            Generated by Flitrr STACK on {generatedDate}. This report is licensed for this appraisal
            only and is not to be reused as a live model. Illustrative figures for design purposes,
            not investment, financial or valuation advice.
          </p>
        </div>
      )}
    </div>
  );
}

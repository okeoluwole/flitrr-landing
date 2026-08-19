'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { runAppraisal, saveScheme, exportWorkbook } from './actions';
import { baseCaseInputs, resolveCurrencySymbol } from '../../../lib/stack/engine/inputs.js';
import { toDisplayValues, toEngineInputs, applyGuards, validate } from './formModel';
import StackSavePanel from './StackSavePanel';
import StackForm from './StackForm';
import StackSummary from './StackSummary';
import StackCashflow from './StackCashflow';
import StackComparison from './StackComparison';
import StackSensitivity from './StackSensitivity';
import styles from './stack.module.css';

/**
 * The STACK appraisal tool (sub-step 2.3, re-homed under /stack/app/appraisal
 * in the two-product arc). Holds the form's display values, validates and
 * guards them, runs the appraisal through the server action, and renders the
 * read-only report.
 *
 * Schemes: the register lives on STACK's home; this tool receives at most
 * ONE scheme, loaded by the page from ?scheme= (inputs recomputed under the
 * current engine on the server). An admin saves from here: the current
 * inputs under a name, new or over the loaded scheme, optionally linked to
 * the project it appraises (039). The server actions and row level security
 * decide what the viewer may write; canEdit only makes the surface match
 * that.
 *
 * Props:
 *   canEdit             whether the viewer is an organisation admin (may
 *                       save); a member runs and reads only
 *   projects            the organisation's active projects, for the scheme
 *                       project link
 *   initialScheme       { scheme, inputs, result, meta, engineNote } when
 *                       the page loaded one, or null for a fresh appraisal
 *   initialSchemeError  the plain sentence when a named scheme could not be
 *                       loaded (the tool opens fresh with it stated)
 */

export default function StackTool({
  canEdit = false,
  projects = [],
  initialScheme = null,
  initialSchemeError = null,
}) {
  const router = useRouter();

  const [values, setValues] = useState(() =>
    toDisplayValues(initialScheme?.inputs ?? baseCaseInputs())
  );
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(initialScheme?.result ?? null);
  const [meta, setMeta] = useState(initialScheme?.meta ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [activeScheme, setActiveScheme] = useState(initialScheme?.scheme ?? null);
  const [engineNote, setEngineNote] = useState(initialScheme?.engineNote ?? null);
  const [schemeBusy, setSchemeBusy] = useState(false);
  const [schemeNotice, setSchemeNotice] = useState(null);
  const [schemeError, setSchemeError] = useState(initialSchemeError);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

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
  // computes. projectId is the optional spine link ('' saves unlinked).
  async function handleSaveScheme(name, mode, projectId = '') {
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
      projectId: projectId || null,
    });
    setSchemeBusy(false);

    if (response.ok) {
      const wasActive = activeScheme?.id;
      setActiveScheme(response.scheme);
      // The stored stamp is now the current engine, so any stale note clears.
      setEngineNote(null);
      setSchemeNotice(`Saved "${response.scheme.name}".`);
      // Keep the address truthful: a save that produced a NEW scheme means
      // the page now shows that scheme, so a reload or a share lands on it.
      if (response.scheme.id !== wasActive) {
        router.replace(`/stack/app/appraisal?scheme=${response.scheme.id}`, {
          scroll: false,
        });
      }
    } else {
      setSchemeError(response.error);
    }
  }

  // Export via the browser's print-to-PDF, the same path the PULSE brief uses.
  // The print stylesheet hides the form and the app chrome and lays out the
  // report only. The engine is never in the download; the figures are static.
  // Export the displayed appraisal as a values-only Excel workbook. The server
  // action recomputes from the inputs that produced the on-screen result
  // (meta.inputs), so the download always matches what is showing, even when
  // the form has moved on since the run. Figures only; the engine is never in
  // the file.
  async function handleDownloadExcel() {
    if (!meta) return;
    setExportError(null);
    setExportBusy(true);
    const response = await exportWorkbook({
      raw: meta.inputs,
      schemeName: activeScheme?.name ?? null,
    });
    setExportBusy(false);

    if (!response.ok) {
      setExportError(response.error);
      return;
    }

    const binary = atob(response.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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
      {canEdit && (
        <StackSavePanel
          activeScheme={activeScheme}
          projects={projects}
          busy={schemeBusy}
          notice={schemeNotice}
          onSave={handleSaveScheme}
        />
      )}

      {schemeError && <p className={styles.error} role="alert">{schemeError}</p>}
      {engineNote && <p className={styles.notice}>{engineNote}</p>}

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
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownloadExcel}
              disabled={exportBusy}
            >
              {exportBusy ? 'Preparing Excel' : 'Download Excel (values only)'}
            </button>
            <button type="button" className={styles.downloadBtn} onClick={handleDownloadPdf}>
              Download PDF report
            </button>
          </div>

          {exportError && <p className={styles.error}>{exportError}</p>}

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

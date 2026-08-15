'use client';

import { SECTIONS } from './formModel';
import styles from './stack.module.css';

/**
 * The guided input form (sub-step 2.2). Renders from the form model: sections
 * and fields appear by the funding strategy, each field carries its guidance,
 * selections are forced through dropdowns, and amounts and percentages read in
 * plain units. A controlled component: it holds no state, it renders `values`
 * and reports changes up.
 */

const isFieldVisible = (field, values) => !field.show || field.show(values);
const isSectionVisible = (section, values) => !section.show || section.show(values);

function unitFor(kind, currencySymbol) {
  if (kind === 'money') return { pre: currencySymbol };
  if (kind === 'percent') return { post: '%' };
  if (kind === 'multiple') return { post: 'x' };
  if (kind === 'months') return { post: 'mo' };
  return {};
}

function Field({ field, value, error, currencySymbol, onChange }) {
  const id = `stack-${field.key}`;
  const guideId = `${id}-guide`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${guideId} ${errorId}` : guideId;
  const unit = unitFor(field.kind, currencySymbol);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {field.label}
      </label>

      <div className={styles.inputWrap}>
        {unit.pre && <span className={styles.unitPre}>{unit.pre}</span>}

        {field.kind === 'select' ? (
          <select
            id={id}
            className={styles.select}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            aria-describedby={describedBy}
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.kind === 'date' ? (
          <input
            id={id}
            type="date"
            className={styles.input}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            aria-describedby={describedBy}
          />
        ) : (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="any"
            className={`${styles.input} ${unit.pre ? styles.inputPad : ''}`}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={error ? 'true' : undefined}
          />
        )}

        {unit.post && <span className={styles.unitPost}>{unit.post}</span>}
      </div>

      <p id={guideId} className={styles.guide}>
        {field.guide}
      </p>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ section, values, errors, currencySymbol, onChange }) {
  const fields = section.fields.filter((field) => isFieldVisible(field, values));
  if (fields.length === 0) return null;
  return (
    <fieldset className={styles.section}>
      {section.title && <legend className={styles.sectionTitle}>{section.title}</legend>}
      {section.blurb && <p className={styles.sectionBlurb}>{section.blurb}</p>}
      <div className={styles.grid}>
        {fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={values[field.key]}
            error={errors[field.key]}
            currencySymbol={currencySymbol}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

export default function StackForm({ values, errors, currencySymbol, onChange, onSubmit, busy }) {
  const core = SECTIONS.filter((s) => !s.advanced && isSectionVisible(s, values));
  const advanced = SECTIONS.filter((s) => s.advanced && isSectionVisible(s, values));

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {core.map((section) => (
        <Section
          key={section.id}
          section={section}
          values={values}
          errors={errors}
          currencySymbol={currencySymbol}
          onChange={onChange}
        />
      ))}

      <details className={styles.advanced}>
        <summary className={styles.advancedSummary}>More options</summary>
        <div className={styles.advancedBody}>
          {advanced.map((section) => (
            <Section
              key={section.id}
              section={section}
              values={values}
              errors={errors}
              currencySymbol={currencySymbol}
              onChange={onChange}
            />
          ))}
        </div>
      </details>

      <div className={styles.actions}>
        <button type="submit" className={styles.runButton} disabled={busy}>
          {busy ? 'Working...' : 'Appraise the scheme'}
        </button>
      </div>
    </form>
  );
}

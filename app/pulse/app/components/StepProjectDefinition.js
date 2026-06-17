import styles from './InitiationWizard.module.css';

/**
 * Step 1, Project Definition. The facts the rest of the project is built
 * on (framework Section 7). A controlled, presentational form: it owns no
 * state. `values` holds the current field values and `onChange(field,
 * value)` reports edits up to the wizard shell, which handles saving.
 *
 * Only `name` is required (the wizard enforces this before advancing).
 * Every other field is optional at entry; completeness is checked later
 * at Gate 1 to 2, not here.
 */

// procurement_route enum values, paired with readable labels. The empty
// option maps to null on save (see the wizard's clean() helper).
const PROCUREMENT_OPTIONS = [
  { value: 'design_bid_build', label: 'Design-Bid-Build' },
  { value: 'design_build', label: 'Design-Build' },
  { value: 'construction_management', label: 'Construction Management' },
  { value: 'management_contracting', label: 'Management Contracting' },
  { value: 'other', label: 'Other' },
];

// project_currency enum values, paired with a symbol-bearing label. The
// brief denominates every money figure in the chosen currency.
const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'NGN', label: 'Naira (₦)' },
  { value: 'USD', label: 'USD ($)' },
];

export default function StepProjectDefinition({ values, onChange }) {
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <>
      <p className={styles.panelEyebrow}>Step 1 of 9</p>
      <h2 className={styles.panelHeading}>Project Definition</h2>
      <p className={styles.panelIntro}>
        Capture the facts the rest of the project is built on: what it is,
        where it sits, how it is procured and funded, and the dates that
        frame it. Only the project name is required to begin. You can fill
        in the rest now or come back to it later.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="pd-name">
            Project name
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="pd-name"
            type="text"
            className={styles.input}
            value={values.name}
            onChange={set('name')}
            placeholder="e.g. Riverside Mews, Phase 1"
            required
            aria-required="true"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-type">
            Project type
          </label>
          <input
            id="pd-type"
            type="text"
            className={styles.input}
            value={values.project_type}
            onChange={set('project_type')}
            placeholder="e.g. Residential"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-category">
            Category
          </label>
          <input
            id="pd-category"
            type="text"
            className={styles.input}
            value={values.category}
            onChange={set('category')}
            placeholder="e.g. New build"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-subcategory">
            Sub-category
          </label>
          <input
            id="pd-subcategory"
            type="text"
            className={styles.input}
            value={values.sub_category}
            onChange={set('sub_category')}
            placeholder="e.g. Apartments"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-size">
            Size
          </label>
          <input
            id="pd-size"
            type="text"
            className={styles.input}
            value={values.size}
            onChange={set('size')}
            placeholder="e.g. 24 units, 1,800 sqm"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-location">
            Location
          </label>
          <input
            id="pd-location"
            type="text"
            className={styles.input}
            value={values.location}
            onChange={set('location')}
            placeholder="e.g. Leeds, UK"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-procurement">
            Procurement route
          </label>
          <select
            id="pd-procurement"
            className={styles.select}
            value={values.procurement_route}
            onChange={set('procurement_route')}
          >
            <option value="">Select…</option>
            {PROCUREMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-start">
            Start date
          </label>
          <input
            id="pd-start"
            type="date"
            className={styles.input}
            value={values.start_date}
            onChange={set('start_date')}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-target">
            Target completion date
          </label>
          <input
            id="pd-target"
            type="date"
            className={styles.input}
            value={values.target_completion_date}
            onChange={set('target_completion_date')}
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="pd-funding">
            Funding structure
          </label>
          <textarea
            id="pd-funding"
            className={styles.textarea}
            value={values.funding_structure}
            onChange={set('funding_structure')}
            placeholder="Sources, tranches, and conditions, as far as known."
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="pd-description">
            Description
          </label>
          <textarea
            id="pd-description"
            className={styles.textarea}
            value={values.description}
            onChange={set('description')}
            placeholder="A short summary of the project."
          />
        </div>

        {/* Optional headline financials (M3.5 Phase A). PULSE presents these
            on the brief but never models them; full detail lives elsewhere
            and is reached through the appraisal link. All optional. */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Budget and projections</h3>
          <p className={styles.groupHint}>
            Optional. Headline figures for the brief, in the currency you
            choose. PULSE presents them as you enter them and does not
            calculate anything from them.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-currency">
            Currency
          </label>
          <select
            id="pd-currency"
            className={styles.select}
            value={values.currency}
            onChange={set('currency')}
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-budget">
            Budget (allotted)
          </label>
          <input
            id="pd-budget"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={values.budget}
            onChange={set('budget')}
            placeholder="e.g. 6,400,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-gdv">
            Projected GDV
          </label>
          <input
            id="pd-gdv"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={values.projected_gdv}
            onChange={set('projected_gdv')}
            placeholder="e.g. 9,200,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-roi">
            Projected ROI (%)
          </label>
          <input
            id="pd-roi"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={values.projected_roi}
            onChange={set('projected_roi')}
            placeholder="e.g. 28"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-appraisal">
            Link to full financial detail
          </label>
          <input
            id="pd-appraisal"
            type="url"
            className={styles.input}
            value={values.financial_detail_url}
            onChange={set('financial_detail_url')}
            placeholder="https://"
            autoComplete="off"
          />
        </div>
      </div>
    </>
  );
}

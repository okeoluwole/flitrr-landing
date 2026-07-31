import SuiteNudge from './SuiteNudge';
import DateField from './DateField';
import { resolveGeography } from '../../../../lib/engine/geography.js';
import styles from './InitiationWizard.module.css';

/**
 * Step 1, Project Definition. The facts the rest of the project is built
 * on (framework Section 7). A controlled, presentational form: it owns no
 * state. `values` holds the current field values and `onChange(field,
 * value)` reports edits up to the wizard shell, which handles saving.
 *
 * Location is held as the city (in `location`) plus a country, the country
 * being the jurisdiction the rest of the flow tailors to (PULSE Framework
 * Section 7). Size is held as structured measures suited to the project type
 * (unit count, gross internal area, plot size, storeys), assembled into the
 * `size_measures` JSONB on save; the free-text `size` line is kept alongside
 * as the headline the brief reads, until a later sub-step folds it in.
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

// project_country enum values, paired with readable labels. The empty option
// maps to null on save. The country drives the geography tailoring in the
// later steps (framework Section 7).
const COUNTRY_OPTIONS = [
  { value: 'united_kingdom', label: 'United Kingdom' },
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'other', label: 'Other' },
];

// The eight lifecycle stages, for the project status picker (Note 12,
// mid-project adoption). The framework's own stage names, never invented.
// Stage 1 is the from-scratch entry stage: a project set up from the start
// declares it and behaves exactly as before the field existed. Declaring a
// later stage records that everything before it was completed prior to
// adopting PULSE.
const ENTRY_STAGE_OPTIONS = [
  { value: '0', label: 'Stage 0: Land and Site Acquisition' },
  { value: '1', label: 'Stage 1: Project Objectives and Funding' },
  { value: '2', label: 'Stage 2: Consultant Appointment' },
  { value: '3', label: 'Stage 3: Design and Planning Approvals' },
  { value: '4', label: 'Stage 4: Contractor Procurement' },
  { value: '5', label: 'Stage 5: Construction' },
  { value: '6', label: 'Stage 6: Completion and Handover' },
  { value: '7', label: 'Stage 7: Sales and Disposal' },
];

export default function StepProjectDefinition({ values, onChange }) {
  const set = (field) => (e) => onChange(field, e.target.value);
  // The date entry format follows the country chosen on this very step, so the
  // two date fields below re-read as soon as the jurisdiction is set. Both
  // configured geographies enter dates day first today; the lookup is here so a
  // future geography that differs is a configuration entry.
  const geography = resolveGeography(values.country);

  return (
    <>
      <p className={styles.panelEyebrow}>Step 1 of 9</p>
      <h2 className={styles.panelHeading}>Project Definition</h2>
      <p className={styles.panelIntro}>
        Capture the facts the rest of the project is built on: what it is,
        where it sits, its size, how it is procured, and the dates that frame
        it. Only the project name is required to begin. You can fill in the rest
        now or come back to it later.
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

        <div className={`${styles.field} ${styles.fieldFull}`}>
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
          <label className={styles.label} htmlFor="pd-location">
            City or town
          </label>
          <input
            id="pd-location"
            type="text"
            className={styles.input}
            value={values.location}
            onChange={set('location')}
            placeholder="e.g. Leeds"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-country">
            Country
          </label>
          <select
            id="pd-country"
            className={styles.select}
            value={values.country}
            onChange={set('country')}
            aria-describedby="pd-country-hint"
          >
            <option value="">Select…</option>
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="pd-country-hint" className={styles.hint}>
            The jurisdiction the project is governed in.
          </p>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="pd-entry-stage">
            Project status
          </label>
          <select
            id="pd-entry-stage"
            className={styles.select}
            value={values.entry_stage}
            onChange={set('entry_stage')}
            aria-describedby="pd-entry-stage-hint"
          >
            {ENTRY_STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="pd-entry-stage-hint" className={styles.hint}>
            Where is this project today? If it is already under way, pick its
            current stage: the stages before it are recorded as complete, and
            PULSE plans from here forward.
          </p>
        </div>

        {/* Structured size measures (size_measures JSONB). Suited to the
            project type: a tower might use units and storeys, a single plot
            its area. All optional; the wizard assembles only the filled ones. */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Project size</h3>
          <p className={styles.groupHint}>
            The measures that fit this project. Fill only the ones that apply.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-units">
            Number of units
          </label>
          <input
            id="pd-units"
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={values.size_unit_count}
            onChange={set('size_unit_count')}
            placeholder="e.g. 24"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-storeys">
            Storeys
          </label>
          <input
            id="pd-storeys"
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={values.size_storeys}
            onChange={set('size_storeys')}
            placeholder="e.g. 4"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-gia">
            Gross internal area
          </label>
          <input
            id="pd-gia"
            type="text"
            className={styles.input}
            value={values.size_gross_internal_area}
            onChange={set('size_gross_internal_area')}
            placeholder="e.g. 1,800 sqm"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-plot">
            Plot size
          </label>
          <input
            id="pd-plot"
            type="text"
            className={styles.input}
            value={values.size_plot_size}
            onChange={set('size_plot_size')}
            placeholder="e.g. 0.6 ha"
            autoComplete="off"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="pd-size">
            Size summary
          </label>
          <input
            id="pd-size"
            type="text"
            className={styles.input}
            value={values.size}
            onChange={set('size')}
            placeholder="e.g. 24 units, 1,800 sqm"
            autoComplete="off"
            aria-describedby="pd-size-hint"
          />
          <p id="pd-size-hint" className={styles.hint}>
            A short headline for the brief.
          </p>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
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
          {/* ROUTE nudge (framework Section 10). Dormant: silent until ROUTE
              ships and for App-tier developers only. Renders nothing today. */}
          <SuiteNudge product="route" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-start">
            Start date
          </label>
          <DateField
            id="pd-start"
            className={styles.input}
            value={values.start_date}
            format={geography.dateInputFormat}
            onChange={(v) => onChange('start_date', v)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pd-target">
            Target completion date
          </label>
          <DateField
            id="pd-target"
            className={styles.input}
            value={values.target_completion_date}
            format={geography.dateInputFormat}
            onChange={(v) => onChange('target_completion_date', v)}
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
      </div>
    </>
  );
}

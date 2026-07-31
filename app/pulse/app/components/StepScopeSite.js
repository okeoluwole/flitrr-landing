import { resolveGeography } from '../../../../lib/engine/geography.js';
import styles from './InitiationWizard.module.css';

/**
 * Step 3 in the framework, the Scope and Site step (live step 4). The scope
 * the project controls against for the rest of the lifecycle: the development
 * brief at headline level (what is built, the mix and the quantum, and the
 * specification standard) and the site (its area, its planning or consent
 * status, and the constraints that cap it).
 *
 * Controlled and presentational, like the other steps: `values` in,
 * `onChange(field, value)` out. The mix and quantum is a small repeatable
 * list, edited through its own handlers (onMixField / onMixAdd / onMixRemove)
 * and assembled into the mix_quantum JSONB on save by the wizard.
 *
 * The planning field is tailored to the country chosen in Step 1 (framework
 * Section 7): a UK project reads in planning-permission terms, elsewhere in
 * consent terms. The enum values are the same; only the labels change.
 *
 * Every field is optional; completeness is a Gate 1 to 2 concern, not here.
 */

// The stored planning_status enum values, in the order the field offers them.
// The values are fixed and geography-agnostic by design (migration 015); only
// their wording follows the jurisdiction, and it now comes from the geography
// configuration rather than a conditional here (Note 10).
const PLANNING_STATUS_ORDER = [
  'no_application',
  'pre_application',
  'outline_consent',
  'full_consent',
  'reserved_matters',
  'approved',
  'refused',
  'other',
];

export default function StepScopeSite({
  values,
  onChange,
  mix,
  onMixField,
  onMixAdd,
  onMixRemove,
  country,
}) {
  const set = (field) => (e) => onChange(field, e.target.value);

  // The project's geography expression (Note 10). The specification placeholder
  // and the planning field's wording are both read from it. Before this, the
  // placeholder offered NHBC and an EPC rating to every project regardless of
  // jurisdiction, which is how a Lagos scheme inherited two United Kingdom
  // instruments; an unconfigured country now resolves to the neutral base, never
  // to the United Kingdom.
  const geography = resolveGeography(country);
  const planningOptions = PLANNING_STATUS_ORDER.map((value) => ({
    value,
    label: geography.planningStatusLabels[value],
  }));

  return (
    <>
      <p className={styles.panelEyebrow}>Step 4 of 9</p>
      <h2 className={styles.panelHeading}>Scope and Site</h2>
      <p className={styles.panelIntro}>
        Set the scope the project controls against: what is being built and to
        what standard, then the site and the constraints that cap it. Every
        field is optional and can be revised before the brief is locked.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="ss-summary">
            Development brief
          </label>
          <textarea
            id="ss-summary"
            className={styles.textarea}
            value={values.development_summary}
            onChange={set('development_summary')}
            placeholder="What is being built, at headline level."
          />
        </div>

        {/* Mix and quantum: a small repeatable list, shaped to the project
            type. A tower lists unit types and counts; a single plot may need
            only one line. Assembled into the mix_quantum JSONB on save. */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Mix and quantum</h3>
          <p className={styles.groupHint}>
            What the scheme is made of. Add a line for each part, with how much
            of it. Optional.
          </p>
        </div>

        <div className={styles.fieldFull}>
          {mix.length > 0 && (
            <ul className={styles.mixList}>
              {mix.map((row, i) => (
                <li key={row._key} className={styles.mixRow}>
                  <input
                    type="text"
                    className={styles.input}
                    value={row.label}
                    onChange={(e) => onMixField(row._key, 'label', e.target.value)}
                    placeholder="e.g. 2-bed apartment"
                    autoComplete="off"
                    aria-label={`Mix item ${i + 1} label`}
                  />
                  <input
                    type="text"
                    className={`${styles.input} ${styles.mixQuantum}`}
                    value={row.quantum}
                    onChange={(e) => onMixField(row._key, 'quantum', e.target.value)}
                    placeholder="e.g. 8"
                    autoComplete="off"
                    aria-label={`Mix item ${i + 1} quantum`}
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onMixRemove(row._key)}
                    aria-label={`Remove mix item ${i + 1}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M4 8h8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.addBtn} onClick={onMixAdd}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Add a line
          </button>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="ss-spec">
            Specification standard
          </label>
          <input
            id="ss-spec"
            type="text"
            className={styles.input}
            value={values.spec_standard}
            onChange={set('spec_standard')}
            placeholder={geography.specificationPlaceholder}
            autoComplete="off"
          />
        </div>

        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Site</h3>
          <p className={styles.groupHint}>
            The site, its consent position, and what caps what can be built.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ss-area">
            Site area
          </label>
          <input
            id="ss-area"
            type="text"
            className={styles.input}
            value={values.site_area}
            onChange={set('site_area')}
            placeholder="e.g. 0.8 ha"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ss-planning">
            {geography.planningStatusLabel}
          </label>
          <select
            id="ss-planning"
            className={styles.select}
            value={values.planning_status}
            onChange={set('planning_status')}
          >
            <option value="">Select…</option>
            {planningOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="ss-planning-constraints">
            Planning constraints
          </label>
          <textarea
            id="ss-planning-constraints"
            className={styles.textarea}
            value={values.planning_constraints}
            onChange={set('planning_constraints')}
            placeholder="Designations, conditions, or policy limits that cap the scheme."
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="ss-physical-constraints">
            Physical constraints
          </label>
          <textarea
            id="ss-physical-constraints"
            className={styles.textarea}
            value={values.physical_constraints}
            onChange={set('physical_constraints')}
            placeholder="Access, ground, services, or other physical limits."
          />
        </div>
      </div>
    </>
  );
}

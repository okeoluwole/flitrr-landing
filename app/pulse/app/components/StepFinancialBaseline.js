import SuiteNudge from './SuiteNudge';
import styles from './InitiationWizard.module.css';

/**
 * Step 6, Financial Baseline (live step 6). The headline financial baseline
 * the project is governed against: the budget as hard cost, soft cost and
 * contingency, the funding structure, and the funding milestones (framework
 * Section 7, step 6). The headline figures (currency, allotted budget,
 * projected GDV and ROI, and the appraisal link) move here from Step 1; they
 * stay on the projects row and are edited through `def` / `onDefChange`. The
 * breakdown, the funding structure and notes, and the milestones are the new
 * detail, held in `financial` and the milestones list.
 *
 * Building the model behind these figures is STACK's job, so the STACK nudge
 * sits on the budget breakdown, dormant until STACK ships (framework Section
 * 10). Every field is optional; completeness is a Gate 1 to 2 concern.
 */

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'NGN', label: 'Naira (₦)' },
  { value: 'USD', label: 'USD ($)' },
];

// funding_structure_type enum values, paired with readable labels. The empty
// option maps to null on save.
const FUNDING_STRUCTURE_OPTIONS = [
  { value: 'senior_debt', label: 'Senior debt' },
  { value: 'mezzanine', label: 'Mezzanine' },
  { value: 'equity', label: 'Equity' },
  { value: 'jv', label: 'Joint venture' },
  { value: 'development_finance', label: 'Development finance' },
  { value: 'bridging', label: 'Bridging' },
  { value: 'off_plan_presales', label: 'Off-plan presales' },
  { value: 'self_funded', label: 'Self-funded' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
];

// funding_milestone_status enum values. A new milestone defaults to planned.
const FM_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'secured', label: 'Secured' },
  { value: 'drawn', label: 'Drawn' },
];

export default function StepFinancialBaseline({
  def,
  onDefChange,
  financial,
  onFinancialChange,
  milestones,
  onFmField,
  onFmAdd,
  onFmRemove,
}) {
  const setDef = (field) => (e) => onDefChange(field, e.target.value);
  const setFin = (field) => (e) => onFinancialChange(field, e.target.value);

  return (
    <>
      <p className={styles.panelEyebrow}>Step 6 of 9</p>
      <h2 className={styles.panelHeading}>Financial Baseline</h2>
      <p className={styles.panelIntro}>
        Set the headline financial baseline the project is governed against: the
        budget, the funding behind it, and the points at which funding is drawn
        or must be in place. PULSE presents these figures and does not model
        them. Every field is optional and can be revised before the brief is
        locked.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Headline figures</h3>
          <p className={styles.groupHint}>
            The figures for the brief, in the currency you choose. PULSE
            presents them as you enter them and calculates nothing from them.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-currency">
            Currency
          </label>
          <select
            id="fb-currency"
            className={styles.select}
            value={def.currency}
            onChange={setDef('currency')}
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-budget">
            Budget (allotted)
          </label>
          <input
            id="fb-budget"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={def.budget}
            onChange={setDef('budget')}
            placeholder="e.g. 6,400,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-gdv">
            Projected GDV
          </label>
          <input
            id="fb-gdv"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={def.projected_gdv}
            onChange={setDef('projected_gdv')}
            placeholder="e.g. 9,200,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-roi">
            Projected ROI (%)
          </label>
          <input
            id="fb-roi"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={def.projected_roi}
            onChange={setDef('projected_roi')}
            placeholder="e.g. 28"
            autoComplete="off"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="fb-appraisal">
            Link to full financial detail
          </label>
          <input
            id="fb-appraisal"
            type="url"
            className={styles.input}
            value={def.financial_detail_url}
            onChange={setDef('financial_detail_url')}
            placeholder="https://"
            autoComplete="off"
          />
        </div>

        {/* Budget breakdown (project_budget.budget_breakdown). Hard, soft and
            contingency at minimum, in the chosen currency. */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Budget breakdown</h3>
          <p className={styles.groupHint}>
            The budget split into hard cost, soft cost and contingency, in the
            currency above.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-hard">
            Hard cost
          </label>
          <input
            id="fb-hard"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={financial.hard_cost}
            onChange={setFin('hard_cost')}
            placeholder="e.g. 4,800,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-soft">
            Soft cost
          </label>
          <input
            id="fb-soft"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={financial.soft_cost}
            onChange={setFin('soft_cost')}
            placeholder="e.g. 900,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fb-contingency">
            Contingency
          </label>
          <input
            id="fb-contingency"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={financial.contingency}
            onChange={setFin('contingency')}
            placeholder="e.g. 700,000"
            autoComplete="off"
          />
        </div>

        <div className={styles.fieldFull}>
          {/* STACK nudge (framework Section 10). Dormant: silent until STACK
              ships and for App-tier developers only. Renders nothing today. */}
          <SuiteNudge product="stack" />
        </div>

        {/* Funding (project_budget.funding_structure_type / funding_notes). */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Funding</h3>
          <p className={styles.groupHint}>
            The shape of the money behind the scheme.
          </p>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="fb-structure">
            Funding structure
          </label>
          <select
            id="fb-structure"
            className={styles.select}
            value={financial.funding_structure_type}
            onChange={setFin('funding_structure_type')}
          >
            <option value="">Select…</option>
            {FUNDING_STRUCTURE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="fb-funding-notes">
            Funding notes
            <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="fb-funding-notes"
            className={styles.textarea}
            value={financial.funding_notes}
            onChange={setFin('funding_notes')}
            placeholder="Sources, tranches, and conditions, as far as known."
          />
        </div>

        {/* Funding milestones (project_funding_milestones). */}
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Funding milestones</h3>
          <p className={styles.groupHint}>
            The points at which funding is drawn or must be in place. Optional.
          </p>
        </div>

        <div className={styles.fieldFull}>
          {milestones.length === 0 ? (
            <p className={styles.emptyHint}>
              No funding milestones yet. Add one below, or continue with none.
            </p>
          ) : (
            <ul className={styles.itemList}>
              {milestones.map((m, i) => (
                <li key={m._key}>
                  <fieldset className={styles.itemCard}>
                    <legend className={styles.srOnly}>Funding milestone {i + 1}</legend>
                    <div className={styles.itemHead}>
                      <span className={styles.itemIndex} aria-hidden="true">
                        Milestone {i + 1}
                      </span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => onFmRemove(m._key)}
                        aria-label={`Remove funding milestone ${i + 1}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path
                            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className={styles.itemGrid}>
                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label} htmlFor={`fm-${m._key}-label`}>
                          Milestone
                        </label>
                        <input
                          id={`fm-${m._key}-label`}
                          type="text"
                          className={styles.input}
                          value={m.label}
                          onChange={(e) => onFmField(m._key, 'label', e.target.value)}
                          placeholder="e.g. Senior debt drawn at start on site"
                          autoComplete="off"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`fm-${m._key}-amount`}>
                          Amount
                          <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          id={`fm-${m._key}-amount`}
                          type="text"
                          inputMode="decimal"
                          className={styles.input}
                          value={m.amount}
                          onChange={(e) => onFmField(m._key, 'amount', e.target.value)}
                          placeholder="e.g. 3,000,000"
                          autoComplete="off"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`fm-${m._key}-date`}>
                          Target date
                          <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          id={`fm-${m._key}-date`}
                          type="date"
                          className={styles.input}
                          value={m.target_date}
                          onChange={(e) => onFmField(m._key, 'target_date', e.target.value)}
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label} htmlFor={`fm-${m._key}-status`}>
                          Status
                        </label>
                        <select
                          id={`fm-${m._key}-status`}
                          className={styles.select}
                          value={m.status}
                          onChange={(e) => onFmField(m._key, 'status', e.target.value)}
                        >
                          {FM_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <label className={styles.label} htmlFor={`fm-${m._key}-note`}>
                          Note
                          <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          id={`fm-${m._key}-note`}
                          type="text"
                          className={styles.input}
                          value={m.note}
                          onChange={(e) => onFmField(m._key, 'note', e.target.value)}
                          placeholder="Any condition or detail."
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </fieldset>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className={styles.addBtn} onClick={onFmAdd}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            Add funding milestone
          </button>
        </div>
      </div>
    </>
  );
}

import styles from './InitiationWizard.module.css';

/**
 * Step 7, Programme (live step 7). The lifecycle baseline the Programme
 * Tracker measures against: a target date for each of the eight stage gates,
 * then the critical milestones beyond the gates (framework Section 7, step 7).
 *
 * This component renders the step header and the eight gate target dates. The
 * milestones follow in their own sub-section, rendered by the shared
 * StepItemList beneath this component (each milestone carries the criticality
 * of the objective it serves).
 *
 * Controlled and presentational: `gates` is the eight stage-gate rows in stage
 * order, and onGateDateChange(stage, value) reports a date edit up to the
 * wizard, which saves it onto project_stage_gates.target_date. Only the date is
 * touched here; the gate status the Gate module owns is never altered. Every
 * date is optional; completeness is a Gate 1 to 2 concern.
 */

// Lifecycle stage names (framework Section 4), keyed by stage number. Each gate
// closes its stage, so the row reads as that stage's target.
const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

export default function StepProgramme({ gates, onGateDateChange }) {
  return (
    <>
      <p className={styles.panelEyebrow}>Step 7 of 9</p>
      <h2 className={styles.panelHeading}>Programme</h2>
      <p className={styles.panelIntro}>
        Set the lifecycle baseline: a target date for each of the eight stage
        gates, then the milestones that mark real progress between them. Every
        field is optional and can be revised before the brief is locked.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Stage gate target dates</h3>
          <p className={styles.groupHint}>
            The target date for each stage gate. Together these set the
            lifecycle baseline the Programme Tracker measures against.
          </p>
        </div>

        {gates.map((g) => (
          <div key={g.stage} className={styles.field}>
            <label className={styles.label} htmlFor={`gate-${g.stage}`}>
              Stage {g.stage}: {STAGE_NAMES[g.stage] ?? `Stage ${g.stage}`}
            </label>
            <input
              id={`gate-${g.stage}`}
              type="date"
              className={styles.input}
              value={g.target_date}
              onChange={(e) => onGateDateChange(g.stage, e.target.value)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

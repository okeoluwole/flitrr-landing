import styles from './InitiationWizard.module.css';
import { PROGRAMME_TEMPLATE } from '../../../../lib/engine/programmeTemplate.js';
import { deriveRollingGateDates } from '../../../../lib/engine/programmeSchedule.js';

/**
 * Step 7, Programme (live step 7). The lifecycle baseline the Programme
 * Tracker measures against: a target date for each of the eight stage gates,
 * then the critical milestones beyond the gates (framework Section 7, step 7).
 *
 * This component renders the step header and the eight gate target dates. The
 * milestones follow in their own sub-section, rendered by the shared
 * StepItemList beneath this component (1d revisits those); this sub-step (1c)
 * touches the gates only.
 *
 * Gate entry is sequential. Stage 0's gate is open first; each later gate stays
 * disabled until the previous gate is given a date or marked not applicable. The
 * open gate shows a rolling advised date, a one-tap suggestion the developer can
 * accept or override with their own date. The advised date carries a light,
 * honest basis hint: a typical span in weeks, a curated estimate, not a
 * statutory figure. The advised date is derived in render
 * (deriveRollingGateDates) and never stored; only the chosen date and the N/A
 * flag are persisted.
 *
 * Controlled and presentational. `gates` is the eight stage-gate choice rows in
 * stage order (each { stage, target_date, target_na, ... }); `projectStart` is
 * the project start date held in the Brief, the anchor of the rolling chain;
 * onGateDateChange(stage, value) and onGateNaToggle(stage, checked) report edits
 * up to the wizard, which saves the choices onto project_stage_gates. The gate
 * status the Gate module owns is never altered here.
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

// A gate is "set" once it has a chosen date or is marked not applicable. A set
// gate opens the next one; the sequence is revealed up to the first unset gate.
function isGateSet(gate) {
  return gate.target_na === true || (gate.target_date ?? '').trim() !== '';
}

// A gate is dated when the developer has chosen a date for it (not N/A).
function isGateDated(gate) {
  return (gate.target_date ?? '').trim() !== '';
}

// Advised dates are at UTC instants (see programmeSchedule.js), so format in UTC
// to keep the displayed day stable regardless of the viewer's timezone.
function advisedValue(date) {
  return date.toISOString().slice(0, 10);
}

function advisedDisplay(date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function StepProgramme({
  gates,
  projectStart,
  onGateDateChange,
  onGateNaToggle,
}) {
  // Roll the advised dates from the project start and the choices so far. Pure
  // and derived: nothing here is persisted.
  const rolling = deriveRollingGateDates(projectStart, PROGRAMME_TEMPLATE, {
    stages: gates,
  });
  const metaByStage = new Map(rolling.stages.map((s) => [s.stage, s]));

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
            Set each gate in sequence. Give a gate a date or mark it not
            applicable, and the next one opens. Where a project start date is
            set, each gate suggests a typical span you can accept or change.
            Together these set the lifecycle baseline the Programme Tracker
            measures against.
          </p>
        </div>

        {gates.map((g, i) => {
          const meta = metaByStage.get(g.stage);
          // Sequential reveal: stage 0 is open first, each later gate opens once
          // the one before it is set (dated or marked not applicable).
          const enabled = i === 0 || isGateSet(gates[i - 1]);
          const advisedDate = meta?.applicable ? meta.advisedDate : null;
          const showSuggestion =
            enabled && !g.target_na && !isGateDated(g) && advisedDate != null;

          return (
            <div key={g.stage} className={styles.field}>
              <label className={styles.label} htmlFor={`gate-${g.stage}`}>
                Stage {g.stage}: {STAGE_NAMES[g.stage] ?? `Stage ${g.stage}`}
              </label>

              <div className={styles.gateRow}>
                <input
                  id={`gate-${g.stage}`}
                  type="date"
                  className={styles.input}
                  value={g.target_date}
                  disabled={!enabled || g.target_na}
                  onChange={(e) => onGateDateChange(g.stage, e.target.value)}
                />
                <label
                  className={`${styles.naToggle} ${
                    enabled ? '' : styles.naToggleOff
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={g.target_na}
                    disabled={!enabled}
                    onChange={(e) => onGateNaToggle(g.stage, e.target.checked)}
                  />
                  Not applicable
                </label>
              </div>

              {showSuggestion && (
                <div className={styles.gateSuggest}>
                  <button
                    type="button"
                    className={styles.suggestBtn}
                    onClick={() =>
                      onGateDateChange(g.stage, advisedValue(advisedDate))
                    }
                    aria-label={`Use the advised date ${advisedDisplay(
                      advisedDate
                    )} for stage ${g.stage}`}
                  >
                    Use advised date, {advisedDisplay(advisedDate)}
                  </button>
                  <span className={styles.suggestHint}>
                    About {meta.gateWeeks} weeks, a typical span for this stage.
                    Adjust as needed.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

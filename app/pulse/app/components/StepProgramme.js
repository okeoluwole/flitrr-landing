import styles from './InitiationWizard.module.css';
import { OBJECTIVE_META } from './objectiveMeta';
import { PROGRAMME_TEMPLATE } from '../../../../lib/engine/programmeTemplate.js';
import { deriveRollingGateDates } from '../../../../lib/engine/programmeSchedule.js';
import { deriveMilestoneView } from '../../../../lib/engine/programmeMilestones.js';
import { CRITICALITY } from '../../../../lib/engine/criticality.js';
import { STAGE_STATE } from '../../../../lib/engine/stageStates.js';

/**
 * Step 7, Programme (live step 7). The lifecycle baseline the Programme
 * Tracker measures against: a target date for each of the eight stage gates,
 * then the critical milestones beyond the gates (framework Section 7, step 7).
 *
 * This component renders the step header, the eight gate target dates, and then
 * the curated milestones for each stage (sub-step 1d): each template milestone
 * read-only by name, with a criticality derived from the objective it serves, an
 * optional target date bounded to the stage window, an optional note, and the
 * stage's location-sensitive prompts. The milestones are fixed by the template,
 * so there is no free-text milestone and no add control. A stage marked not
 * applicable at the gate step contributes no milestones.
 *
 * Gate entry is sequential. Stage 0's gate is open first; each later gate stays
 * disabled until the previous gate is given a date or marked not applicable. The
 * open gate shows a rolling advised date, a one-tap suggestion the developer can
 * accept or override with their own date. The advised date carries a light,
 * honest basis hint that names BOTH halves of its arithmetic: the date it counts
 * from and the typical span in weeks it adds, a curated estimate, not a
 * statutory figure. Both are read off the one object the engine returns
 * (anchorDate and spanWeeks beside advisedDate), so the hint can never cite a
 * basis the suggestion did not use. The advised date is derived in render
 * (deriveRollingGateDates) and never stored; only the chosen date and the N/A
 * flag are persisted.
 *
 * Stage windows follow the stage-state model (lib/engine/stageStates.js), passed
 * in as `stageStates` and derived by the wizard from the baseline. Stages 0 to 6
 * are strictly sequential. Stage 7 becomes concurrent for an off-plan or Nigeria
 * scheme, which widens its milestone window to open at sales launch rather than
 * at the completion gate; the stage says so in plain words above its milestones.
 * No toggle: the state is read from the baseline, never chosen here.
 *
 * Controlled and presentational. `gates` is the eight stage-gate choice rows in
 * stage order (each { stage, target_date, target_na, milestones }); `projectStart`
 * is the project start date held in the Brief, the anchor of the rolling chain;
 * onGateDateChange(stage, value) and onGateNaToggle(stage, checked) report gate
 * edits up to the wizard, which saves the choices onto project_stage_gates. The
 * gate status the Gate module owns is never altered here.
 *
 * `objectives` is the project's objective rows, read live for the derived
 * milestone criticality (the same kernel join risks use). onMilestoneDateChange(
 * stage, key, value) and onMilestoneNoteChange(stage, key, value) report the
 * per-milestone choice edits, keyed by the stable milestone key; they save
 * through the same programme choices layer as the gates (milestone_choices).
 * Criticality is derived and shown, never stored.
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

// Two dates are the same instant. Used to tell the first open gate (anchored on
// the project start) from a later one (anchored on the gate before it), so the
// hint names the right thing.
function sameInstant(a, b) {
  return a != null && b != null && a.getTime() === b.getTime();
}

/**
 * The basis hint under an advised date: what it counted from, and what it added.
 * Both halves come from the same engine object as the date itself, so a reader
 * can check the arithmetic and always find it holds.
 */
function advisedBasis(meta, projectStart) {
  const from = sameInstant(meta.anchorDate, projectStart)
    ? 'the project start'
    : 'the previous gate';
  return `About ${meta.spanWeeks} weeks from ${from}, ${advisedDisplay(
    meta.anchorDate
  )}. A typical span for this stage, adjust as needed.`;
}

// The plain-words note above a stage's milestones when its window is not the
// strict one. A concurrent stage says where its window opens; a stage already
// complete says its dates are a record. A sequential stage says nothing, which
// is the silent norm.
function stageWindowNote(meta) {
  if (meta?.state === STAGE_STATE.CONCURRENT) {
    const label = meta.windowStartLabel ?? 'the start of this stage';
    return `This stage runs alongside the rest of the programme, so its dates can fall any time from ${label} onwards.`;
  }
  if (meta?.state === STAGE_STATE.COMPLETE) {
    return 'This stage is already complete, so these dates record what happened.';
  }
  return null;
}

// Objective display name lookup, keyed by objective_type. The template's `serves`
// is the objective_type identifier; this resolves the human label for display
// (the single source of names is objectiveMeta.js).
const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The read-only criticality badge: critical wears the amber signal, standard
// stays neutral. classifyByType never returns 'unlinked' (a template milestone
// always serves a named objective), so the two cases cover it.
function criticalityLabel(criticality) {
  return criticality === CRITICALITY.CRITICAL ? 'Critical' : 'Standard';
}

export default function StepProgramme({
  gates,
  projectStart,
  objectives,
  stageStates,
  onGateDateChange,
  onGateNaToggle,
  onMilestoneDateChange,
  onMilestoneNoteChange,
}) {
  // Roll the advised dates from the project start and the choices so far. Pure
  // and derived: nothing here is persisted.
  const rolling = deriveRollingGateDates(
    projectStart,
    PROGRAMME_TEMPLATE,
    { stages: gates },
    stageStates
  );
  const metaByStage = new Map(rolling.stages.map((s) => [s.stage, s]));

  // The milestone view: per stage, the template milestones with their derived
  // criticality, the developer's chosen date and note, and the stage date
  // window. Pure and derived, like the gates above; criticality is shown, never
  // stored. A not-applicable stage yields no milestones and is filtered out.
  const milestoneView = deriveMilestoneView(
    PROGRAMME_TEMPLATE,
    { stages: gates },
    objectives,
    projectStart,
    stageStates
  );
  const milestoneStages = milestoneView.stages.filter((s) => s.applicable);

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
                    {advisedBasis(meta, rolling.projectStart)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.fieldGrid}>
        <div className={`${styles.fieldFull} ${styles.groupHead}`}>
          <h3 className={styles.groupTitle}>Milestones</h3>
          <p className={styles.groupHint}>
            The critical milestones for each stage, set by the template. Give each
            a target date within the stage window and a note if it helps. A
            milestone's criticality follows the objective it serves, so it is
            shown, not chosen. A stage marked not applicable above has none.
          </p>
        </div>

        <div className={styles.fieldFull}>
          {milestoneStages.length === 0 ? (
            <p className={styles.emptyHint}>
              Every stage is marked not applicable, so there are no milestones to
              set.
            </p>
          ) : (
            milestoneStages.map((stage) => {
              const windowNote = stageWindowNote(metaByStage.get(stage.stage));
              return (
              <div key={stage.stage} className={styles.milestoneStage}>
                <p className={styles.milestoneStageLabel}>
                  Stage {stage.stage}: {stage.name}
                </p>

                {windowNote && (
                  <p className={styles.stageWindowNote}>{windowNote}</p>
                )}

                <ul className={styles.milestoneList}>
                  {stage.milestones.map((m) => {
                    const dateId = `ms-date-${stage.stage}-${m.key}`;
                    const noteId = `ms-note-${stage.stage}-${m.key}`;
                    const isCritical = m.criticality === CRITICALITY.CRITICAL;
                    return (
                      <li key={m.key} className={styles.itemCard}>
                        <div className={styles.milestoneHead}>
                          <span className={styles.milestoneName}>{m.name}</span>
                          <span
                            className={`${styles.critBadge} ${
                              isCritical
                                ? styles.critBadgeCritical
                                : styles.critBadgeStandard
                            }`}
                          >
                            {criticalityLabel(m.criticality)}
                          </span>
                        </div>
                        <p className={styles.milestoneServes}>
                          Serves {NAME_BY_TYPE[m.serves] ?? m.serves}
                        </p>

                        <div className={styles.itemGrid}>
                          <div className={styles.field}>
                            <label className={styles.label} htmlFor={dateId}>
                              Target date
                              <span className={styles.optional}>(optional)</span>
                            </label>
                            <input
                              id={dateId}
                              type="date"
                              className={styles.input}
                              value={m.date}
                              min={m.minDate ?? undefined}
                              max={m.maxDate ?? undefined}
                              onChange={(e) =>
                                onMilestoneDateChange(
                                  stage.stage,
                                  m.key,
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label} htmlFor={noteId}>
                              Note
                              <span className={styles.optional}>(optional)</span>
                            </label>
                            <input
                              id={noteId}
                              type="text"
                              className={styles.input}
                              value={m.note}
                              placeholder="Optional detail."
                              autoComplete="off"
                              onChange={(e) =>
                                onMilestoneNoteChange(
                                  stage.stage,
                                  m.key,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {stage.locationSensitive.map((point, i) => (
                  <p key={i} className={styles.locationNote}>
                    <svg
                      className={styles.locationNoteIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="6.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M8 7.2v3.3M8 5.1h.01"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={styles.locationNoteText}>
                      <strong>{point.label}</strong>: {point.prompt}.
                    </span>
                  </p>
                ))}
              </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

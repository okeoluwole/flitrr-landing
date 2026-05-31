import { OBJECTIVE_META } from './objectiveMeta';
import styles from './InitiationWizard.module.css';

/**
 * Step 3 — Project Objectives. The framework's central act: the developer
 * defines each of the five objectives and classifies how much each can
 * flex (framework Section 6). This is where objective criticality stops
 * being theory and becomes something they set.
 *
 * Presentational and controlled, like Steps 1 and 2: `objectives` holds
 * the current state of all five rows (canonical order), and
 * `onChange(type, field, value)` reports edits up to the wizard shell,
 * which owns the state and the saving. No own state here.
 *
 * Each card carries a definition field, a Non-negotiable / Flexible
 * choice, and a tolerance field that shows only when Flexible is selected.
 * Validation is permissive: every objective already has a classification
 * (Flexible by default), so nothing is ever blank, and the developer can
 * advance without completing every field.
 */

// The two classifications, in the order the spec presents them. The
// explainer lines are used verbatim.
const CLASSIFICATION_OPTIONS = [
  {
    value: 'non_negotiable',
    title: 'Non-negotiable',
    hint: 'Compromise causes irreversible damage.',
  },
  {
    value: 'flexible',
    title: 'Flexible',
    hint: 'Can move within agreed bounds.',
  },
];

export default function StepProjectObjectives({ objectives, onChange }) {
  // Look up each objective's live state by type. Defensive: the shell
  // always supplies all five in canonical order, but matching by type
  // keeps this robust if that ever changes.
  const byType = Object.fromEntries(
    (objectives ?? []).map((o) => [o.objective_type, o])
  );

  return (
    <>
      <p className={styles.panelEyebrow}>Step 3 of 8</p>
      <h2 className={styles.panelHeading}>Project Objectives</h2>
      <p className={styles.panelIntro}>
        Define what each objective means for this project, then mark how
        much each one can flex. This is the decision that shapes everything
        after it. It determines what gets protected, and what can give, when
        the project comes under pressure.
      </p>

      <div className={styles.objList}>
        {OBJECTIVE_META.map(({ type, name, description }) => {
          const o = byType[type] ?? {
            definition: '',
            classification: 'flexible',
            tolerance: '',
          };
          const isFlexible = o.classification === 'flexible';

          return (
            <div key={type} className={styles.objCard}>
              <div className={styles.objCardHead}>
                <h3 className={styles.objName}>{name}</h3>
                <p className={styles.objDesc}>{description}</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={`obj-def-${type}`}>
                  What does {name} mean for this project?
                </label>
                <input
                  id={`obj-def-${type}`}
                  type="text"
                  className={styles.input}
                  value={o.definition ?? ''}
                  onChange={(e) => onChange(type, 'definition', e.target.value)}
                  autoComplete="off"
                />
              </div>

              <fieldset className={styles.choiceGroup}>
                <legend className={styles.choiceLegend}>Classification</legend>
                <div className={styles.choices}>
                  {CLASSIFICATION_OPTIONS.map((opt) => {
                    const checked = o.classification === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`${styles.choice} ${
                          checked ? styles.choiceSelected : ''
                        }`}
                      >
                        <input
                          type="radio"
                          className={styles.choiceInput}
                          name={`obj-classification-${type}`}
                          value={opt.value}
                          checked={checked}
                          onChange={() =>
                            onChange(type, 'classification', opt.value)
                          }
                        />
                        <span className={styles.choiceTitle}>{opt.title}</span>
                        <span className={styles.choiceHint}>{opt.hint}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {isFlexible && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`obj-tol-${type}`}>
                    Within what bounds can this flex?
                  </label>
                  <input
                    id={`obj-tol-${type}`}
                    type="text"
                    className={styles.input}
                    value={o.tolerance ?? ''}
                    onChange={(e) => onChange(type, 'tolerance', e.target.value)}
                    placeholder="e.g. up to 8% over budget, or completion can slip by one quarter"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

import styles from './InitiationWizard.module.css';

/**
 * Step 2 — Strategic Context. Grounds the project in its business
 * rationale (framework Section 7). Controlled and presentational, like
 * Step 1: `values` in, `onChange(field, value)` out, no own state.
 *
 * Every field here is optional. Nothing on this step blocks advancement.
 */
export default function StepStrategicContext({ values, onChange }) {
  const set = (field) => (e) => onChange(field, e.target.value);

  return (
    <>
      <p className={styles.panelEyebrow}>Step 2 of 8</p>
      <h2 className={styles.panelHeading}>Strategic Context</h2>
      <p className={styles.panelIntro}>
        Ground the project in its business rationale: why you are doing it,
        who it is for, how you exit, and how it aligns with your wider
        strategy. Every field here is optional and can be revisited before
        the brief is locked.
      </p>

      <div className={styles.fieldGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="sc-rationale">
            Strategic rationale
          </label>
          <textarea
            id="sc-rationale"
            className={styles.textarea}
            value={values.strategic_rationale}
            onChange={set('strategic_rationale')}
            placeholder="Why this project? The business case for committing to it."
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sc-enduser">
            Target end-user
          </label>
          <input
            id="sc-enduser"
            type="text"
            className={styles.input}
            value={values.target_end_user}
            onChange={set('target_end_user')}
            placeholder="e.g. First-time buyers"
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sc-exit">
            Exit strategy
          </label>
          <input
            id="sc-exit"
            type="text"
            className={styles.input}
            value={values.exit_strategy}
            onChange={set('exit_strategy')}
            placeholder="e.g. Open-market sale, refinance and hold"
            autoComplete="off"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="sc-alignment">
            Strategic alignment
          </label>
          <textarea
            id="sc-alignment"
            className={styles.textarea}
            value={values.strategic_alignment}
            onChange={set('strategic_alignment')}
            placeholder="How this fits your wider portfolio or business strategy."
          />
        </div>
      </div>
    </>
  );
}

import styles from './InitiationWizard.module.css';

/**
 * Placeholder panel for a step not yet built. These steps are navigable (the
 * progress indicator and Next control reach them) but carry no form or
 * data logic in M3.2. Each states its name and a one-line description of
 * what it will do, plus a badge marking it as not yet built.
 *
 * The real implementations land in later sub-steps:
 *   - M3.3: steps 3 to 4 (objectives, constraint ranking)
 *   - M3.4: steps 5 to 7 (milestones, workstreams, risk profile)
 *   - M3.5: step 8 (brief assembly)
 */
export default function StepPlaceholder({ name, body }) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderBadge}>Coming in a later build</span>
      <h2 className={styles.placeholderHeading}>{name}</h2>
      <p className={styles.placeholderBody}>{body}</p>
    </div>
  );
}

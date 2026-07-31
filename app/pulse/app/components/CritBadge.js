import { CRITICALITY } from '../../../../lib/engine/criticality.js';
import styles from './InitiationWizard.module.css';

/**
 * CritBadge, the wizard's read-only criticality badge: critical wears the
 * amber signal, standard stays neutral. One component for every initiation
 * surface that states a derived criticality (Step 7's milestones, Step 5's
 * workstreams, the Step 8 RAID lists), so there is one look, not two.
 *
 * Static, not a control: criticality is derived from the objective an item
 * serves (framework principle 3), so the badge states a read, it never sets
 * one. The app-side sibling is CriticalityChip (the register, the Action Log,
 * the Dashboard); this one carries the wizard's own visual language.
 */
export default function CritBadge({ criticality }) {
  const isCritical = criticality === CRITICALITY.CRITICAL;
  return (
    <span
      className={`${styles.critBadge} ${
        isCritical ? styles.critBadgeCritical : styles.critBadgeStandard
      }`}
    >
      {isCritical ? 'Critical' : 'Standard'}
    </span>
  );
}

import styles from './CriticalityChip.module.css';

/**
 * CriticalityChip - the single expression of an item's derived criticality.
 *
 * One mono pill, the same idiom everywhere criticality is stated: the Risk
 * register, the Action Log, and the Dashboard. Amber is spent on Critical and
 * nowhere else in a chip row; Standard is the quiet outline; Needs a link is
 * the dashed governance gap (an item that cannot derive a criticality because
 * it serves no objective), which never borrows amber.
 *
 * Static, not a control: criticality is derived from the objective an item
 * serves, so the chip states a read, it never sets one.
 *
 * Props:
 *   critical  true renders the amber Critical pill.
 *   unlinked  true renders the dashed Needs a link pill, and wins over
 *             critical (an unlinked item has no criticality to state).
 */
export default function CriticalityChip({ critical = false, unlinked = false }) {
  let stateClass = styles.standard;
  let label = 'Standard';
  if (unlinked) {
    stateClass = styles.unlinked;
    label = 'Needs a link';
  } else if (critical) {
    stateClass = styles.critical;
    label = 'Critical';
  }

  return <span className={`${styles.chip} ${stateClass}`}>{label}</span>;
}

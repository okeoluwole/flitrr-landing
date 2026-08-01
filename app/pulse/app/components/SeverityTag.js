import { severityBandAppearance } from '../../../../lib/design/semantics';
import { severityLegend } from '../../../../lib/engine/severity';
import styles from './SeverityTag.module.css';

/**
 * SeverityTag - the single expression of a risk's derived severity band
 * (Session K, sub-step 2). Before it, the Risk register and the Action Log
 * each carried their own severity classes and the two had drifted: on the
 * log, Worth watching rendered as an outline rather than the mid fill, and
 * Minor was indistinguishable from Not yet scored. One component, one CSS
 * module, with the label and every colour taken from severityBandAppearance
 * (lib/design/semantics.js), so the band cannot render two ways again.
 *
 * Severity is how bad; criticality is what it threatens. The two axes never
 * blur, so the tag is a monochrome intensity ramp in the 4px tag shape and
 * never borrows amber (criticality holds the pill, CriticalityChip).
 *
 * Props:
 *   band  the engine band key from deriveSeverity ('serious' | 'moderate' |
 *         'minor' | 'unscored'), or null/undefined to render nothing (a RAID
 *         item carries no severity). An unknown key throws, via the mapping:
 *         a silent fallback is how a wrong band renders as Minor.
 */
export default function SeverityTag({ band }) {
  if (!band) return null;
  const appearance = severityBandAppearance(band);
  return (
    <span className={`${styles.tag} ${styles[band]}`}>{appearance.label}</span>
  );
}

/**
 * SeverityLegend - the derivation stated once, so the bands read rather than
 * have to be learned. Built from the engine (severityLegend), so it cannot
 * drift from the rule it explains. Shared by the register's review queue and
 * the log's triage queue.
 */
export function SeverityLegend() {
  const legend = severityLegend();
  return (
    <p className={styles.legend}>
      <span className={styles.legendLead}>{legend.lead}</span>
      {legend.bands.map((b) => (
        <span key={b.key} className={styles.legendBand}>
          {b.label} {b.range}
        </span>
      ))}
    </p>
  );
}

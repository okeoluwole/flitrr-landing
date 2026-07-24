/**
 * The severity module (engine consolidation, Step A6). The single, pure source
 * of the risk register's plain-word severity. No DB, no React, no network, no
 * system clock, so the same inputs always give the same verdict and the whole
 * module is unit-testable in isolation.
 *
 * Lifted verbatim from risk/riskModel.js (where it lived as the M6.1 register's
 * derivation) so Programme and Dashboard can read severity from the engine
 * without importing from ../risk/. riskModel re-exports both symbols, so its
 * existing importers, and riskMonitor, keep working unchanged.
 *
 * Severity is DERIVED, never stored. It is the product of the likelihood level
 * and the impact level (each 1 to 3), mapped to a plain word per the M6.1 spec:
 *   score 1 to 2 -> Minor
 *   score 3 to 4 -> Worth watching
 *   score 6 to 9 -> Serious
 *   likelihood or impact unset -> Not yet scored
 * (Products of two values in 1..3 are 1, 2, 3, 4, 6, 9; 5, 7 and 8 cannot
 * occur, so the bands are complete. The wizard seeds medium/medium, so a risk
 * normally reads "Worth watching" rather than unscored; the "has the developer
 * engaged yet" signal is carried by last_reviewed_at being null, not by an
 * unscored severity.)
 *
 * ONE SCALE, ONE VOCABULARY (Note 19). The likelihood and impact labels live
 * here too, beside the derivation they feed. They used to be written twice: the
 * register said Unlikely, Possible, Likely and Limited, Significant, Severe,
 * while the Step 8 capture that fills the very same columns said Low, Medium,
 * High. Two vocabularies for one stored scale is one vocabulary too many, and
 * the developer was left to work out that their Medium and the register's
 * Possible were the same answer. The register's plain-language labels won,
 * because they say what they mean, and both surfaces now read these constants.
 * The stored risk_level values are untouched.
 */

// risk_level value -> level. Likelihood and impact share the scale, so one map
// serves both.
const LEVEL = { low: 1, medium: 2, high: 3 };

/**
 * Likelihood scale: the stored risk_level value, the plain label, and the level
 * (1 to 3) that feeds the severity score. The single source for the register
 * and for the Step 8 capture (Note 19).
 */
export const LIKELIHOOD_OPTIONS = [
  { value: 'low', label: 'Unlikely', level: 1 },
  { value: 'medium', label: 'Possible', level: 2 },
  { value: 'high', label: 'Likely', level: 3 },
];

// Impact scale: the same stored risk_level values, relabelled for impact.
export const IMPACT_OPTIONS = [
  { value: 'low', label: 'Limited', level: 1 },
  { value: 'medium', label: 'Significant', level: 2 },
  { value: 'high', label: 'Severe', level: 3 },
];

// Severity ranking: lower is more urgent. Exported so the monitoring model
// (riskMonitor.js) orders by the same scale rather than redefining it.
export const SEVERITY_RANK = { serious: 0, moderate: 1, minor: 2, unscored: 3 };

/**
 * Derive the plain-word severity from a stored likelihood and impact (each a
 * risk_level value). Returns { key, label }. key is serious | moderate | minor
 * | unscored (moderate is the "Worth watching" band; a stable key, separate
 * from the 'watching' status, keeps the two vocabularies from colliding).
 */
export function deriveSeverity(likelihood, impact) {
  const l = LEVEL[likelihood];
  const i = LEVEL[impact];
  if (!l || !i) return { key: 'unscored', label: 'Not yet scored' };
  const score = l * i;
  if (score <= 2) return { key: 'minor', label: 'Minor' };
  if (score <= 4) return { key: 'moderate', label: 'Worth watching' };
  return { key: 'serious', label: 'Serious' };
}

/**
 * The three scored bands with the score range each covers, most urgent first.
 * The single description of the derivation above, so the legend the surfaces
 * render cannot drift from the rule it explains. 'unscored' is deliberately
 * absent: it is the absence of a score, not a band of it.
 */
export const SEVERITY_BANDS = [
  { key: 'serious', label: 'Serious', min: 6, max: 9 },
  { key: 'moderate', label: 'Worth watching', min: 3, max: 4 },
  { key: 'minor', label: 'Minor', min: 1, max: 2 },
];

/**
 * The legend a surface shows beside a severity chip, so the band is readable
 * rather than asserted (Notes 18 and 19). Returns the lead line and one entry
 * per band, each carrying its label and the score range it covers, derived from
 * SEVERITY_BANDS rather than written out again.
 *
 *   { lead, bands: [{ key, label, range }] }
 */
export function severityLegend() {
  return {
    lead: 'Severity is likelihood times impact.',
    bands: SEVERITY_BANDS.map((b) => ({
      key: b.key,
      label: b.label,
      range: b.min === b.max ? `${b.min}` : `${b.min} to ${b.max}`,
    })),
  };
}

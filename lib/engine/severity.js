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
 */

// risk_level value -> level. Likelihood and impact share the scale, so one map
// serves both.
const LEVEL = { low: 1, medium: 2, high: 3 };

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

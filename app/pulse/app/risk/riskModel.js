/**
 * Risk register model (M6.1). Pure, deterministic helpers shared by the
 * server page and the client register. No AI, no state, no side effects.
 *
 * Likelihood and impact reuse the existing project_risks scale (the risk_level
 * enum: low, medium, high). The register relabels the three levels in plainer
 * language (Unlikely/Possible/Likely and Limited/Significant/Severe) but stores
 * the same values, so there is one source of truth and the Brief snapshot, the
 * wizard, and the register all read the same column.
 *
 * Severity is DERIVED here, never stored. It is the product of the likelihood
 * level and the impact level (each 1 to 3), mapped to a plain word per the
 * M6.1 spec:
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
 * Criticality is the Brief's definition reused verbatim: a risk is critical
 * when its `criticality` column is 'critical' (the cascade sets this from the
 * objective it threatens). The register never computes a second definition,
 * so its critical count always agrees with the Brief's Critical risks KPI.
 */

// Likelihood scale: the stored risk_level value, the register's plain label,
// and the level (1 to 3) that feeds the severity score.
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

// Register status (risk_register_status enum).
export const STATUS_OPTIONS = [
  { value: 'watching', label: 'Watching' },
  { value: 'acting', label: 'Acting' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'closed', label: 'Closed' },
];

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

// A risk is critical by the Brief's definition: its criticality column.
export function isCritical(risk) {
  return risk.criticality === 'critical';
}

/**
 * Sort for the register: criticality first (critical, protected-objective
 * risks at the top), then severity (Serious, Worth watching, Minor, Not yet
 * scored). Array.sort is stable, so risks that tie keep their incoming order
 * (the server returns them oldest first).
 */
export function sortRisks(risks) {
  return [...risks].sort((a, b) => {
    const ca = isCritical(a) ? 0 : 1;
    const cb = isCritical(b) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const sa = SEVERITY_RANK[deriveSeverity(a.likelihood, a.impact).key];
    const sb = SEVERITY_RANK[deriveSeverity(b.likelihood, b.impact).key];
    return sa - sb;
  });
}

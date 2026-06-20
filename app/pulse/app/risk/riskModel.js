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
 * Severity is DERIVED, never stored, and now lives in the engine
 * (lib/engine/severity.js): deriveSeverity and SEVERITY_RANK are defined there
 * and re-exported below, so Programme and Dashboard can read severity from the
 * engine without importing from risk/, and existing importers of riskModel keep
 * working unchanged. sortRisks below uses those re-exported symbols, so there is
 * still one definition.
 *
 * Criticality is the Brief's definition reused verbatim: a risk is critical
 * when its `criticality` column is 'critical' (the cascade sets this from the
 * objective it threatens). The register never computes a second definition,
 * so its critical count always agrees with the Brief's Critical risks KPI.
 */

import { deriveSeverity, SEVERITY_RANK } from '../../../../lib/engine/severity.js';

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

// Severity now lives in the engine (lib/engine/severity.js); re-exported here so
// importers still pointing at riskModel keep working, and sortRisks below reads
// the one definition.
export { deriveSeverity, SEVERITY_RANK };

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

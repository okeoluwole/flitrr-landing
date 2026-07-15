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
 * Criticality has two deliberately distinct reads (B1). The LIVE read,
 * isLiveCritical, derives a risk's criticality from the objective it threatens
 * via the engine kernel: critical when that objective is currently
 * non-negotiable. This is what the register monitors on, so the cascade follows
 * the current classification. The BASELINE read, isBaselineCritical, returns the
 * stored criticality column stamped at creation and frozen into the locked
 * Brief; read it only when you explicitly want that baseline. The two agree
 * except where an objective was reclassified after the wizard stamped the risk.
 */

import { deriveSeverity, SEVERITY_RANK } from '../../../../lib/engine/severity.js';
import {
  CRITICALITY,
  deriveCriticality,
} from '../../../../lib/engine/criticality.js';

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

// The locked-state copy, the one string shared by the workspace Risk tile and
// the Risk page's own guard so the two can never disagree (M9.4). Risk re-gates
// on the Brief lock: it is a baselining act and opens the moment the Brief
// locks, not at the later gate.
export const RISK_LOCKED_COPY = 'Risk monitoring opens once you lock your Brief.';

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

// A risk's LIVE criticality, derived from the objective it threatens via the
// kernel: critical when that objective is currently non-negotiable. This is the
// register's working read (B1); it follows the current classification, so it can
// differ from the stored baseline where the objective was reclassified after the
// wizard stamped the risk. objectivesById is the project's objective index
// (id -> { classification }).
export function isLiveCritical(risk, objectivesById) {
  return (
    deriveCriticality(risk.linked_objective_id, objectivesById) ===
    CRITICALITY.CRITICAL
  );
}

// A risk's BASELINE criticality: the stored criticality column stamped at
// creation and frozen into the locked Brief. Read this only when you explicitly
// want the baseline; every live monitoring read uses isLiveCritical instead, so
// the stored snapshot can never be mistaken for the current classification.
export function isBaselineCritical(risk) {
  return risk.criticality === 'critical';
}

/**
 * Sort for the register: criticality first (critical, protected-objective
 * risks at the top), then severity (Serious, Worth watching, Minor, Not yet
 * scored). Criticality is the LIVE value (B1), so a risk whose objective was
 * reclassified sorts by where it stands now, not by the stored snapshot.
 * Array.sort is stable, so risks that tie keep their incoming order (the server
 * returns them oldest first).
 */
export function sortRisks(risks, objectivesById) {
  return [...risks].sort((a, b) => {
    const ca = isLiveCritical(a, objectivesById) ? 0 : 1;
    const cb = isLiveCritical(b, objectivesById) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const sa = SEVERITY_RANK[deriveSeverity(a.likelihood, a.impact).key];
    const sb = SEVERITY_RANK[deriveSeverity(b.likelihood, b.impact).key];
    return sa - sb;
  });
}

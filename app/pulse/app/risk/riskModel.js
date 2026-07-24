/**
 * Risk register model (M6.1). Pure, deterministic helpers shared by the
 * server page and the client register. No AI, no state, no side effects.
 *
 * Likelihood and impact reuse the existing project_risks scale (the risk_level
 * enum: low, medium, high), relabelled in plainer language
 * (Unlikely/Possible/Likely and Limited/Significant/Severe) while storing the
 * same values, so the Brief snapshot, the wizard, and the register all read the
 * same column. Note 19 moved those labels down into lib/engine/severity.js and
 * pointed the Step 8 capture at them too, so the two surfaces that write this
 * one scale now speak one vocabulary; they are re-exported below unchanged.
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

import {
  deriveSeverity,
  SEVERITY_RANK,
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
} from '../../../../lib/engine/severity.js';
import {
  CRITICALITY,
  deriveCriticality,
} from '../../../../lib/engine/criticality.js';

// The likelihood and impact scales now live in the engine beside the severity
// they feed (Note 19), so the Step 8 capture and this register read one set of
// labels instead of two. Re-exported here because the register and the tests
// import them from this model; the values are unchanged.
export { LIKELIHOOD_OPTIONS, IMPACT_OPTIONS };

// The register's locked-state copy is no longer this module's (Note 13). All
// three monitoring modules are gated by the same fixed sequence and share one
// honest line, workspace/sequenceModel.js moduleLockedLine, which the tile and
// the page's own guard both read.

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

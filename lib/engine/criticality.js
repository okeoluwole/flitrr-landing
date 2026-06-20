/**
 * The criticality kernel (engine consolidation, Step A2). The single, pure
 * source of the Flitrr Framework's criticality rule: an item's criticality is
 * derived from the objective it serves, read live from that objective's current
 * classification, never re-entered independently. No DB, no React, no network,
 * no system clock, so the same inputs always give the same verdict and the
 * whole module is unit-testable in isolation.
 *
 * This module is additive. It is written to reproduce, exactly, the behaviour
 * spread across the modules today, so the later steps can route those call
 * sites through it with no change in output:
 *   - riskMonitor.effectiveCriticality (live, by id)        -> deriveCriticality
 *   - actionModel.derivedCriticality / effectiveCriticality -> deriveCriticality
 *     / effectiveCriticality (with the downward-only override)
 *   - listStepConfig.cascadeCriticality (write-time stamp)  -> toStoredCriticality
 *   - playbookModel.derivePlayCriticality (by objective_type) -> classifyByType
 * along with the duplicated CRITICALITY and CRITICALITY_RANK constants and the
 * per-page objective-index builders.
 *
 * THE BASELINE VS LIVE RULE, in one place. Criticality is derived live from the
 * linked objective (deriveCriticality). The stored criticality_level column is
 * the read-only baseline, the value stamped at creation (toStoredCriticality)
 * and frozen into the locked Brief; no live decision reads it. The only
 * adjustment is a downward-only, reason-tagged override (applyDownwardOverride):
 * honoured solely while the derived value is critical, so it can lower critical
 * to standard but can never raise, and a stale override on an item whose link is
 * no longer critical falls inert. The reason is stored and shown by the caller;
 * the kernel takes only the override value.
 */

// The criticality vocabulary. 'critical' and 'standard' are the binary scheme
// stored in the criticality_level enum; 'unlinked' is the derived-only
// governance gap (no objective to inherit from), surfaced as "needs a link" and
// never stored.
export const CRITICALITY = {
  CRITICAL: 'critical',
  STANDARD: 'standard',
  UNLINKED: 'unlinked',
};

// Attention order by criticality: critical first, then unlinked (a governance
// gap that can hide a critical item, so it sits above standard), then standard.
// These rank the attention list; they are not thresholds.
export const CRITICALITY_RANK = {
  [CRITICALITY.CRITICAL]: 0,
  [CRITICALITY.UNLINKED]: 1,
  [CRITICALITY.STANDARD]: 2,
};

// The one objective classification that confers criticality (the
// objective_classification enum's non-negotiable value).
const NON_NEGOTIABLE = 'non_negotiable';

/**
 * Index a project's objective rows for the derivations and for display. Returns
 * { byId, byType }, both keyed into the SAME normalised entry so a caller can
 * look an objective up by its id (the link a risk, action, milestone,
 * workstream, or RAID item carries) or by its objective_type (the key a
 * playbook play carries). Each entry is { id, type, classification, name },
 * where name is resolved from the optional nameByType map (the kernel holds no
 * display strings of its own) and is null when none is given.
 *
 * Accepts the project_objectives row shape { id, objective_type, classification }.
 * Rows without an id are skipped (nothing can link to them).
 */
export function buildObjectiveIndex(objectives, nameByType) {
  const byId = {};
  const byType = {};
  for (const o of objectives ?? []) {
    if (!o || !o.id) continue;
    const type = o.objective_type ?? null;
    const entry = {
      id: o.id,
      type,
      classification: o.classification,
      name: nameByType && type ? nameByType[type] ?? null : null,
    };
    byId[o.id] = entry;
    if (type) byType[type] = entry;
  }
  return { byId, byType };
}

/**
 * The live criticality of an item from the objective it serves, by the
 * objective's id. Returns:
 *   'critical'  the linked objective is non-negotiable
 *   'standard'  the linked objective is flexible (any non non-negotiable value)
 *   'unlinked'  no link, or the link does not resolve in byId: a governance gap,
 *               never a silent standard
 * byId is the index from buildObjectiveIndex, or any map of objective id ->
 * { classification }.
 */
export function deriveCriticality(linkedObjectiveId, byId) {
  const objective = linkedObjectiveId ? byId?.[linkedObjectiveId] : null;
  if (!objective) return CRITICALITY.UNLINKED;
  return objective.classification === NON_NEGOTIABLE
    ? CRITICALITY.CRITICAL
    : CRITICALITY.STANDARD;
}

/**
 * Apply a downward-only override to a derived criticality. The override is
 * honoured ONLY when the derived value is critical and the override asks for
 * standard, so it can lower critical to standard and can never raise. Any other
 * override value, or an override on a non-critical derivation, is ignored, which
 * is what keeps a stale override inert once the link is no longer critical. The
 * derived value is returned unchanged in every other case.
 */
export function applyDownwardOverride(derived, override) {
  return derived === CRITICALITY.CRITICAL && override === CRITICALITY.STANDARD
    ? CRITICALITY.STANDARD
    : derived;
}

/**
 * The criticality every live decision reads: derived from the linked objective,
 * lowered to standard only by an active downward override. Never raised, never
 * reads the stored snapshot. `override` is the item's criticality_override value
 * (null when none).
 */
export function effectiveCriticality(linkedObjectiveId, byId, override) {
  return applyDownwardOverride(
    deriveCriticality(linkedObjectiveId, byId),
    override
  );
}

/**
 * The stored, baseline criticality stamped at creation: the cascade value the
 * wizard and the Action Log write into the criticality_level column. It is the
 * live derivation collapsed to the binary enum the column allows, so an unlinked
 * item stores 'standard' (the column cannot hold 'unlinked'). This is the only
 * derivation that writes; every other reads live.
 */
export function toStoredCriticality(linkedObjectiveId, byId) {
  return deriveCriticality(linkedObjectiveId, byId) === CRITICALITY.CRITICAL
    ? CRITICALITY.CRITICAL
    : CRITICALITY.STANDARD;
}

/**
 * Criticality for a curated playbook play, keyed by objective_type rather than
 * by a concrete objective id (a play references a type; the project supplies the
 * row). A play is critical when it is marked always_critical, or when the
 * project's objective of that type is non-negotiable. Otherwise standard. Plays
 * are never 'unlinked': a play always names a valid objective_type, and a
 * project that lacks that type's row defaults to standard.
 *
 * byType is the index from buildObjectiveIndex, or any map of objective_type ->
 * { classification }. options.alwaysCritical is the play's always_critical flag.
 */
export function classifyByType(objectiveType, byType, options) {
  if (options?.alwaysCritical === true) return CRITICALITY.CRITICAL;
  const objective = objectiveType ? byType?.[objectiveType] : null;
  return objective?.classification === NON_NEGOTIABLE
    ? CRITICALITY.CRITICAL
    : CRITICALITY.STANDARD;
}

/**
 * Action readiness (engine consolidation, Step A8). The pure, action-shaped
 * helpers the Action Log and the weekly digest read to ask the operational
 * questions: is this action done, what stage does it bear on, is it critical,
 * and how ready is a project's current gate. No DB, no React, no network, no
 * system clock, so the same inputs always give the same verdict.
 *
 * These moved down out of app/pulse/app/actions/actionModel.js (A8) so that
 * lib/digest can reach them without reaching up into the app layer: the digest
 * now depends only on lib/engine, a clean same-layer dependency, and the one
 * remaining inverted import is gone. actionModel re-exports all four, so the
 * Action Log and the workspace keep importing them from there unchanged.
 *
 * Criticality is never re-decided here. isCritical and gateReadiness defer to
 * the criticality kernel (lib/engine/criticality.js) for the live,
 * override-aware verdict, so this module and the kernel can never disagree.
 *
 * HELD ACTION-SHAPED (A8, as A7). These helpers stay shaped to an action: a row
 * carrying status, stage, linked_objective_id, and criticality_override. They
 * are not generalised to Programme's notion of an open item bearing on the
 * current stage. The second consumer this shape waited for now exists: the
 * Dashboard's Band 1 gate fact (M9.2) reads gateReadiness exactly as the
 * Action Log and the digest do, action rows in, { open, critical } out, and
 * needed no generalisation. Any further reshaping waits for a consumer whose
 * items are not actions.
 */

import {
  CRITICALITY,
  effectiveCriticality as kernelEffectiveCriticality,
} from './criticality.js';

// Done actions leave the default list and sit under the done filter.
export function isDone(action) {
  return action.status === 'done';
}

/**
 * The lifecycle stage an action bears on (A3). A null stage (rows created
 * before A3 stamped it) reads as the current stage, so no action drops out of
 * the gate-readiness view.
 */
export function actionStage(action, currentStage) {
  return action?.stage == null ? currentStage : action.stage;
}

/**
 * Whether an action is critical: its live criticality, derived from the linked
 * objective and lowered only by an active downward override, is critical.
 * Defers to the kernel by the action's link and override, the same computation
 * actionModel.effectiveCriticality runs, so the log and the digest order,
 * count, and style by the live value, never the stored snapshot.
 */
export function isCritical(action, byId) {
  return (
    kernelEffectiveCriticality(
      action?.linked_objective_id,
      byId,
      action?.criticality_override
    ) === CRITICALITY.CRITICAL
  );
}

/**
 * Gate readiness (A3): the open actions that bear on the current stage's gate,
 * and how many of them are critical. Scoped to open actions on the current
 * stage; a done action has left, and an action stamped to another stage bears
 * on that stage's gate, not this one. Proportional monitoring foregrounds the
 * critical count. This is the operational face of the stage checklist, not the
 * full deliverables checklist, which is the Gate module's.
 */
export function gateReadiness(actions, byId, currentStage) {
  const bearing = (actions ?? []).filter(
    (a) => !isDone(a) && actionStage(a, currentStage) === currentStage
  );
  return {
    open: bearing.length,
    critical: bearing.filter((a) => isCritical(a, byId)).length,
  };
}

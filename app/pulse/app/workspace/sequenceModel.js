/**
 * The workspace sequence model (Note 13). The single place the project's FIXED
 * PATH is derived: after the Brief locks, a project runs one ordered route, not
 * an open tile hub. Pure and deterministic: no DB, no React, no clock, and no
 * stage number anywhere in the logic.
 *
 * THE SEQUENCE, and why it is this order:
 *
 *   1. Brief              define the project and lock the baseline
 *   2. Programme set-up   reconcile the dates, then lock the operational
 *                         baseline (v1)
 *   3. The gate           the deliberate go decision out of the current stage
 *   4. The modules        Action Log, Risk register, Project dashboard
 *
 * The gate sits AFTER Programme set-up because a gate has two parts, and the
 * second is the objective lens: do the classified objectives remain achievable,
 * and has anything put a non-negotiable objective at risk. That question cannot
 * be answered honestly with unreconciled dates in hand. Set-up is what turns the
 * Brief's aspirations into an operational baseline, so the gate is only credible
 * once it has run.
 *
 * The three monitoring modules open LAST because all three read the operational
 * baseline (the module pattern: read the baseline, derive criticality from the
 * objective served, flag proportionally). Before the baseline exists there is
 * nothing to read, so a module that renders anyway must invent its numbers. That
 * is exactly what the end-to-end test caught: "14 need your response" and a
 * compromised banner, both shown before Programme set-up had ever run. A locked
 * module with an honest line is the truthful state, and it is not a dead end: it
 * says which step opens it.
 *
 * ENTRY-STAGE INDEPENDENT BY CONSTRUCTION. Nothing here reads current_stage or
 * compares against Stage 1. The sequence takes three booleans and returns a
 * step; deriveGateConfirmed answers "has this project passed a gate to reach
 * where it is" from the project's own gate rows, whatever stage it entered at.
 * A later session (Note 12) lets a developer adopt PULSE mid-lifecycle, and this
 * sequence does not need to change to allow it.
 */

/**
 * The one step a project is on. Exactly one is current at any moment: that is
 * what makes this a sequence rather than a hub.
 */
export const SEQUENCE_STEPS = Object.freeze({
  BRIEF: 'brief',
  PROGRAMME_SETUP: 'programme_setup',
  GATE: 'gate',
  MODULES: 'modules',
});

/**
 * Has this project passed a gate to reach where it stands? The go decision is
 * recorded on the gate row for the stage being CLOSED, and passing it advances
 * current_stage, so a passed gate below the current stage is the trace of a
 * deliberate decision having been made.
 *
 * Stage-agnostic on purpose: it takes the stages whose gate rows read passed and
 * the stage the project now sits on, and never a constant of its own. A project
 * adopted at Stage 4 records its go on the stage 4 row and advances to 5,
 * reading confirmed by the same rule that serves a Stage 1 project.
 */
export function deriveGateConfirmed({ currentStage, passedGateStages }) {
  if (typeof currentStage !== 'number') return false;
  if (!Array.isArray(passedGateStages)) return false;
  return passedGateStages.some(
    (stage) => typeof stage === 'number' && stage < currentStage
  );
}

/**
 * The step the project is on, from the three locks and decisions that move it.
 * The whole sequence logic, in four lines.
 */
export function deriveSequenceStep({ briefLocked, baselineLocked, gateConfirmed }) {
  if (!briefLocked) return SEQUENCE_STEPS.BRIEF;
  if (!baselineLocked) return SEQUENCE_STEPS.PROGRAMME_SETUP;
  if (!gateConfirmed) return SEQUENCE_STEPS.GATE;
  return SEQUENCE_STEPS.MODULES;
}

/**
 * Are the monitoring modules open? Only on the last step, when the operational
 * baseline exists for them to read and the go decision has been taken.
 */
export function modulesOpen(step) {
  return step === SEQUENCE_STEPS.MODULES;
}

/**
 * The honest line a locked module carries, naming the step that opens it rather
 * than saying "coming soon" or showing an invented count. One line per step, so
 * a developer always knows what they are waiting on and what to do next.
 *
 * The wording is deliberately the same for all three modules: they are gated by
 * the sequence, not by anything specific to Risk or the Action Log, and one
 * shared line is the truth about that.
 */
export const MODULE_LOCKED_LINE = Object.freeze({
  [SEQUENCE_STEPS.BRIEF]:
    'Opens after you lock your Brief and Programme set-up locks the operational baseline.',
  [SEQUENCE_STEPS.PROGRAMME_SETUP]:
    'Opens after Programme set-up locks the operational baseline.',
  [SEQUENCE_STEPS.GATE]:
    'Opens once you confirm the gate into the next stage.',
});

export function moduleLockedLine(step) {
  return MODULE_LOCKED_LINE[step] ?? MODULE_LOCKED_LINE[SEQUENCE_STEPS.PROGRAMME_SETUP];
}

/**
 * The state every monitoring module tile reads, in the tile's own vocabulary.
 * All three move together, because all three read the same baseline.
 */
export function deriveModuleStates(step) {
  const state = modulesOpen(step) ? 'open' : 'locked';
  return { actionLog: state, risk: state, dashboard: state };
}

/**
 * The single next step, as the workspace presents it: what it is called, the one
 * line explaining why it comes now, and the call to action. The href is built by
 * the caller from the project id, because this model holds no routes.
 *
 * MODULES has no next step: the sequence is complete and the workspace becomes
 * the launcher it always was.
 */
export const NEXT_STEP = Object.freeze({
  [SEQUENCE_STEPS.BRIEF]: Object.freeze({
    eyebrow: 'Next step',
    title: 'Lock your Brief',
    body: 'Finish the nine-step initiation and lock the baseline. Everything after this reads from it.',
    cta: 'Open the Brief',
  }),
  [SEQUENCE_STEPS.PROGRAMME_SETUP]: Object.freeze({
    eyebrow: 'Next step',
    title: 'Programme set-up',
    body: 'Reconcile your dates, then lock the operational baseline your delivery is tracked against.',
    cta: 'Start Programme set-up',
  }),
  [SEQUENCE_STEPS.GATE]: Object.freeze({
    eyebrow: 'Next step',
    title: 'Confirm the gate',
    body: 'Your baseline is set, so the objective lens can be answered honestly. Confirm the go decision to advance the stage.',
    cta: 'Open the gate',
  }),
});

export function nextStep(step) {
  return NEXT_STEP[step] ?? null;
}

/**
 * The route the current step opens, built from the project id. Held here so the
 * workspace panel, the Brief's own next-step block and the module pages cannot
 * drift apart on where the sequence points.
 *
 * The gate route is the Gate 1 to 2 review, the one gate transition with a
 * review surface today. When a later session gives the other transitions their
 * own surfaces, this is the one function that learns about them.
 */
export function stepHref(step, projectId) {
  if (typeof projectId !== 'string' || projectId.trim() === '') return null;
  switch (step) {
    case SEQUENCE_STEPS.BRIEF:
      return `/pulse/app/initiate?project=${projectId}`;
    case SEQUENCE_STEPS.PROGRAMME_SETUP:
      return `/pulse/app/programme/setup?project=${projectId}`;
    case SEQUENCE_STEPS.GATE:
      return `/pulse/app/gate?project=${projectId}`;
    default:
      return null;
  }
}

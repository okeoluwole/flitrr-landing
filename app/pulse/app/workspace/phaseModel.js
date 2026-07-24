/**
 * The workspace phase model (M9.4). The single place the project's set-up PHASE
 * is derived, and the one mapping from that phase to what each workspace tile
 * does. Pure and deterministic: no DB, no React, no clock, and never
 * current_stage.
 *
 * The phase is a derived reading of where a project sits in its own set-up, a
 * pure function of two locks the workspace already reads: whether the Brief is
 * locked, and whether a Programme baseline is locked.
 *
 *   not briefLocked                 -> Define  (the project is being defined)
 *   briefLocked, no baseline        -> Plan    (the project is being planned)
 *   briefLocked, baseline locked    -> Run     (the project is being delivered)
 *
 * DERIVED ON EVERY READ, NEVER STORED. This matters because of two reversible
 * states. Plan is reversible: the Brief can be reopened before the gate, moving
 * a project Plan back to Define, and a stored phase would go stale on unlock. A
 * derived one cannot.
 *
 * THE REOPENED BRIEF is the second. briefLocked = false with a baseline present
 * (lock the Programme, then reopen the Brief) reads Define, and that is correct:
 * the Brief is the project spine, so if it is open the project is being
 * redefined, whatever else exists. Not an edge case, not an error: Define. The
 * derivation handles it for free.
 *
 * THE PHASE IS NEVER DERIVED FROM current_stage. current_stage can be 1 in all
 * three phases, so it carries no phase information. Each lock opens the next
 * phase. The gate (Gate 1 to 2, which advances current_stage) is a separate,
 * deliberate act; it governs the Action Log alone, not the phase.
 */

export const PHASES = Object.freeze({
  DEFINE: 'define',
  PLAN: 'plan',
  RUN: 'run',
});

/**
 * The derivation, and it is the whole logic: two locks in, one phase out.
 */
export function derivePhase({ briefLocked, hasBaseline }) {
  if (!briefLocked) return PHASES.DEFINE;
  if (!hasBaseline) return PHASES.PLAN;
  return PHASES.RUN;
}

/**
 * The two surfaces a project can land on when it is opened.
 */
export const SURFACES = Object.freeze({
  WORKSPACE: 'workspace',
  DASHBOARD: 'dashboard',
});

/**
 * The landing decision (M9.5): which surface a project opens to. A pure
 * function of the phase, so it is DERIVED ON EVERY REQUEST, never stored. That
 * is the whole point: the moment a lock changes the landing changes with it,
 * with nothing to go stale. Reopen the Brief on a project in Run and the phase
 * drops to Define (an open Brief reads Define, baseline or not), so the same
 * project now lands on the workspace again, for free.
 *
 *   Define -> workspace  (the project is being defined)
 *   Plan   -> workspace  (the project is being planned)
 *   Run    -> dashboard  (the project is being delivered)
 *
 * In Run the workspace does not disappear; it becomes the route to the modules,
 * one tap back from the dashboard. viewWorkspace carries that tap: the dashboard
 * back-link asks for the workspace explicitly, and an explicit ask always
 * returns the workspace, whatever the phase. This is the anti-loop mechanism. A
 * bare open in Run lands on the dashboard; the dashboard's back-link is not a
 * bare open, so it is not bounced back, and a developer in Run can always reach
 * the modules.
 */
export function deriveLanding({ phase, viewWorkspace = false }) {
  if (viewWorkspace) return SURFACES.WORKSPACE;
  return phase === PHASES.RUN ? SURFACES.DASHBOARD : SURFACES.WORKSPACE;
}

/*
 * The tile-state mapping that used to live here is superseded by the fixed
 * sequence (Note 13, workspace/sequenceModel.js deriveModuleStates). The three
 * monitoring modules no longer open at different moments: all three read the
 * operational baseline, so all three open together once it is locked and the
 * gate is confirmed. The phase still governs how the workspace SPEAKS (the
 * intro line) and where a project LANDS; what is open is the sequence's.
 */

/**
 * The workspace intro line, one per phase, so the guidance speaks to where the
 * project actually is rather than telling a developer in delivery to set up a
 * baseline they locked weeks ago: define the project, plan it and score the
 * risks, or read where a project in delivery stands.
 *
 * PROVISIONAL WORDING. The sense per phase is fixed here (M9.4 Task 4); the
 * exact wording is Olu's redline against the render.
 */
export const PHASE_INTRO = Object.freeze({
  [PHASES.DEFINE]:
    'Define the project in the Brief: its objectives, scope, and the baseline every module reads from.',
  [PHASES.PLAN]:
    'The Brief is locked. Plan the programme and score the risks to your objectives, then lock a baseline to start tracking.',
  [PHASES.RUN]:
    'The project is in delivery. Here is where it stands against the objectives you set.',
});

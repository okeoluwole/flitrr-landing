/**
 * The stage-state model (Step 7 stage-window fix, note 6). The one engine
 * concern that answers a single question for every lifecycle stage: how does
 * this stage sit in time relative to the rest of the programme? Every
 * stage-window reader consumes it, so the answer is given once and never
 * re-derived per surface.
 *
 * WHY THIS EXISTS. The programme derivations were built on one implicit
 * assumption: every stage runs strictly after the one before it, so a stage's
 * window is always [previous gate, own gate]. That holds for stages 0 to 6. It
 * does not hold for Sales and Disposal (stage 7). The Flitrr Framework tailors
 * within discipline, and its geography section is explicit: in off-plan markets
 * sales run concurrently with earlier stages, and in Nigeria stage 7 frequently
 * runs concurrent with construction rather than after it. Under the strict
 * assumption a developer could not date "First unit exchanged" anywhere except
 * after practical completion, which is not what an off-plan scheme does. The
 * fix is to make the assumption explicit and per stage, not to loosen the
 * validation everywhere.
 *
 * THE THREE STATES (STAGE_STATE):
 *   - sequential. The default and the only state for stages 0 to 6. The stage
 *     runs after the previous applicable gate, and its window is bounded below
 *     by that gate and above by its own. Strict, unchanged.
 *   - concurrent. The stage overlaps the stages it runs alongside. Its window
 *     opens at a declared earlier point (its window anchor) and still closes at
 *     its own gate, so its internal dates can range across the whole programme.
 *     Its gate is unchanged: a gate still closes its stage in sequence, because
 *     final disposal genuinely follows handover. What moves is where the stage
 *     STARTS, and therefore where its milestones may fall.
 *   - complete. The stage was already finished before the project entered
 *     PULSE. Its dates are history, not a plan, so nothing advises a date for
 *     it, nothing benchmarks its duration, and its window has no lower bound.
 *     The state is modelled here in full; setting it from a declared current
 *     stage is note 12 and is not wired yet. A caller supplies it explicitly
 *     through baseline.completedStages until then.
 *
 * NO MANUAL TOGGLE. Concurrency is derived from the baseline, never chosen by
 * the developer in a switch. Principle 6, tailoring within discipline: the
 * geography and the funding shape change the detail, and the developer does not
 * get to relax the gate logic by hand. The two triggers are read straight off
 * the baseline the Brief already holds:
 *   - the Financial Baseline's funding structure is off-plan presales
 *     (project_budget.funding_structure_type = 'off_plan_presales'), or
 *   - the project country is Nigeria (projects.country = 'nigeria').
 * Either one is sufficient. Both may be true.
 *
 * WHERE THE CONCURRENT WINDOW OPENS. A concurrent stage names the gate its
 * window opens at, in CONCURRENCY_RULES. Stage 7 opens at the stage 3 gate,
 * Design and Planning Approvals: a scheme cannot be marketed off-plan before it
 * is consented, so consent is the earliest honest sales launch. The window is
 * therefore launch to the stage 7 gate, which is the whole remaining programme,
 * and not "any date at all", which would be no validation.
 *
 * Pure data and pure functions. No DB, no React, no network, no clock, so the
 * same baseline always gives the same states and the whole module is testable
 * in isolation. It classifies; it stores nothing and it decides no dates. The
 * date derivations that consume it live in programmeSchedule.js,
 * programmeMilestones.js, programmeRealityCheck.js and programmeAssembly.js.
 */

// The three states a stage can hold. Frozen so a consumer cannot mutate the
// vocabulary.
export const STAGE_STATE = Object.freeze({
  SEQUENTIAL: 'sequential',
  CONCURRENT: 'concurrent',
  COMPLETE: 'complete',
});

// What turned a state on, carried for traceability so a surface can explain
// itself and a test can assert the reason rather than just the outcome.
export const STATE_TRIGGER = Object.freeze({
  OFF_PLAN_PRESALES: 'off_plan_presales',
  NIGERIA: 'nigeria',
  DECLARED_COMPLETE: 'declared_complete',
});

// How a stage's window start is anchored. A sequential stage anchors on
// whatever the previous applicable gate turns out to be, which is dynamic, so
// it names no stage. A concurrent stage names the gate it opens at. A complete
// stage has no lower bound at all.
export const WINDOW_ANCHOR_KIND = Object.freeze({
  PREVIOUS_GATE: 'previous_gate',
  STAGE_GATE: 'stage_gate',
  OPEN: 'open',
});

// The baseline value that marks an off-plan funding structure, matching the
// funding_structure_type enum (migration 015) exactly.
const OFF_PLAN_PRESALES = 'off_plan_presales';

// The baseline value that marks Nigeria, matching the project_country enum
// (migration 015) exactly.
const NIGERIA = 'nigeria';

/**
 * The declarative concurrency rules: which stage becomes concurrent, which
 * gate its window opens at, and how that opening reads in copy. One entry
 * today, stage 7. The table is the extension point: a later stage that proves
 * concurrent under some baseline condition is added here, and every window
 * reader picks it up with no change of its own.
 *
 * anchorStage is the stage whose GATE opens the concurrent window, not the
 * stage the window starts inside. Stage 7 opening at the stage 3 gate means
 * "from the moment planning and statutory approvals close".
 */
export const CONCURRENCY_RULES = Object.freeze([
  Object.freeze({
    stage: 7,
    anchorStage: 3,
    anchorLabel: 'sales launch',
  }),
]);

// The rule for a stage, or undefined. Small enough to scan; kept as a lookup so
// a longer table stays cheap.
const RULE_BY_STAGE = new Map(CONCURRENCY_RULES.map((r) => [r.stage, r]));

/**
 * Which baseline trigger, if any, makes a concurrency rule apply. Returns the
 * trigger identifier or null. The funding shape is checked first so an off-plan
 * scheme reports the funding reason wherever both are true, because the funding
 * structure is the sharper statement of intent: a UK off-plan scheme is
 * concurrent for the same reason a Lagos one is.
 *
 * baseline  { fundingStructureType, country }, read straight off the Brief's
 *           record: project_budget.funding_structure_type and projects.country.
 *           Values are compared case-insensitively after trimming, so a value
 *           that arrives with stray whitespace still matches.
 */
export function concurrencyTrigger(baseline) {
  const funding = normalise(baseline?.fundingStructureType);
  if (funding === OFF_PLAN_PRESALES) return STATE_TRIGGER.OFF_PLAN_PRESALES;
  const country = normalise(baseline?.country);
  if (country === NIGERIA) return STATE_TRIGGER.NIGERIA;
  return null;
}

// Trim and lower-case an enum-shaped value, or null. An absent or blank value
// is simply "not set", which triggers nothing.
function normalise(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s === '' ? null : s;
}

// The default state: strictly sequential, anchored on the previous applicable
// gate, no trigger. This is what every stage reads as when no states are
// supplied, so a caller that passes nothing behaves exactly as the strict model
// always did.
function sequentialState(stage) {
  return {
    stage,
    state: STAGE_STATE.SEQUENTIAL,
    windowAnchor: { kind: WINDOW_ANCHOR_KIND.PREVIOUS_GATE, stage: null },
    windowAnchorLabel: null,
    trigger: null,
  };
}

/**
 * Derive the state of every stage in the template from the project's baseline.
 *
 * template  the programme template (PROGRAMME_TEMPLATE), or any object with the
 *           same { stages: [{ stage }] } shape.
 * baseline  the values read off the locked Brief's record:
 *             fundingStructureType  project_budget.funding_structure_type
 *             country               projects.country
 *             completedStages       optional iterable of stage numbers already
 *                                   finished before the project entered PULSE.
 *                                   Note 12 will fill this from the declared
 *                                   current stage; until then a caller supplies
 *                                   it or omits it.
 *
 * Precedence, where more than one could apply: complete beats concurrent beats
 * sequential. A stage that is already finished is history whatever its normal
 * relationship to the programme would have been.
 *
 * Returns:
 *   {
 *     stages: [
 *       {
 *         stage,
 *         state,               'sequential' | 'concurrent' | 'complete'
 *         windowAnchor,        { kind, stage }  where the window opens
 *         windowAnchorLabel,   short label for the opening, or null
 *         trigger,             what turned the state on, or null
 *       }
 *     ]
 *   }
 */
export function deriveStageStates(template, baseline) {
  const completed = new Set(baseline?.completedStages ?? []);
  const trigger = concurrencyTrigger(baseline);

  const stages = (template?.stages ?? []).map((stageDef) => {
    const stage = stageDef.stage;

    if (completed.has(stage)) {
      return {
        stage,
        state: STAGE_STATE.COMPLETE,
        windowAnchor: { kind: WINDOW_ANCHOR_KIND.OPEN, stage: null },
        windowAnchorLabel: null,
        trigger: STATE_TRIGGER.DECLARED_COMPLETE,
      };
    }

    const rule = RULE_BY_STAGE.get(stage);
    if (rule && trigger != null) {
      return {
        stage,
        state: STAGE_STATE.CONCURRENT,
        windowAnchor: {
          kind: WINDOW_ANCHOR_KIND.STAGE_GATE,
          stage: rule.anchorStage,
        },
        windowAnchorLabel: rule.anchorLabel,
        trigger,
      };
    }

    return sequentialState(stage);
  });

  return { stages };
}

/**
 * Normalise supplied stage states into a stage-keyed lookup. Accepts the states
 * object ({ stages: [...] }, as deriveStageStates returns), a plain array of
 * per-stage states, or nothing. Mirrors the lookup helpers in the sibling
 * engines so every consumer takes its states the same way.
 */
export function stageStateLookup(stageStates) {
  const list = Array.isArray(stageStates)
    ? stageStates
    : (stageStates?.stages ?? []);
  const lookup = new Map();
  for (const entry of list) {
    if (entry == null || entry.stage == null) continue;
    lookup.set(entry.stage, entry);
  }
  return lookup;
}

/**
 * The state of one stage from a lookup, defaulting to strictly sequential. This
 * default is what keeps every consumer backwards compatible: a caller that
 * supplies no states gets the strict sequential model it always had, on every
 * stage, with no branching of its own.
 */
export function stageStateFor(lookup, stage) {
  return lookup?.get?.(stage) ?? sequentialState(stage);
}

/** True when a stage overlaps the stages it runs alongside. */
export function isConcurrent(stageState) {
  return stageState?.state === STAGE_STATE.CONCURRENT;
}

/** True when a stage was already finished before the project entered PULSE. */
export function isComplete(stageState) {
  return stageState?.state === STAGE_STATE.COMPLETE;
}

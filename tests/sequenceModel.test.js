import { describe, it, expect } from 'vitest';
import {
  SEQUENCE_STEPS,
  deriveGateConfirmed,
  deriveSequenceStep,
  modulesOpen,
  moduleLockedLine,
  deriveModuleStates,
  MODULE_LOCKED_LINE,
  NEXT_STEP,
  nextStep,
  stepHref,
} from '../app/pulse/app/workspace/sequenceModel.js';

/**
 * The workspace sequence model (Note 13). Proves the fixed path: after the Brief
 * locks a project runs Brief, then Programme set-up and the operational baseline
 * lock, then the gate, then the modules, and exactly one step is current at any
 * moment.
 *
 * The two claims that matter most are the ones the end-to-end test forced:
 *   - the three monitoring modules stay LOCKED until the operational baseline
 *     exists, so nothing can render a count, an alarm state or a queue against a
 *     baseline that has not been set;
 *   - the gate comes AFTER Programme set-up, because its objective lens cannot
 *     be answered honestly on unreconciled dates.
 *
 * And one structural claim: nothing here reads a stage constant, so a project
 * adopted mid-lifecycle (a later session) needs no change to this model.
 */

const PID = '7cbb767e-0000-4000-8000-000000000000';

// The four positions a project can be in, named as the workspace sees them.
const DEFINING = { briefLocked: false, baselineLocked: false, gateConfirmed: false };
const PLANNING = { briefLocked: true, baselineLocked: false, gateConfirmed: false };
const AT_GATE = { briefLocked: true, baselineLocked: true, gateConfirmed: false };
const RUNNING = { briefLocked: true, baselineLocked: true, gateConfirmed: true };

describe('the sequence: one step at a time, in a fixed order', () => {
  it('runs Brief, then Programme set-up, then the gate, then the modules', () => {
    expect(deriveSequenceStep(DEFINING)).toBe(SEQUENCE_STEPS.BRIEF);
    expect(deriveSequenceStep(PLANNING)).toBe(SEQUENCE_STEPS.PROGRAMME_SETUP);
    expect(deriveSequenceStep(AT_GATE)).toBe(SEQUENCE_STEPS.GATE);
    expect(deriveSequenceStep(RUNNING)).toBe(SEQUENCE_STEPS.MODULES);
  });

  it('holds the Brief step while the Brief is open, whatever else exists', () => {
    // The reopened Brief: the baseline is locked and the gate is passed, but the
    // Brief is open, so the project is being redefined and the sequence restarts
    // at the Brief. Nothing downstream is trusted while the spine is open.
    expect(
      deriveSequenceStep({
        briefLocked: false,
        baselineLocked: true,
        gateConfirmed: true,
      })
    ).toBe(SEQUENCE_STEPS.BRIEF);
  });

  it('puts the gate after Programme set-up, never before it', () => {
    // The whole point of Note 13's reordering: with the Brief locked but no
    // operational baseline, the next step is set-up, NOT the gate. The gate's
    // objective lens needs reconciled dates in hand.
    expect(deriveSequenceStep(PLANNING)).toBe(SEQUENCE_STEPS.PROGRAMME_SETUP);
    expect(deriveSequenceStep(PLANNING)).not.toBe(SEQUENCE_STEPS.GATE);
    // And a confirmed gate cannot pull a project past set-up: with no baseline,
    // set-up is still the step, gate or no gate.
    expect(
      deriveSequenceStep({
        briefLocked: true,
        baselineLocked: false,
        gateConfirmed: true,
      })
    ).toBe(SEQUENCE_STEPS.PROGRAMME_SETUP);
  });
});

describe('the modules are gated on the operational baseline and the gate', () => {
  it('keeps all three locked before the baseline is locked', () => {
    for (const position of [DEFINING, PLANNING]) {
      const step = deriveSequenceStep(position);
      expect(modulesOpen(step)).toBe(false);
      expect(deriveModuleStates(step)).toEqual({
        actionLog: 'locked',
        risk: 'locked',
        dashboard: 'locked',
      });
    }
  });

  it('keeps all three locked after the baseline lock while the gate is unconfirmed', () => {
    const step = deriveSequenceStep(AT_GATE);
    expect(modulesOpen(step)).toBe(false);
    expect(deriveModuleStates(step)).toEqual({
      actionLog: 'locked',
      risk: 'locked',
      dashboard: 'locked',
    });
  });

  it('opens all three together once the baseline is locked and the gate confirmed', () => {
    const step = deriveSequenceStep(RUNNING);
    expect(modulesOpen(step)).toBe(true);
    expect(deriveModuleStates(step)).toEqual({
      actionLog: 'open',
      risk: 'open',
      dashboard: 'open',
    });
  });

  it('moves the three as one, so no module can read a baseline the others cannot', () => {
    // All three read the same operational baseline, so a state where one is open
    // and another is locked would mean one of them is reading something the
    // others are not. There is no such state.
    for (const position of [DEFINING, PLANNING, AT_GATE, RUNNING]) {
      const states = Object.values(deriveModuleStates(deriveSequenceStep(position)));
      expect(new Set(states).size).toBe(1);
    }
  });
});

describe('the locked line is honest and names the step that opens the module', () => {
  it('names Programme set-up while the baseline is what is missing', () => {
    expect(moduleLockedLine(SEQUENCE_STEPS.PROGRAMME_SETUP)).toBe(
      'Opens after Programme set-up locks the operational baseline.'
    );
  });

  it('names the gate once the baseline is locked', () => {
    expect(moduleLockedLine(SEQUENCE_STEPS.GATE)).toBe(
      'Opens once you confirm the gate into the next stage.'
    );
  });

  it('names both outstanding steps while the Brief is still open', () => {
    const line = moduleLockedLine(SEQUENCE_STEPS.BRIEF);
    expect(line).toContain('Brief');
    expect(line).toContain('operational baseline');
  });

  it('never reads as a dead end: every line says what opens it', () => {
    for (const line of Object.values(MODULE_LOCKED_LINE)) {
      expect(line.startsWith('Opens')).toBe(true);
      expect(line).not.toMatch(/coming soon|not available/i);
    }
  });

  it('falls back to a real line for an unknown step rather than undefined', () => {
    expect(typeof moduleLockedLine('nonsense')).toBe('string');
    expect(moduleLockedLine('nonsense').length).toBeGreaterThan(0);
  });
});

describe('deriveGateConfirmed: stage-agnostic, so mid-lifecycle adoption needs no change', () => {
  it('reads unconfirmed for a project that has passed no gate', () => {
    expect(
      deriveGateConfirmed({ currentStage: 1, passedGateStages: [] })
    ).toBe(false);
  });

  it('reads confirmed once a gate below the current stage is passed', () => {
    // A Stage 1 project passes its gate: the stage 1 row reads passed and
    // current_stage advances to 2.
    expect(
      deriveGateConfirmed({ currentStage: 2, passedGateStages: [1] })
    ).toBe(true);
  });

  it('serves a project adopted mid-lifecycle by the same rule', () => {
    // Adopted at Stage 4, no gate passed yet: unconfirmed.
    expect(
      deriveGateConfirmed({ currentStage: 4, passedGateStages: [] })
    ).toBe(false);
    // It passes the gate out of Stage 4 and advances to 5: confirmed, with no
    // stage constant anywhere in the derivation.
    expect(
      deriveGateConfirmed({ currentStage: 5, passedGateStages: [4] })
    ).toBe(true);
  });

  it('ignores a gate row at or beyond the current stage', () => {
    // A gate recorded for the stage the project still sits on is not a decision
    // that moved it, so it cannot read as confirmed.
    expect(
      deriveGateConfirmed({ currentStage: 2, passedGateStages: [2, 3] })
    ).toBe(false);
  });

  it('is defensive on missing or malformed input', () => {
    expect(deriveGateConfirmed({})).toBe(false);
    expect(deriveGateConfirmed({ currentStage: 2 })).toBe(false);
    expect(deriveGateConfirmed({ currentStage: null, passedGateStages: [1] })).toBe(false);
    expect(
      deriveGateConfirmed({ currentStage: 2, passedGateStages: [null, undefined, 'x'] })
    ).toBe(false);
  });
});

describe('the next step panel and its route', () => {
  it('offers a next step on each of the first three steps and none on the last', () => {
    expect(nextStep(SEQUENCE_STEPS.BRIEF)).not.toBeNull();
    expect(nextStep(SEQUENCE_STEPS.PROGRAMME_SETUP)).not.toBeNull();
    expect(nextStep(SEQUENCE_STEPS.GATE)).not.toBeNull();
    expect(nextStep(SEQUENCE_STEPS.MODULES)).toBeNull();
  });

  it('routes each step to its own surface', () => {
    expect(stepHref(SEQUENCE_STEPS.BRIEF, PID)).toBe(
      `/pulse/app/initiate?project=${PID}`
    );
    expect(stepHref(SEQUENCE_STEPS.PROGRAMME_SETUP, PID)).toBe(
      `/pulse/app/programme/setup?project=${PID}`
    );
    expect(stepHref(SEQUENCE_STEPS.GATE, PID)).toBe(
      `/pulse/app/gate?project=${PID}`
    );
    expect(stepHref(SEQUENCE_STEPS.MODULES, PID)).toBeNull();
  });

  it('routes a locked Brief straight into Programme set-up, not the gate', () => {
    // The routing consequence of the reordering, stated as a test.
    const step = deriveSequenceStep(PLANNING);
    expect(stepHref(step, PID)).toBe(`/pulse/app/programme/setup?project=${PID}`);
  });

  it('returns no route without a project id', () => {
    expect(stepHref(SEQUENCE_STEPS.BRIEF, null)).toBeNull();
    expect(stepHref(SEQUENCE_STEPS.BRIEF, '')).toBeNull();
    expect(stepHref(SEQUENCE_STEPS.BRIEF, '   ')).toBeNull();
  });
});

describe('the copy discipline', () => {
  it('carries no em or en dash in any sequence string', () => {
    const strings = [
      ...Object.values(MODULE_LOCKED_LINE),
      ...Object.values(NEXT_STEP).flatMap((s) => [
        s.eyebrow,
        s.title,
        s.body,
        s.cta,
      ]),
    ];
    for (const s of strings) {
      expect(s).not.toMatch(/[–—]/);
    }
  });
});

describe('pure and deterministic', () => {
  it('returns the same answer for the same input and mutates nothing', () => {
    const input = { ...PLANNING };
    const first = deriveSequenceStep(input);
    const second = deriveSequenceStep(input);
    expect(first).toBe(second);
    expect(input).toEqual(PLANNING);
  });

  it('exposes its vocabulary frozen, so a caller cannot rewrite the sequence', () => {
    expect(Object.isFrozen(SEQUENCE_STEPS)).toBe(true);
    expect(Object.isFrozen(MODULE_LOCKED_LINE)).toBe(true);
    expect(Object.isFrozen(NEXT_STEP)).toBe(true);
  });
});

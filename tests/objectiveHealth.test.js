import { describe, it, expect } from 'vitest';
import {
  deriveObjectiveHealth,
  HEALTH_STATES,
  HEALTH_COLOURS,
  HEALTH_TRIGGERS,
  PROJECT_STATES,
  DATE_VERDICTS,
} from '../lib/engine/objectiveHealth.js';

/**
 * The Objective Health engine (Dashboard module, M9.1, amended by M9.1b).
 * Proves the two ladders (protected: holding, under_pressure, compromised;
 * flexible: holding, absorbing, exhausted), the not_scored rule and its
 * neutral colour (evidence is a scored risk, an open action, or a FLAGGED
 * milestone; an unflagged milestone is the absence of a signal and is not
 * evidence), the accepted-risks-count rule, the flexible proportional
 * threshold (one Serious absorbs, two exhaust), the Time date rule with its
 * two-gap decomposition (protected compromised at one week late with no grace
 * band, flexible absorbing and never exhausted from the date alone), the
 * always-carried dateSignal on the Time row (populated whenever the target
 * and forecast exist, independent of what set the state, null on the other
 * four), the gate exclusion, the unlinked reporting, classification drift in
 * both directions, and the project state with its sentence rule, including
 * that an unscored protected objective pushes the project neither green nor
 * red.
 *
 * Fixed ISO dates keep every assertion independent of the runner's timezone
 * and the wall clock; the engine reads no clock. The tolerance is passed in
 * explicitly on every call, never relied on as a default.
 */

// One objective row per type, ids stable so risks and actions can link.
function objective(type, classification) {
  return { id: `obj_${type}`, objective_type: type, classification };
}
const protectedObj = (type = 'cost') => objective(type, 'non_negotiable');
const flexibleObj = (type = 'scope') => objective(type, 'flexible');

let nextId = 0;
function risk(linkedObjectiveId, likelihood, impact, status = 'watching') {
  nextId += 1;
  return {
    id: `risk_${nextId}`,
    linked_objective_id: linkedObjectiveId,
    likelihood,
    impact,
    status,
  };
}

function action(linkedObjectiveId, status = 'to_do', override = null) {
  nextId += 1;
  return {
    id: `action_${nextId}`,
    linked_objective_id: linkedObjectiveId,
    criticality: 'standard',
    criticality_override: override,
    status,
  };
}

// A minimal frozen baseline snapshot: one applicable stage, one activity,
// milestones as given, plus a gate so the snapshot is shaped like the real
// one. The engine reads it as plain input.
function baselineWith(milestones, { applicable = true, stage = 2 } = {}) {
  return {
    stages: [
      {
        stage,
        applicable,
        stageStart: '2026-01-05',
        activities: [{ key: 'act_1', milestones }],
        gate: {
          key: `gate_${stage}`,
          baselineDate: '2026-06-01',
          closesActivityKey: 'act_1',
        },
      },
    ],
  };
}

function milestone(key, serves, criticality, baselineDate = '2026-03-02') {
  return { key, name: `Milestone ${key}`, serves, criticality, baselineDate };
}

// A flagged item as deriveRAG emits it, reduced to the fields the join reads.
function flagged(key, kind, colour) {
  return { key, kind, colour, condition: 'x', stage: 2 };
}

// The engine call with quiet defaults; every test overrides what it probes.
function derive(overrides) {
  return deriveObjectiveHealth({
    objectives: [],
    risks: [],
    actions: [],
    baseline: null,
    ragFlagged: null,
    forecastCompletion: null,
    baselineCompletion: null,
    targetCompletionDate: null,
    toleranceWeeks: 4,
    today: '2026-07-14',
    ...overrides,
  });
}

function only(result) {
  expect(result.objectives).toHaveLength(1);
  return result.objectives[0];
}

describe('input guard', () => {
  it('throws without a valid tolerance', () => {
    expect(() => derive({ toleranceWeeks: null })).toThrow(/tolerance/);
    expect(() => derive({ toleranceWeeks: -1 })).toThrow(/tolerance/);
    expect(() => derive({ toleranceWeeks: Number.NaN })).toThrow(/tolerance/);
  });

  it('mutates none of its inputs', () => {
    const objectives = [protectedObj()];
    const risks = [risk('obj_cost', 'high', 'high')];
    const base = baselineWith([milestone('m1', 'cost', 'critical')]);
    const rag = [flagged('m1', 'milestone', 'red')];
    const snapshot = JSON.stringify({ objectives, risks, base, rag });
    derive({ objectives, risks, baseline: base, ragFlagged: rag });
    expect(JSON.stringify({ objectives, risks, base, rag })).toBe(snapshot);
  });
});

describe('the protected ladder', () => {
  it('holds with only a minor open risk, and reads green', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        risks: [risk('obj_cost', 'low', 'low')],
      })
    );
    expect(row.isProtected).toBe(true);
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
    expect(row.colour).toBe(HEALTH_COLOURS.GREEN);
    expect(row.trigger).toEqual({ key: HEALTH_TRIGGERS.HOLDING, detail: null });
    expect(row.signals.worstRisk).toBe('minor');
  });

  it('is under pressure from a moderate risk', () => {
    const r = risk('obj_cost', 'medium', 'medium');
    const row = only(
      derive({ objectives: [protectedObj()], risks: [r] })
    );
    expect(row.state).toBe(HEALTH_STATES.UNDER_PRESSURE);
    expect(row.colour).toBe(HEALTH_COLOURS.AMBER);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.MODERATE_RISK);
    expect(row.trigger.detail).toEqual({ count: 1, riskIds: [r.id] });
  });

  it('is under pressure from one open critical action, criticality live', () => {
    const a = action('obj_cost');
    const row = only(
      derive({ objectives: [protectedObj()], actions: [a] })
    );
    expect(row.state).toBe(HEALTH_STATES.UNDER_PRESSURE);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.OPEN_CRITICAL_ACTIONS);
    expect(row.trigger.detail).toEqual({ count: 1, actionIds: [a.id] });
    expect(row.signals.openCritical).toBe(1);
    expect(row.items.actions[0].liveCriticality).toBe('critical');
  });

  it('honours the downward-only override: an overridden action does not press', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        actions: [action('obj_cost', 'to_do', 'standard')],
      })
    );
    expect(row.signals.openCritical).toBe(0);
    // The action still scores the objective, so it holds rather than reading
    // not_scored.
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
    expect(row.items.actions[0].liveCriticality).toBe('standard');
  });

  it('is under pressure from an amber programme flag', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')]),
        ragFlagged: [flagged('m1', 'milestone', 'amber')],
      })
    );
    expect(row.state).toBe(HEALTH_STATES.UNDER_PRESSURE);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_AMBER);
    expect(row.trigger.detail).toEqual({ milestoneKeys: ['m1'] });
    expect(row.signals.programmeFlag).toBe('amber');
    expect(row.items.milestones[0].flag).toBe('amber');
  });

  it('is compromised by a serious risk', () => {
    const r = risk('obj_cost', 'high', 'high');
    const row = only(
      derive({ objectives: [protectedObj()], risks: [r] })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.colour).toBe(HEALTH_COLOURS.RED);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.SERIOUS_RISK);
    expect(row.trigger.detail).toEqual({
      count: 1,
      acceptedCount: 0,
      riskIds: [r.id],
    });
  });

  it('is compromised by an ACCEPTED serious risk: accepting removes nothing', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        risks: [risk('obj_cost', 'high', 'high', 'accepted')],
      })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.signals.seriousCount).toBe(1);
    expect(row.signals.acceptedSerious).toBe(1);
    expect(row.trigger.detail.acceptedCount).toBe(1);
  });

  it('is compromised by a red programme flag', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')]),
        ragFlagged: [flagged('m1', 'milestone', 'red')],
      })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_RED);
    expect(row.signals.programmeFlag).toBe('red');
  });

  it('a closed serious risk raises no signal but still scores the objective', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        risks: [risk('obj_cost', 'high', 'high', 'closed')],
      })
    );
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
    expect(row.signals.worstRisk).toBe('none');
    expect(row.items.risks).toHaveLength(0);
  });
});

describe('the flexible ladder', () => {
  it('holds with only a minor open risk', () => {
    const row = only(
      derive({
        objectives: [flexibleObj()],
        risks: [risk('obj_scope', 'low', 'low')],
      })
    );
    expect(row.isProtected).toBe(false);
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
    expect(row.colour).toBe(HEALTH_COLOURS.GREEN);
  });

  it('absorbs a moderate risk', () => {
    const row = only(
      derive({
        objectives: [flexibleObj()],
        risks: [risk('obj_scope', 'medium', 'medium')],
      })
    );
    expect(row.state).toBe(HEALTH_STATES.ABSORBING);
    expect(row.colour).toBe(HEALTH_COLOURS.AMBER);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.MODERATE_RISK);
  });

  it('absorbs ONE serious risk and is exhausted by TWO: the proportional threshold', () => {
    const one = only(
      derive({
        objectives: [flexibleObj()],
        risks: [risk('obj_scope', 'high', 'high')],
      })
    );
    expect(one.state).toBe(HEALTH_STATES.ABSORBING);
    expect(one.trigger.key).toBe(HEALTH_TRIGGERS.SERIOUS_RISK);

    const two = only(
      derive({
        objectives: [flexibleObj()],
        risks: [
          risk('obj_scope', 'high', 'high'),
          risk('obj_scope', 'high', 'high', 'accepted'),
        ],
      })
    );
    expect(two.state).toBe(HEALTH_STATES.EXHAUSTED);
    expect(two.colour).toBe(HEALTH_COLOURS.RED);
    expect(two.trigger.key).toBe(HEALTH_TRIGGERS.SERIOUS_RISKS);
    expect(two.trigger.detail.count).toBe(2);
    expect(two.trigger.detail.acceptedCount).toBe(1);
  });

  it('absorbs an amber programme flag and is exhausted by a red one', () => {
    const base = baselineWith([milestone('m1', 'scope', 'standard')]);
    const amber = only(
      derive({
        objectives: [flexibleObj()],
        baseline: base,
        ragFlagged: [flagged('m1', 'milestone', 'amber')],
      })
    );
    expect(amber.state).toBe(HEALTH_STATES.ABSORBING);
    expect(amber.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_AMBER);

    const red = only(
      derive({
        objectives: [flexibleObj()],
        baseline: base,
        ragFlagged: [flagged('m1', 'milestone', 'red')],
      })
    );
    expect(red.state).toBe(HEALTH_STATES.EXHAUSTED);
    expect(red.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_RED);
  });

  it('an open critical action cannot exist on a flexible objective: live derivation reads standard', () => {
    const row = only(
      derive({ objectives: [flexibleObj()], actions: [action('obj_scope')] })
    );
    expect(row.signals.openCritical).toBe(0);
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
  });
});

describe('not_scored', () => {
  it('an objective with nothing entered is not_scored, neutral, never green', () => {
    for (const obj of [protectedObj(), flexibleObj()]) {
      const row = only(derive({ objectives: [obj] }));
      expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
      expect(row.colour).toBe(HEALTH_COLOURS.NEUTRAL);
      expect(row.trigger).toEqual({
        key: HEALTH_TRIGGERS.NOT_SCORED,
        detail: null,
      });
    }
  });

  it('risks that exist but are unscored do NOT return holding', () => {
    const result = derive({
      objectives: [protectedObj()],
      risks: [risk('obj_cost', null, null)],
    });
    const row = only(result);
    expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
    expect(row.colour).toBe(HEALTH_COLOURS.NEUTRAL);
    expect(result.unscoredRiskCount).toBe(1);
  });

  it('unflagged milestones alone are NOT evidence: not_scored, not holding', () => {
    for (const classification of ['non_negotiable', 'flexible']) {
      const row = only(
        derive({
          objectives: [objective('cost', classification)],
          baseline: baselineWith([
            milestone('m1', 'cost', 'critical'),
            milestone('m2', 'cost', 'critical'),
          ]),
        })
      );
      expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
      expect(row.colour).toBe(HEALTH_COLOURS.NEUTRAL);
      // The milestones still ride on the row; they just prove nothing.
      expect(row.items.milestones).toHaveLength(2);
    }
  });

  it('a flagged milestone with nothing else is evidence and still drives state', () => {
    const red = only(
      derive({
        objectives: [protectedObj()],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')]),
        ragFlagged: [flagged('m1', 'milestone', 'red')],
      })
    );
    expect(red.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(red.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_RED);

    const amber = only(
      derive({
        objectives: [flexibleObj()],
        baseline: baselineWith([milestone('m1', 'scope', 'standard')]),
        ragFlagged: [flagged('m1', 'milestone', 'amber')],
      })
    );
    expect(amber.state).toBe(HEALTH_STATES.ABSORBING);
    expect(amber.trigger.key).toBe(HEALTH_TRIGGERS.PROGRAMME_AMBER);
  });

  it('a day-one project reads not_scored everywhere and no_state, never a false all-clear', () => {
    // Risks seeded and unscored, no actions, baseline locked today so every
    // flag is none. Under the old rule every objective had milestone evidence
    // and the project reported green on zero assessed information.
    const result = derive({
      objectives: [
        objective('scope', 'flexible'),
        objective('cost', 'non_negotiable'),
        objective('time', 'flexible'),
        objective('quality', 'non_negotiable'),
        objective('funding', 'non_negotiable'),
      ],
      risks: [risk('obj_scope', null, null), risk('obj_cost', null, null)],
      actions: [],
      baseline: baselineWith([
        milestone('m1', 'scope', 'standard'),
        milestone('m2', 'cost', 'critical'),
        milestone('m3', 'time', 'standard'),
      ]),
      ragFlagged: [],
      targetCompletionDate: '2027-12-31',
      baselineCompletion: '2027-10-01',
      forecastCompletion: '2027-10-01',
    });
    for (const row of result.objectives) {
      expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
      expect(row.colour).toBe(HEALTH_COLOURS.NEUTRAL);
    }
    expect(result.project.state).toBe(PROJECT_STATES.NO_STATE);
    expect(result.unscoredRiskCount).toBe(2);
    // The date facts are still carried on the not_scored Time row.
    const time = result.objectives.find((r) => r.type === 'time');
    expect(time.dateSignal).not.toBeNull();
    expect(time.dateSignal.verdict).toBe(DATE_VERDICTS.CLEAR);
  });

  it('a milestone in a not-applicable stage scores nothing', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')], {
          applicable: false,
        }),
      })
    );
    expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
    expect(row.items.milestones).toHaveLength(0);
  });
});

describe('Time and its two gaps', () => {
  const target = '2027-12-31';
  // Time must be scored to reach the ladder; a quiet minor risk does it
  // without raising any competing signal.
  const scoredTime = (classification) => ({
    objectives: [objective('time', classification)],
    risks: [risk('obj_time', 'low', 'low')],
    targetCompletionDate: target,
  });

  it('planning gap only: baked in at lock, nothing slipped since', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: '2028-03-31',
        forecastCompletion: '2028-03-31',
      })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.DATE_PAST_TARGET);
    const d = row.trigger.detail;
    expect(d.totalWeeksLate).toBeCloseTo(13, 5);
    expect(d.plannedWeeksLate).toBeCloseTo(13, 5);
    expect(d.slippedWeeks).toBeCloseTo(0, 5);
  });

  it('delivery gap only: locked on target, slipped since', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: target,
        forecastCompletion: '2028-02-25',
      })
    );
    const d = row.trigger.detail;
    expect(d.plannedWeeksLate).toBeCloseTo(0, 5);
    expect(d.slippedWeeks).toBeCloseTo(8, 5);
    expect(d.totalWeeksLate).toBeCloseTo(8, 5);
  });

  it('both gaps together, and they sum to the total', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: '2028-01-28', // 4 weeks planned
        forecastCompletion: '2028-03-10', // 6 weeks slipped
      })
    );
    const d = row.trigger.detail;
    expect(d.plannedWeeksLate).toBeCloseTo(4, 5);
    expect(d.slippedWeeks).toBeCloseTo(6, 5);
    expect(d.totalWeeksLate).toBeCloseTo(
      d.plannedWeeksLate + d.slippedWeeks,
      8
    );
  });

  it('protected Time is compromised at ONE week late: no grace band', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: target,
        forecastCompletion: '2028-01-07',
      })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.trigger.detail.totalWeeksLate).toBeCloseTo(1, 5);
  });

  it('protected Time on target with no room left is under pressure', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: '2027-12-17',
        forecastCompletion: '2027-12-17', // 2 weeks early, tolerance 4
        toleranceWeeks: 4,
      })
    );
    expect(row.state).toBe(HEALTH_STATES.UNDER_PRESSURE);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.DATE_WITHIN_TOLERANCE);
    expect(row.trigger.detail.totalWeeksLate).toBeCloseTo(-2, 5);
    expect(row.trigger.detail.toleranceWeeks).toBe(4);
  });

  it('protected Time comfortably early holds', () => {
    const row = only(
      derive({
        ...scoredTime('non_negotiable'),
        baselineCompletion: '2027-10-01',
        forecastCompletion: '2027-10-01', // 13 weeks early, tolerance 4
      })
    );
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
  });

  it('flexible Time at FIFTY weeks late absorbs and is never exhausted by the date', () => {
    const row = only(
      derive({
        ...scoredTime('flexible'),
        baselineCompletion: target,
        forecastCompletion: '2028-12-15', // 50 weeks late
      })
    );
    expect(row.state).toBe(HEALTH_STATES.ABSORBING);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.DATE_PAST_TARGET);
    expect(row.trigger.detail.totalWeeksLate).toBeCloseTo(50, 5);
  });

  it('Time reads the worst of its date and its other signals', () => {
    // Late by date (compromised) beats a moderate risk (under pressure).
    const row = only(
      derive({
        objectives: [objective('time', 'non_negotiable')],
        risks: [risk('obj_time', 'medium', 'medium')],
        targetCompletionDate: target,
        baselineCompletion: target,
        forecastCompletion: '2028-01-14',
      })
    );
    expect(row.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.DATE_PAST_TARGET);
  });

  it('with no target date the date test does not run', () => {
    const row = only(
      derive({
        objectives: [objective('time', 'non_negotiable')],
        risks: [risk('obj_time', 'low', 'low')],
        targetCompletionDate: null,
        baselineCompletion: '2028-06-01',
        forecastCompletion: '2029-06-01',
      })
    );
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
  });

  it('the date signal never attaches to a non-Time objective', () => {
    const row = only(
      derive({
        objectives: [protectedObj()],
        risks: [risk('obj_cost', 'low', 'low')],
        targetCompletionDate: target,
        baselineCompletion: target,
        forecastCompletion: '2028-06-01',
      })
    );
    expect(row.state).toBe(HEALTH_STATES.HOLDING);
  });
});

describe('the Time date signal, always carried', () => {
  const target = '2027-12-31';

  it('is populated when a risk set the state, not the date', () => {
    // Flexible Time: a moderate risk sets absorbing and is the trigger, while
    // the forecast sits 15 weeks past the target. The date fact must ride
    // alongside the trigger, never be invisible behind it.
    const row = only(
      derive({
        objectives: [objective('time', 'flexible')],
        risks: [risk('obj_time', 'medium', 'medium')],
        targetCompletionDate: target,
        baselineCompletion: '2028-02-25', // 8 weeks planned at lock
        forecastCompletion: '2028-04-14', // 7 more slipped since
      })
    );
    expect(row.state).toBe(HEALTH_STATES.ABSORBING);
    expect(row.trigger.key).toBe(HEALTH_TRIGGERS.MODERATE_RISK);
    const d = row.dateSignal;
    expect(d).not.toBeNull();
    expect(d.targetCompletionDate).toBe(target);
    expect(d.baselineCompletion).toBe('2028-02-25');
    expect(d.forecastCompletion).toBe('2028-04-14');
    expect(d.plannedWeeksLate).toBeCloseTo(8, 5);
    expect(d.slippedWeeks).toBeCloseTo(7, 5);
    expect(d.totalWeeksLate).toBeCloseTo(15, 5);
    expect(d.verdict).toBe(DATE_VERDICTS.PAST_TARGET);
  });

  it('is null on the four non-Time objectives', () => {
    const result = derive({
      objectives: [
        objective('scope', 'flexible'),
        objective('cost', 'non_negotiable'),
        objective('quality', 'non_negotiable'),
        objective('funding', 'non_negotiable'),
        objective('time', 'flexible'),
      ],
      targetCompletionDate: target,
      baselineCompletion: target,
      forecastCompletion: '2028-01-14',
    });
    for (const row of result.objectives) {
      if (row.type === 'time') expect(row.dateSignal).not.toBeNull();
      else expect(row.dateSignal).toBeNull();
    }
  });

  it('is null on Time when the target or the forecast is missing', () => {
    const noTarget = only(
      derive({
        objectives: [objective('time', 'flexible')],
        targetCompletionDate: null,
        forecastCompletion: '2028-01-14',
      })
    );
    expect(noTarget.dateSignal).toBeNull();

    const noForecast = only(
      derive({
        objectives: [objective('time', 'flexible')],
        targetCompletionDate: target,
        forecastCompletion: null,
      })
    );
    expect(noForecast.dateSignal).toBeNull();
  });

  it('carries a NEGATIVE slippedWeeks when running ahead of plan, and the figures still sum', () => {
    // Planned 8 weeks late at lock, clawed 3 back since: total 5.
    const row = only(
      derive({
        objectives: [objective('time', 'flexible')],
        risks: [risk('obj_time', 'low', 'low')],
        targetCompletionDate: target,
        baselineCompletion: '2028-02-25',
        forecastCompletion: '2028-02-04',
      })
    );
    const d = row.dateSignal;
    expect(d.plannedWeeksLate).toBeCloseTo(8, 5);
    expect(d.slippedWeeks).toBeCloseTo(-3, 5);
    expect(d.totalWeeksLate).toBeCloseTo(5, 5);
    expect(d.totalWeeksLate).toBeCloseTo(d.plannedWeeksLate + d.slippedWeeks, 8);
    expect(d.verdict).toBe(DATE_VERDICTS.PAST_TARGET);
  });

  it('the verdict reads the date rule ALONE, whatever set the state', () => {
    // On target with no room left while a serious risk sets compromised: the
    // trigger says serious_risk, the verdict says no_room.
    const noRoom = only(
      derive({
        objectives: [objective('time', 'non_negotiable')],
        risks: [risk('obj_time', 'high', 'high')],
        targetCompletionDate: target,
        baselineCompletion: '2027-12-17',
        forecastCompletion: '2027-12-17', // 2 weeks early, tolerance 4
        toleranceWeeks: 4,
      })
    );
    expect(noRoom.state).toBe(HEALTH_STATES.COMPROMISED);
    expect(noRoom.trigger.key).toBe(HEALTH_TRIGGERS.SERIOUS_RISK);
    expect(noRoom.dateSignal.verdict).toBe(DATE_VERDICTS.NO_ROOM);

    // Comfortably early: clear.
    const clear = only(
      derive({
        objectives: [objective('time', 'non_negotiable')],
        risks: [risk('obj_time', 'low', 'low')],
        targetCompletionDate: target,
        baselineCompletion: '2027-10-01',
        forecastCompletion: '2027-10-01', // 13 weeks early, tolerance 4
      })
    );
    expect(clear.state).toBe(HEALTH_STATES.HOLDING);
    expect(clear.dateSignal.verdict).toBe(DATE_VERDICTS.CLEAR);
  });
});

describe('gates', () => {
  it('a flagged gate lands in gates and never on an objective', () => {
    const base = baselineWith([milestone('m1', 'time', 'critical')]);
    const result = derive({
      objectives: [objective('time', 'non_negotiable')],
      baseline: base,
      ragFlagged: [flagged('gate_2', 'gate', 'red')],
    });
    expect(result.gates).toHaveLength(1);
    expect(result.gates[0].key).toBe('gate_2');
    const row = only(result);
    expect(row.signals.programmeFlag).toBe('none');
    // The flagged gate neither flags the milestone nor scores the objective:
    // with only an unflagged milestone the row reads not_scored.
    expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
    expect(row.items.milestones[0].flag).toBeNull();
  });

  it('with no flagged gates the gates array is empty', () => {
    expect(derive({}).gates).toEqual([]);
  });
});

describe('unlinked', () => {
  it('unlinked open risks and actions land in unlinked and touch no objective', () => {
    const result = derive({
      objectives: [protectedObj()],
      risks: [
        risk(null, 'high', 'high'),
        risk('obj_unknown', 'high', 'high'), // a link that does not resolve
        risk(null, 'low', 'low', 'closed'), // closed: history, not reported
      ],
      actions: [action(null)],
    });
    expect(result.unlinked.risks).toHaveLength(2);
    expect(result.unlinked.risks[0].severity).toBe('serious');
    expect(result.unlinked.actions).toHaveLength(1);
    expect(result.unlinked.actions[0].liveCriticality).toBe('unlinked');
    const row = only(result);
    expect(row.state).toBe(HEALTH_STATES.NOT_SCORED);
    expect(row.signals.worstRisk).toBe('none');
    expect(row.items.risks).toHaveLength(0);
    expect(row.items.actions).toHaveLength(0);
  });
});

describe('classification drift', () => {
  it('detects a reclassification from non-negotiable to flexible', () => {
    const row = only(
      derive({
        objectives: [flexibleObj('cost')],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')]),
      })
    );
    expect(row.drift).toEqual({ live: 'standard', baked: 'critical' });
  });

  it('detects a reclassification from flexible to non-negotiable', () => {
    const row = only(
      derive({
        objectives: [protectedObj('cost')],
        baseline: baselineWith([milestone('m1', 'cost', 'standard')]),
      })
    );
    expect(row.drift).toEqual({ live: 'critical', baked: 'standard' });
  });

  it('reports no drift when live and baked agree, or with no milestones', () => {
    const agree = only(
      derive({
        objectives: [protectedObj('cost')],
        baseline: baselineWith([milestone('m1', 'cost', 'critical')]),
      })
    );
    expect(agree.drift).toBeNull();

    const none = only(
      derive({
        objectives: [protectedObj('cost')],
        risks: [risk('obj_cost', 'low', 'low')],
      })
    );
    expect(none.drift).toBeNull();
  });
});

describe('the project state', () => {
  it('no_state when no protected objective is scored: rule 0', () => {
    const result = derive({
      objectives: [protectedObj('cost'), flexibleObj('scope')],
      // The flexible objective is scored and absorbing; the protected one is
      // blind. Blindness is reported, never coloured.
      risks: [risk('obj_scope', 'medium', 'medium')],
    });
    expect(result.project).toEqual({
      state: PROJECT_STATES.NO_STATE,
      scoredProtectedCount: 0,
      sentenceRule: 0,
    });
  });

  it('red when any scored protected objective is compromised: rule 1', () => {
    const result = derive({
      objectives: [protectedObj('cost'), protectedObj2()],
      risks: [
        risk('obj_cost', 'high', 'high'),
        risk('obj_quality', 'low', 'low'),
      ],
    });
    expect(result.project.state).toBe(PROJECT_STATES.RED);
    expect(result.project.sentenceRule).toBe(1);
    expect(result.project.scoredProtectedCount).toBe(2);
  });

  it('amber when any scored protected objective is under pressure: rule 2', () => {
    const result = derive({
      objectives: [protectedObj('cost')],
      risks: [risk('obj_cost', 'medium', 'medium')],
    });
    expect(result.project.state).toBe(PROJECT_STATES.AMBER);
    expect(result.project.sentenceRule).toBe(2);
  });

  it('amber when protected holds but a flexible objective is exhausted: rule 3', () => {
    const result = derive({
      objectives: [protectedObj('cost'), flexibleObj('scope')],
      risks: [
        risk('obj_cost', 'low', 'low'),
        risk('obj_scope', 'high', 'high'),
        risk('obj_scope', 'high', 'high'),
      ],
    });
    expect(result.project.state).toBe(PROJECT_STATES.AMBER);
    expect(result.project.sentenceRule).toBe(3);
  });

  it('green while a flexible objective absorbs: rule 4, the design working', () => {
    const result = derive({
      objectives: [protectedObj('cost'), flexibleObj('scope')],
      risks: [
        risk('obj_cost', 'low', 'low'),
        risk('obj_scope', 'high', 'high'),
      ],
    });
    expect(result.project.state).toBe(PROJECT_STATES.GREEN);
    expect(result.project.sentenceRule).toBe(4);
  });

  it('green when everything holds: rule 5', () => {
    const result = derive({
      objectives: [protectedObj('cost'), flexibleObj('scope')],
      risks: [
        risk('obj_cost', 'low', 'low'),
        risk('obj_scope', 'low', 'low'),
      ],
    });
    expect(result.project.state).toBe(PROJECT_STATES.GREEN);
    expect(result.project.sentenceRule).toBe(5);
  });

  it('an unscored protected objective neither greens nor reds the project', () => {
    // Scored protected holding plus an unscored protected: still green, and
    // the count reports the partial coverage.
    const green = derive({
      objectives: [protectedObj('cost'), objective('quality', 'non_negotiable')],
      risks: [risk('obj_cost', 'low', 'low')],
    });
    expect(green.project.state).toBe(PROJECT_STATES.GREEN);
    expect(green.project.scoredProtectedCount).toBe(1);

    // And an unscored protected alone gives no state, not a colour.
    const blind = derive({
      objectives: [objective('quality', 'non_negotiable')],
    });
    expect(blind.project.state).toBe(PROJECT_STATES.NO_STATE);
  });
});

// A second protected objective for the multi-objective project tests.
function protectedObj2() {
  return objective('quality', 'non_negotiable');
}

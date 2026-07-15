import { describe, it, expect } from 'vitest';
import {
  deriveDashboard,
  orderHealthRows,
  nextGate,
  sortObjectivesCanonical,
} from '../app/pulse/app/dashboard/dashboardModel.js';
import { HEALTH_STATES } from '../lib/engine/objectiveHealth.js';
import {
  DEFAULT_TOLERANCE_KEY,
  toleranceWeeksFor,
} from '../app/pulse/app/programme/trackingModel.js';

/**
 * The Project Dashboard display model (M9.2). Proves the assembly: the
 * canonical objective order, the Band 2 row order (protected block first,
 * worst state first, Not scored beneath the scored, canonical tiebreak), the
 * next-gate walk over the frozen snapshot (not-applicable stages skipped,
 * met gates skipped, null when nothing lies ahead), and that deriveDashboard
 * runs the whole read at EXACTLY the Programme surface's default tolerance,
 * wires the two completions into the health engine's Time date signal, and
 * degrades honestly with no baseline.
 *
 * Fixed ISO dates keep every assertion independent of the wall clock; the
 * model reads no clock and today arrives as input.
 */

function objective(type, classification) {
  return { id: `obj_${type}`, objective_type: type, classification };
}

// A row shaped as the health engine emits it, reduced to what the sort reads.
function healthRow(type, isProtected, state) {
  return { id: `obj_${type}`, type, isProtected, state };
}

// A two-stage frozen snapshot: stage 1 (gate met in the tests that need it)
// and stage 2, plus a not-applicable stage 0. Milestone dates place the
// baseline completion; the gate dates are the next-gate walk's subjects.
const PROGRAMME = {
  projectStart: '2026-06-01T00:00:00.000Z',
  stages: [
    {
      stage: 0,
      applicable: false,
      stageStart: null,
      activities: [{ key: '0a', milestones: [], durationWeeks: 4 }],
      gate: { key: 'gate_0', name: 'Stage zero', baselineDate: null },
    },
    {
      stage: 1,
      applicable: true,
      stageStart: '2026-06-01T00:00:00.000Z',
      activities: [
        {
          key: '1a',
          durationWeeks: 4,
          milestones: [
            {
              key: 'm_one',
              name: 'Milestone one',
              serves: 'time',
              criticality: 'standard',
              baselineDate: '2026-06-15T00:00:00.000Z',
            },
          ],
        },
      ],
      gate: {
        key: 'gate_1',
        name: 'Stage one',
        baselineDate: '2026-06-29T00:00:00.000Z',
        closesActivityKey: '1a',
      },
    },
    {
      stage: 2,
      applicable: true,
      stageStart: '2026-06-29T00:00:00.000Z',
      activities: [
        {
          key: '2a',
          durationWeeks: 4,
          milestones: [
            {
              key: 'm_two',
              name: 'Milestone two',
              serves: 'quality',
              criticality: 'critical',
              baselineDate: '2026-07-13T00:00:00.000Z',
            },
          ],
        },
      ],
      gate: {
        key: 'gate_2',
        name: 'Stage two',
        baselineDate: '2026-07-27T00:00:00.000Z',
        closesActivityKey: '2a',
      },
    },
  ],
};

describe('sortObjectivesCanonical', () => {
  it('orders the rows Scope, Cost, Time, Quality, Funding', () => {
    const shuffled = [
      objective('funding', 'flexible'),
      objective('time', 'flexible'),
      objective('scope', 'flexible'),
      objective('quality', 'non_negotiable'),
      objective('cost', 'non_negotiable'),
    ];
    expect(sortObjectivesCanonical(shuffled).map((o) => o.objective_type)).toEqual(
      ['scope', 'cost', 'time', 'quality', 'funding']
    );
  });
});

describe('orderHealthRows', () => {
  it('puts the protected block first, worst state first, not scored last', () => {
    const rows = [
      healthRow('scope', false, HEALTH_STATES.NOT_SCORED),
      healthRow('cost', true, HEALTH_STATES.UNDER_PRESSURE),
      healthRow('time', false, HEALTH_STATES.ABSORBING),
      healthRow('quality', true, HEALTH_STATES.NOT_SCORED),
      healthRow('funding', true, HEALTH_STATES.COMPROMISED),
    ];
    expect(orderHealthRows(rows).map((r) => r.type)).toEqual([
      'funding',
      'cost',
      'quality',
      'time',
      'scope',
    ]);
  });

  it('breaks state ties on the canonical input order', () => {
    const rows = [
      healthRow('cost', true, HEALTH_STATES.UNDER_PRESSURE),
      healthRow('quality', true, HEALTH_STATES.UNDER_PRESSURE),
      healthRow('funding', true, HEALTH_STATES.UNDER_PRESSURE),
    ];
    expect(orderHealthRows(rows).map((r) => r.type)).toEqual([
      'cost',
      'quality',
      'funding',
    ]);
  });
});

describe('nextGate', () => {
  it('returns the first applicable unmet gate with its baked fields', () => {
    const gate = nextGate(PROGRAMME, {});
    expect(gate).toEqual({
      stage: 1,
      name: 'Stage one',
      baselineDate: '2026-06-29T00:00:00.000Z',
    });
  });

  it('skips met gates and never reads the not-applicable stage', () => {
    const gate = nextGate(PROGRAMME, { gate_1: { met: true, metDate: null } });
    expect(gate?.stage).toBe(2);
  });

  it('returns null when no gate lies ahead', () => {
    const met = {
      gate_1: { met: true, metDate: null },
      gate_2: { met: true, metDate: null },
    };
    expect(nextGate(PROGRAMME, met)).toBeNull();
  });
});

describe('deriveDashboard', () => {
  const objectives = [
    objective('scope', 'flexible'),
    objective('cost', 'non_negotiable'),
    objective('time', 'flexible'),
    objective('quality', 'non_negotiable'),
    objective('funding', 'non_negotiable'),
  ];

  it('runs at exactly the Programme surface default tolerance', () => {
    const result = deriveDashboard({
      objectives,
      risks: [],
      actions: [],
      programme: null,
      metPoints: {},
      todayIso: '2026-07-14',
      targetCompletionDate: null,
      currentStage: 2,
    });
    expect(result.toleranceWeeks).toBe(toleranceWeeksFor(DEFAULT_TOLERANCE_KEY));
  });

  it('degrades honestly with no baseline', () => {
    const result = deriveDashboard({
      objectives,
      risks: [],
      actions: [],
      programme: null,
      metPoints: {},
      todayIso: '2026-07-14',
      targetCompletionDate: '2027-12-31',
      currentStage: 2,
    });
    expect(result.facts.hasBaseline).toBe(false);
    expect(result.facts.percentComplete).toBeNull();
    expect(result.facts.forecastCompletion).toBeNull();
    expect(result.facts.nextGate).toBeNull();
    expect(result.health.objectives).toHaveLength(5);
    // No forecast, so the Time row carries no date signal.
    const time = result.health.objectives.find((r) => r.type === 'time');
    expect(time.dateSignal).toBeNull();
  });

  it('wires the engines and the two completions into the read', () => {
    const result = deriveDashboard({
      objectives,
      risks: [],
      actions: [
        {
          id: 'a1',
          linked_objective_id: 'obj_cost',
          criticality_override: null,
          status: 'to_do',
          stage: 2,
        },
        {
          id: 'a2',
          linked_objective_id: 'obj_scope',
          criticality_override: null,
          status: 'to_do',
          stage: 1,
        },
      ],
      programme: PROGRAMME,
      metPoints: { gate_1: { met: true, metDate: '2026-06-29' } },
      todayIso: '2026-07-14T00:00:00.000Z',
      targetCompletionDate: '2026-07-06',
      currentStage: 2,
    });

    // The Band 1 facts read off the engines.
    expect(result.facts.hasBaseline).toBe(true);
    expect(typeof result.facts.percentComplete).toBe('number');
    expect(result.facts.nextGate?.stage).toBe(2);
    // Gate readiness counts only the open actions bearing on stage 2, and
    // derives criticality live: the cost-linked action is critical.
    expect(result.facts.readiness).toEqual({ open: 1, critical: 1 });

    // The Time row carries the date signal: forecast and the baseline's own
    // completion both flowed into the health engine.
    const time = result.health.objectives.find((r) => r.type === 'time');
    expect(time.dateSignal).not.toBeNull();
    expect(time.dateSignal.plannedWeeksLate).toBeCloseTo(3, 5);

    // The Band 2 order: protected block first.
    expect(result.rows.slice(0, 3).every((r) => r.isProtected)).toBe(true);
  });

  it('excludes an open critical action stamped to another stage from gate readiness', () => {
    const result = deriveDashboard({
      objectives,
      risks: [],
      actions: [
        {
          id: 'a-current',
          linked_objective_id: 'obj_cost',
          criticality_override: null,
          status: 'to_do',
          stage: 2,
        },
        {
          id: 'a-later',
          linked_objective_id: 'obj_funding',
          criticality_override: null,
          status: 'to_do',
          stage: 3,
        },
      ],
      programme: PROGRAMME,
      metPoints: {},
      todayIso: '2026-07-14',
      targetCompletionDate: null,
      currentStage: 2,
    });
    // a-later is open AND critical (Funding is protected), but it is stamped
    // to stage 3, so it bears on that stage's gate, not this one. "Bear on
    // it" is a claim the fact must not make loosely: only a-current counts.
    expect(result.facts.readiness).toEqual({ open: 1, critical: 1 });
  });
});

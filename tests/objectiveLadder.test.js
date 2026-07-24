/**
 * The objective status ladder (Note 20): each rung from its trigger, the
 * reserved-Compromised rule, the honest Not scored state, and the driver
 * string for each. Every case runs the REAL health engine first
 * (deriveObjectiveHealth) and hands its output to the ladder, so the tests
 * prove the ladder absorbs the triggers the health engine actually emits
 * rather than shapes invented here.
 */

import { describe, it, expect } from 'vitest';
import { deriveObjectiveHealth } from '../lib/engine/objectiveHealth.js';
import {
  deriveObjectiveLadder,
  LADDER_STATUSES,
  LADDER_TRIGGERS,
} from '../lib/engine/objectiveLadder.js';

// ---------------------------------------------------------------------------
// Fixtures.

const OBJ_COST = { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' };
const OBJ_TIME = { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' };
const OBJ_SCOPE = { id: 'o-scope', objective_type: 'scope', classification: 'flexible' };

// likelihood high x impact high = Serious; medium x medium = moderate.
function seriousRisk(id, objectiveId, status = 'open') {
  return { id, linked_objective_id: objectiveId, likelihood: 'high', impact: 'high', status };
}
function moderateRisk(id, objectiveId, status = 'open') {
  return { id, linked_objective_id: objectiveId, likelihood: 'medium', impact: 'medium', status };
}

// A one-stage baseline with one milestone serving Cost.
const BASELINE = {
  stages: [
    {
      stage: 2,
      applicable: true,
      activities: [
        {
          milestones: [
            {
              key: 'ms-1',
              name: 'Appoint the design team',
              serves: 'cost',
              criticality: 'critical',
              baselineDate: '2026-06-01',
            },
          ],
        },
      ],
    },
  ],
};

function health(overrides = {}) {
  return deriveObjectiveHealth({
    objectives: [OBJ_COST],
    risks: [],
    actions: [],
    baseline: null,
    ragFlagged: null,
    forecastCompletion: null,
    baselineCompletion: null,
    targetCompletionDate: null,
    toleranceWeeks: 4,
    ...overrides,
  });
}

function ladderRow(overrides = {}, index = 0) {
  return deriveObjectiveLadder(health(overrides))[index];
}

// ---------------------------------------------------------------------------
// Each rung from its trigger.

describe('the four rungs, each from its trigger', () => {
  it('Healthy: assessed and clear reads healthy with the clear driver', () => {
    // A closed, scored risk marks Cost as looked at; nothing open threatens it.
    const row = ladderRow({ risks: [moderateRisk('r1', 'o-cost', 'closed')] });
    expect(row.status).toBe(LADDER_STATUSES.HEALTHY);
    expect(row.trigger.key).toBe(LADDER_TRIGGERS.CLEAR);
    expect(row.driver).toBe(
      'Nothing live threatens Cost: no Serious risk, no slip beyond tolerance, no breach.'
    );
    expect(row.actsIn).toBeNull();
  });

  it('At risk: a live Serious risk reads at_risk with the risk cited', () => {
    const row = ladderRow({ risks: [seriousRisk('r1', 'o-cost')] });
    expect(row.status).toBe(LADDER_STATUSES.AT_RISK);
    expect(row.trigger.key).toBe(LADDER_TRIGGERS.SERIOUS_RISK_LIVE);
    expect(row.trigger.detail).toEqual({ count: 1, riskIds: ['r1'] });
    expect(row.driver).toBe('A Serious risk is live against Cost.');
    expect(row.actsIn).toBe('risk');
  });

  it('Slipping: a tracker red flag reads slipping, never compromised', () => {
    const row = ladderRow({
      baseline: BASELINE,
      ragFlagged: [{ kind: 'milestone', key: 'ms-1', colour: 'red' }],
    });
    expect(row.status).toBe(LADDER_STATUSES.SLIPPING);
    expect(row.trigger.key).toBe(LADDER_TRIGGERS.SLIP_BEYOND_TOLERANCE);
    expect(row.trigger.detail).toEqual({ milestoneKeys: ['ms-1'] });
    expect(row.driver).toBe(
      'A milestone serving Cost has slipped beyond your tolerance.'
    );
    expect(row.actsIn).toBe('programme');
  });

  it('Slipping: a tracker amber flag reads slipping with the baseline driver', () => {
    const row = ladderRow({
      baseline: BASELINE,
      ragFlagged: [{ kind: 'milestone', key: 'ms-1', colour: 'amber' }],
    });
    expect(row.status).toBe(LADDER_STATUSES.SLIPPING);
    expect(row.trigger.key).toBe(LADDER_TRIGGERS.SLIP_AGAINST_BASELINE);
    expect(row.driver).toBe(
      'A milestone serving Cost has slipped against its baseline date.'
    );
  });

  it('Compromised: a forecast past the target is breach in fact, driver citing weeks and the target date', () => {
    const rows = deriveObjectiveLadder(
      health({
        objectives: [OBJ_TIME],
        risks: [seriousRisk('r1', 'o-time', 'closed')],
        forecastCompletion: '2028-05-21',
        baselineCompletion: '2028-04-30',
        targetCompletionDate: '2028-04-30',
      })
    );
    expect(rows[0].status).toBe(LADDER_STATUSES.COMPROMISED);
    expect(rows[0].trigger.key).toBe(LADDER_TRIGGERS.FORECAST_PAST_TARGET);
    expect(rows[0].driver).toBe(
      'Forecast completes 3 weeks past your 30 April 2028 target.'
    );
    expect(rows[0].actsIn).toBe('programme');
  });
});

// ---------------------------------------------------------------------------
// Compromised is reserved for breach in fact.

describe('the reserved Compromised rung', () => {
  it('a protected objective with a live Serious risk reads At risk, not Compromised', () => {
    // The health engine itself reads this protected objective as compromised;
    // the ladder corrects the expression: a live risk is exposure, not breach.
    const h = health({ risks: [seriousRisk('r1', 'o-cost')] });
    expect(h.objectives[0].state).toBe('compromised');
    const row = deriveObjectiveLadder(h)[0];
    expect(row.isProtected).toBe(true);
    expect(row.status).toBe(LADDER_STATUSES.AT_RISK);
    expect(row.status).not.toBe(LADDER_STATUSES.COMPROMISED);
  });

  it('a tracker red flag alone never reads Compromised', () => {
    const row = ladderRow({
      baseline: BASELINE,
      ragFlagged: [{ kind: 'milestone', key: 'ms-1', colour: 'red' }],
    });
    expect(row.status).toBe(LADDER_STATUSES.SLIPPING);
  });

  it('a forecast past the target outranks every softer signal', () => {
    const rows = deriveObjectiveLadder(
      health({
        objectives: [OBJ_TIME],
        risks: [seriousRisk('r1', 'o-time')],
        forecastCompletion: '2028-06-04',
        baselineCompletion: '2028-04-30',
        targetCompletionDate: '2028-04-30',
      })
    );
    expect(rows[0].status).toBe(LADDER_STATUSES.COMPROMISED);
    expect(rows[0].trigger.key).toBe(LADDER_TRIGGERS.FORECAST_PAST_TARGET);
  });
});

// ---------------------------------------------------------------------------
// The honest unscored state.

describe('Not scored', () => {
  it('an unassessed flexible objective reads not_scored, never healthy', () => {
    const rows = deriveObjectiveLadder(health({ objectives: [OBJ_SCOPE] }));
    expect(rows[0].isProtected).toBe(false);
    expect(rows[0].status).toBe(LADDER_STATUSES.NOT_SCORED);
    expect(rows[0].status).not.toBe(LADDER_STATUSES.HEALTHY);
    expect(rows[0].driver).toBe('Nothing has been assessed against Scope yet.');
    expect(rows[0].actsIn).toBe('risk');
  });

  it('a tagged but unscored risk does not rescue the objective from not_scored', () => {
    const rows = deriveObjectiveLadder(
      health({
        objectives: [OBJ_SCOPE],
        risks: [{ id: 'r1', linked_objective_id: 'o-scope', likelihood: null, impact: null, status: 'open' }],
      })
    );
    expect(rows[0].status).toBe(LADDER_STATUSES.NOT_SCORED);
  });

  it('a breach in fact outranks not_scored: the forecast is an assessment', () => {
    const rows = deriveObjectiveLadder(
      health({
        objectives: [OBJ_TIME],
        forecastCompletion: '2028-05-21',
        baselineCompletion: '2028-04-30',
        targetCompletionDate: '2028-04-30',
      })
    );
    // The health engine reads this row not_scored (no risk, action, or flag
    // evidence), and still carries the date signal; the ladder reads the
    // breach.
    expect(rows[0].status).toBe(LADDER_STATUSES.COMPROMISED);
  });
});

// ---------------------------------------------------------------------------
// Precedence and plurals.

describe('precedence and drivers', () => {
  it('slipping outranks at_risk when both hold', () => {
    const row = ladderRow({
      risks: [seriousRisk('r1', 'o-cost')],
      baseline: BASELINE,
      ragFlagged: [{ kind: 'milestone', key: 'ms-1', colour: 'red' }],
    });
    expect(row.status).toBe(LADDER_STATUSES.SLIPPING);
  });

  it('a moderate risk alone leaves the objective healthy: no Serious risk, no slip, no breach', () => {
    const row = ladderRow({ risks: [moderateRisk('r1', 'o-cost')] });
    expect(row.status).toBe(LADDER_STATUSES.HEALTHY);
  });

  it('plural Serious risks read a counted driver', () => {
    const row = ladderRow({
      risks: [seriousRisk('r1', 'o-cost'), seriousRisk('r2', 'o-cost')],
    });
    expect(row.driver).toBe('Two Serious risks are live against Cost.');
    expect(row.trigger.detail.riskIds).toEqual(['r1', 'r2']);
  });

  it('one row per objective, in the health read\'s order, protected marked', () => {
    const rows = deriveObjectiveLadder(
      health({ objectives: [OBJ_SCOPE, OBJ_COST, OBJ_TIME] })
    );
    expect(rows.map((r) => r.type)).toEqual(['scope', 'cost', 'time']);
    expect(rows.map((r) => r.isProtected)).toEqual([false, true, true]);
    expect(rows.map((r) => r.name)).toEqual(['Scope', 'Cost', 'Time']);
  });

  it('throws without a health read', () => {
    expect(() => deriveObjectiveLadder(null)).toThrow();
  });
});

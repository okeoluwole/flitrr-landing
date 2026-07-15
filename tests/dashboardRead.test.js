import { describe, it, expect } from 'vitest';
import {
  HEALTH_STATES,
  HEALTH_TRIGGERS,
  DATE_VERDICTS,
} from '../lib/engine/objectiveHealth.js';
import {
  stateSentence,
  supportingLines,
  factStage,
  factComplete,
  factForecast,
  factGate,
  reasonLine,
  dateLine,
  driftLine,
  stateLabel,
  classificationWord,
  formatDate,
  FACT_NOT_SET,
} from '../app/pulse/app/dashboard/dashboardRead.js';

/**
 * The dashboard read (M9.2): the copy layer over the objective health
 * engine. Proves the copy sheet is enforced: every trigger key the engine's
 * frozen vocabulary can emit has a string (the two date triggers return null
 * because the Time date line carries them), an unknown key THROWS rather
 * than falling back to a generic line, the six state sentences, the
 * supporting-line priority, the four facts with their honest Not set reads,
 * the 2.4 date-line cases with whole-week rounding, and the drift notices.
 */

function row({
  type = 'cost',
  isProtected = true,
  state = HEALTH_STATES.HOLDING,
  trigger = { key: HEALTH_TRIGGERS.HOLDING, detail: null },
  dateSignal = null,
  drift = null,
  items = { risks: [], actions: [], milestones: [] },
} = {}) {
  return {
    id: `obj_${type}`,
    type,
    isProtected,
    state,
    colour: 'green',
    trigger,
    dateSignal,
    drift,
    items,
  };
}

function health(objectives, sentenceRule, extras = {}) {
  return {
    objectives,
    project: { state: 'amber', scoredProtectedCount: 1, sentenceRule },
    gates: [],
    unlinked: { risks: [], actions: [] },
    unscoredRiskCount: 0,
    ...extras,
  };
}

const HREFS = {
  risk: '/risk',
  actions: '/actions',
  programmeSetup: '/setup',
};

describe('trigger coverage', () => {
  const covered = {
    [HEALTH_TRIGGERS.NOT_SCORED]: {
      state: HEALTH_STATES.NOT_SCORED,
      detail: null,
      expects: /Nothing scored against Cost yet\./,
    },
    [HEALTH_TRIGGERS.HOLDING]: {
      detail: null,
      expects: /Nothing is currently pressing on Cost\./,
    },
    [HEALTH_TRIGGERS.SERIOUS_RISK]: {
      detail: { count: 1, acceptedCount: 0, riskIds: ['r1'] },
      expects: /^A Serious risk is live against Cost\.$/,
    },
    [HEALTH_TRIGGERS.SERIOUS_RISKS]: {
      detail: { count: 2, acceptedCount: 0, riskIds: ['r1', 'r2'] },
      expects: /Two Serious risks are live against Cost\. It has no give left\./,
    },
    [HEALTH_TRIGGERS.MODERATE_RISK]: {
      detail: { count: 3, riskIds: ['r1', 'r2', 'r3'] },
      expects: /Three risks worth watching are live against Cost\./,
    },
    [HEALTH_TRIGGERS.OPEN_CRITICAL_ACTIONS]: {
      detail: { count: 2, actionIds: ['a1', 'a2'] },
      expects: /Two critical actions are open against Cost\./,
    },
    [HEALTH_TRIGGERS.PROGRAMME_RED]: {
      detail: { milestoneKeys: ['m1'] },
      expects: /A milestone serving Cost has slipped past your tolerance\./,
    },
    [HEALTH_TRIGGERS.PROGRAMME_AMBER]: {
      detail: { milestoneKeys: ['m1'] },
      expects: /A milestone serving Cost is slipping\./,
    },
  };

  it('covers every key the engine can emit', () => {
    for (const key of Object.values(HEALTH_TRIGGERS)) {
      const spec = covered[key];
      if (
        key === HEALTH_TRIGGERS.DATE_PAST_TARGET ||
        key === HEALTH_TRIGGERS.DATE_WITHIN_TOLERANCE
      ) {
        // Carried by the date line, deliberately no reason line of their own.
        expect(
          reasonLine(row({ trigger: { key, detail: {} } }))
        ).toBeNull();
        continue;
      }
      expect(spec, `no test coverage for trigger "${key}"`).toBeTruthy();
      const line = reasonLine(
        row({
          state: spec.state ?? HEALTH_STATES.UNDER_PRESSURE,
          trigger: { key, detail: spec.detail },
        })
      );
      expect(line).toMatch(spec.expects);
    }
  });

  it('throws on a key with no string, never a generic fallback', () => {
    expect(() =>
      reasonLine(row({ trigger: { key: 'unknown_key', detail: null } }))
    ).toThrow(/no copy for trigger key "unknown_key"/);
  });

  it('names the acceptance on an accepted Serious risk', () => {
    const line = reasonLine(
      row({
        trigger: {
          key: HEALTH_TRIGGERS.SERIOUS_RISK,
          detail: { count: 1, acceptedCount: 1, riskIds: ['r1'] },
        },
      })
    );
    expect(line).toBe(
      'A Serious risk is live against Cost, and you have accepted it.'
    );
  });

  it('credits unflagged milestones on a Not scored row', () => {
    const line = reasonLine(
      row({
        state: HEALTH_STATES.NOT_SCORED,
        trigger: { key: HEALTH_TRIGGERS.NOT_SCORED, detail: null },
        type: 'scope',
        items: {
          risks: [],
          actions: [],
          milestones: [{ key: 'm1' }, { key: 'm2' }],
        },
      })
    );
    expect(line).toBe(
      'Nothing scored against Scope yet. Two milestones serve it and neither has slipped, but no risk has been assessed.'
    );
  });
});

describe('the state sentence', () => {
  it('rule 0: nothing scored', () => {
    expect(stateSentence(health([], 0))).toBe(
      'Nothing is scored yet, so there is no read to give. Score your risks to open it.'
    );
  });

  it('rule 1, one compromised: names the objective and the reason', () => {
    const h = health(
      [
        row({
          type: 'cost',
          state: HEALTH_STATES.COMPROMISED,
          trigger: {
            key: HEALTH_TRIGGERS.SERIOUS_RISK,
            detail: { count: 1, acceptedCount: 0, riskIds: ['r1'] },
          },
        }),
      ],
      1
    );
    expect(stateSentence(h)).toBe(
      'Cost is compromised. You protected it, and a Serious risk is live against it.'
    );
  });

  it('rule 1, some compromised: counts against the protected total', () => {
    const h = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.COMPROMISED }),
        row({ type: 'time', state: HEALTH_STATES.COMPROMISED }),
        row({ type: 'quality', state: HEALTH_STATES.HOLDING }),
      ],
      1
    );
    expect(stateSentence(h)).toBe(
      'Two of your three protected objectives are compromised: Cost and Time.'
    );
  });

  it('rule 1, every protected compromised: Both for two, All for more', () => {
    const both = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.COMPROMISED }),
        row({ type: 'time', state: HEALTH_STATES.COMPROMISED }),
      ],
      1
    );
    expect(stateSentence(both)).toBe(
      'Both of your protected objectives are compromised: Cost and Time.'
    );
    const all = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.COMPROMISED }),
        row({ type: 'time', state: HEALTH_STATES.COMPROMISED }),
        row({ type: 'quality', state: HEALTH_STATES.COMPROMISED }),
      ],
      1
    );
    expect(stateSentence(all)).toBe(
      'All three of your protected objectives are compromised: Cost, Time and Quality.'
    );
  });

  it('rule 2, one under pressure', () => {
    const h = health(
      [row({ type: 'cost', state: HEALTH_STATES.UNDER_PRESSURE })],
      2
    );
    expect(stateSentence(h)).toBe(
      'Cost is under pressure. It is the only protected objective currently exposed.'
    );
  });

  it('rule 2, some under pressure: counts against the protected total', () => {
    const h = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'quality', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'funding', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'time', state: HEALTH_STATES.HOLDING }),
      ],
      2
    );
    expect(stateSentence(h)).toBe(
      'Three of your four protected objectives are under pressure: Cost, Quality and Funding.'
    );
  });

  it('rule 2, every protected under pressure: never "three of your three"', () => {
    // The live fixture's shape: Cost, Quality and Funding protected, all
    // three under pressure.
    const all = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'quality', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'funding', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'scope', isProtected: false, state: HEALTH_STATES.HOLDING }),
      ],
      2
    );
    expect(stateSentence(all)).toBe(
      'All three of your protected objectives are under pressure: Cost, Quality and Funding.'
    );
    const both = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.UNDER_PRESSURE }),
        row({ type: 'quality', state: HEALTH_STATES.UNDER_PRESSURE }),
      ],
      2
    );
    expect(stateSentence(both)).toBe(
      'Both of your protected objectives are under pressure: Cost and Quality.'
    );
  });

  it('rule 3: a flexible objective is exhausted', () => {
    const h = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.HOLDING }),
        row({
          type: 'scope',
          isProtected: false,
          state: HEALTH_STATES.EXHAUSTED,
        }),
      ],
      3
    );
    expect(stateSentence(h)).toBe(
      'Scope has absorbed as much as it can. Your next setback lands on something you protected.'
    );
  });

  it('rule 4: flexible objectives absorbing, by design', () => {
    const h = health(
      [
        row({ type: 'cost', state: HEALTH_STATES.HOLDING }),
        row({
          type: 'time',
          isProtected: false,
          state: HEALTH_STATES.ABSORBING,
        }),
        row({
          type: 'scope',
          isProtected: false,
          state: HEALTH_STATES.ABSORBING,
        }),
      ],
      4
    );
    expect(stateSentence(h)).toBe(
      'Every protected objective is holding. Time and Scope are absorbing the pressure, which is what you classified them to do.'
    );
  });

  it('rule 5: everything holding', () => {
    expect(stateSentence(health([], 5))).toBe('Every objective is holding.');
  });
});

describe('the supporting lines', () => {
  it('line A fires only when every objective is protected', () => {
    const allProtected = [row({ type: 'cost' }), row({ type: 'time' })].map(
      (r) => ({ ...r, isProtected: true })
    );
    const lines = supportingLines(health(allProtected, 5), {
      hasBaseline: true,
      openRiskCount: 0,
      hrefs: HREFS,
    });
    expect(lines[0].text).toMatch(/no give/);
    expect(lines[0].href).toBeNull();
  });

  it('blind spot 1: an unscored protected objective outranks the rest', () => {
    const h = health(
      [
        row({
          type: 'cost',
          state: HEALTH_STATES.NOT_SCORED,
          trigger: { key: HEALTH_TRIGGERS.NOT_SCORED, detail: null },
        }),
        row({ type: 'scope', isProtected: false }),
      ],
      0,
      { unlinked: { risks: [{ id: 'r1' }], actions: [] } }
    );
    const lines = supportingLines(h, {
      hasBaseline: false,
      openRiskCount: 3,
      hrefs: HREFS,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe(
      'Cost is protected and nothing is scored against it. This read cannot see it.'
    );
    expect(lines[0].href).toBe('/risk');
  });

  it('blind spot 2: unlinked risks, and actions where they exist', () => {
    const h = health([row({ type: 'scope', isProtected: false })], 5, {
      unlinked: {
        risks: [{}, {}, {}, {}, {}],
        actions: [{}, {}],
      },
    });
    const lines = supportingLines(h, {
      hasBaseline: true,
      openRiskCount: 9,
      hrefs: HREFS,
    });
    expect(lines[0].text).toBe(
      '5 risks and 2 actions are not linked to an objective, so they sit outside this read.'
    );
    const riskOnly = supportingLines(
      health([row({ type: 'scope', isProtected: false })], 5, {
        unlinked: { risks: [{}, {}, {}, {}, {}], actions: [] },
      }),
      { hasBaseline: true, openRiskCount: 9, hrefs: HREFS }
    );
    expect(riskOnly[0].text).toBe(
      '5 risks are not linked to an objective, so they sit outside this read.'
    );
  });

  it('blind spot 3: unscored risks', () => {
    const h = health([row({ type: 'scope', isProtected: false })], 5, {
      unscoredRiskCount: 6,
    });
    const lines = supportingLines(h, {
      hasBaseline: true,
      openRiskCount: 9,
      hrefs: HREFS,
    });
    expect(lines[0].text).toBe(
      '6 of your 9 risks are unscored, so this read is incomplete.'
    );
  });

  it('blind spot 4: no baseline locked', () => {
    const h = health([row({ type: 'scope', isProtected: false })], 5);
    const lines = supportingLines(h, {
      hasBaseline: false,
      openRiskCount: 0,
      hrefs: HREFS,
    });
    expect(lines[0].text).toBe(
      'No programme baseline is locked, so schedule pressure is not in this read.'
    );
    expect(lines[0].href).toBe('/setup');
  });
});

describe('the four facts', () => {
  it('fact 1: the stage and its name', () => {
    expect(factStage(2)).toEqual({
      label: 'Stage',
      value: 'Stage 2',
      detail: 'Consultant Appointment',
    });
  });

  it('fact 2: percent complete, or Not set', () => {
    expect(factComplete(34).value).toBe('34% complete');
    expect(factComplete(null).value).toBe(FACT_NOT_SET);
  });

  it('fact 3: names both dates, late, ahead, and on the day', () => {
    expect(factForecast('2028-04-14', '2027-12-31').detail).toBe(
      '15 weeks after your target of 31 December 2027'
    );
    expect(factForecast('2028-04-14', '2028-05-26').detail).toBe(
      '6 weeks before your target of 26 May 2028'
    );
    expect(factForecast('2028-04-14', '2028-04-14').detail).toBe(
      'Exactly your target of 14 April 2028'
    );
    expect(factForecast('2028-04-14', null).detail).toBe(
      'No target completion date set'
    );
    expect(factForecast(null, '2027-12-31').value).toBe(FACT_NOT_SET);
  });

  it('fact 4: the gate by its baked NAME, its date, and the bearing actions', () => {
    const gate = {
      stage: 2,
      name: 'Consultant Appointment',
      baselineDate: '2026-09-12',
    };
    const fact = factGate(gate, { open: 3, critical: 2 }, true);
    // The snapshot's own name, never synthesised from stage arithmetic:
    // "Gate 7 to 8" must be impossible to produce.
    expect(fact.value).toBe('Consultant Appointment');
    expect(fact.detail).toBe(
      '12 September 2026. 3 open actions bear on it, 2 critical.'
    );
    expect(factGate(gate, { open: 0, critical: 0 }, true).detail).toBe(
      '12 September 2026. No open actions bear on it.'
    );
    expect(factGate(null, { open: 0, critical: 0 }, true).value).toBe(
      'No gate ahead'
    );
    expect(factGate(null, { open: 0, critical: 0 }, false).value).toBe(
      FACT_NOT_SET
    );
  });
});

describe('the Time date line', () => {
  function signal(overrides) {
    return {
      targetCompletionDate: '2027-12-31',
      baselineCompletion: '2028-06-01',
      forecastCompletion: '2028-04-14',
      plannedWeeksLate: 22,
      slippedWeeks: -7,
      totalWeeksLate: 15,
      verdict: DATE_VERDICTS.PAST_TARGET,
      ...overrides,
    };
  }

  it('planning gap only', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: 22,
          slippedWeeks: 0,
          totalWeeksLate: 22,
        }),
      })
    );
    expect(line).toBe(
      'The programme you locked completes 22 weeks after your target. That was true the day you locked it.'
    );
  });

  it('delivery gap only', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: 0,
          slippedWeeks: 8,
          totalWeeksLate: 8,
        }),
      })
    );
    expect(line).toBe(
      'Your forecast completes 8 weeks after your target. The plan was sound; delivery has slipped.'
    );
  });

  it('both gaps', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: 22,
          slippedWeeks: 8,
          totalWeeksLate: 30,
        }),
      })
    );
    expect(line).toBe(
      'Your forecast completes 30 weeks after your target. 22 were baked in when you locked the programme, and 8 have slipped since.'
    );
  });

  it('pulling back, still late: the live fixture case', () => {
    const line = dateLine(row({ type: 'time', dateSignal: signal() }));
    expect(line).toBe(
      'Your forecast completes 15 weeks after your target. 22 were baked in when you locked the programme, and you have pulled back 7. It is not enough.'
    );
  });

  it('pulled back to clear', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: 22,
          slippedWeeks: -25,
          totalWeeksLate: -3,
          verdict: DATE_VERDICTS.NO_ROOM,
        }),
      })
    );
    expect(line).toBe(
      'You locked a programme that missed your target by 22 weeks. You have pulled back 25, and you are now forecast to make it.'
    );
  });

  it('no room', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: -1,
          slippedWeeks: -1,
          totalWeeksLate: -2,
          verdict: DATE_VERDICTS.NO_ROOM,
        }),
      })
    );
    expect(line).toBe(
      'You are forecast to make your target with 2 weeks in hand. There is no room left.'
    );
  });

  it('clear', () => {
    const line = dateLine(
      row({
        type: 'time',
        dateSignal: signal({
          plannedWeeksLate: -4,
          slippedWeeks: -5,
          totalWeeksLate: -9,
          verdict: DATE_VERDICTS.CLEAR,
        }),
      })
    );
    expect(line).toBe('Your forecast completes 9 weeks before your target.');
  });

  it('renders Separately on a Not scored Time row', () => {
    const line = dateLine(
      row({
        type: 'time',
        state: HEALTH_STATES.NOT_SCORED,
        trigger: { key: HEALTH_TRIGGERS.NOT_SCORED, detail: null },
        dateSignal: signal({
          plannedWeeksLate: null,
          slippedWeeks: null,
          totalWeeksLate: 15,
        }),
      })
    );
    expect(line).toBe(
      'Separately: your forecast completes 15 weeks after your target.'
    );
  });

  it('returns null with no date signal', () => {
    expect(dateLine(row({ type: 'time', dateSignal: null }))).toBeNull();
  });
});

describe('the drift notice', () => {
  it('live protected, baked standard', () => {
    const line = driftLine(
      row({ drift: { live: 'critical', baked: 'standard' } })
    );
    expect(line).toBe(
      'Cost is protected, but your locked programme still monitors it as standard. Re-baseline to bring them into line.'
    );
  });

  it('live flexible, baked critical', () => {
    const line = driftLine(
      row({ drift: { live: 'standard', baked: 'critical' } })
    );
    expect(line).toBe(
      'Cost is flexible, but your locked programme still monitors it as critical. Re-baseline to bring them into line.'
    );
  });

  it('null without drift', () => {
    expect(driftLine(row())).toBeNull();
  });
});

describe('the state labels and dates', () => {
  it('labels every state', () => {
    expect(stateLabel(row({ state: HEALTH_STATES.UNDER_PRESSURE }))).toBe(
      'Under pressure'
    );
    expect(stateLabel(row({ state: HEALTH_STATES.NOT_SCORED }))).toBe(
      'Not scored'
    );
  });

  it('gives the demoted classification its word', () => {
    expect(classificationWord(row({ isProtected: true }))).toBe('Protected');
    expect(classificationWord(row({ isProtected: false }))).toBe('Flexible');
  });

  it('formats dates day month year, UTC-safe', () => {
    expect(formatDate('2026-09-12')).toBe('12 September 2026');
    expect(formatDate(null)).toBeNull();
  });
});

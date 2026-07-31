import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  MILESTONE_TIER,
} from '../lib/engine/programmeTemplate.js';
import {
  STAGE_STATE,
  STATE_TRIGGER,
  WINDOW_ANCHOR_KIND,
  FROM_SCRATCH_ENTRY_STAGE,
  completedStagesForEntry,
  deriveStageStates,
} from '../lib/engine/stageStates.js';
import {
  deriveAdvisedDates,
  deriveRollingGateDates,
} from '../lib/engine/programmeSchedule.js';
import { deriveMilestoneView } from '../lib/engine/programmeMilestones.js';
import { deriveRealityCheck } from '../lib/engine/programmeRealityCheck.js';
import {
  assembleProgramme,
  ITEM_ORIGIN,
} from '../lib/engine/programmeAssembly.js';
import {
  reconcileBaseline,
  referenceFromChoices,
  DERIVATION_RULES,
  baselineCompletionGateEpoch,
} from '../lib/engine/programmeReconciliation.js';
import {
  deriveGateConfirmed,
  nextGateTransition,
} from '../app/pulse/app/workspace/sequenceModel.js';
import {
  LIST_CONFIG,
  scopeSuggestions,
} from '../app/pulse/app/components/listStepConfig.js';

/**
 * Mid-project adoption (Note 12 of the 23 Jul 2026 walkthrough). PULSE assumed
 * every project enters at initiation and moves forward from Stage 1, so a
 * developer with a live mid-lifecycle project was mis-sequenced: asked for
 * target-date decisions on stages already finished. These prove the declared
 * entry stage marks every earlier stage complete, that every stage-window
 * reader honours it (validation, advised dates, benchmarks, drill-down
 * derivation cover only the remaining stages), that completed stages take a
 * light actual-date backfill whose gates read completed prior to adoption and
 * are never fake-passed, that the adopter's next gate is its own next
 * transition and never Gate 1 to 2, that suggestions scope to the remaining
 * stages, that off-plan Stage 7 concurrency still applies to an adopter, and
 * that a from-scratch Stage 1 project is unchanged to the byte.
 */

const T = PROGRAMME_TEMPLATE;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);

// The declared Stage 5 adopter used throughout: stages 0 to 4 complete.
const ADOPTER = { entryStage: 5 };
const REMAINING = [5, 6, 7];
const COMPLETED = [0, 1, 2, 3, 4];

const statesFor = (baseline) => deriveStageStates(T, baseline);
const stateOf = (states, n) => states.stages.find((s) => s.stage === n);

// Empty choices for the whole template, the shape loadProgrammeChoices returns.
function makeChoices(template, spec = {}) {
  const stages = template.stages.map((s) => {
    const o = spec[s.stage] ?? {};
    const milestones = {};
    for (const [key, date] of Object.entries(o.milestones ?? {})) {
      milestones[key] = { target_date: iso(date) };
    }
    return {
      stage: s.stage,
      target_date: o.gate ? iso(o.gate) : '',
      target_na: o.na === true,
      milestones,
    };
  });
  return { stages };
}

// The objective rows for the criticality join: Cost is non-negotiable, the
// rest flexible, so a point serving cost is critical and one serving quality
// is standard.
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'flexible' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

// A compact two-level template for the assembly and reconciliation checks: one
// activity per stage, a headline milestone (the developer's) and a standard
// drill-down (the template's) in every stage, four-week gates. The real
// template's drill-downs are deferred content, so a synthetic one exercises
// the derivation rules deterministically.
const SYNTH = {
  version: 'synth-note12',
  stages: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({
    stage: n,
    name: `Stage ${n}`,
    gateWeeks: 4,
    activities: [
      {
        key: `a${n}`,
        name: `Activity ${n}`,
        typicalWeeks: 4,
        withinNormWeeks: { min: 2, max: 6 },
        milestones: [
          {
            key: `h${n}`,
            name: `Headline ${n}`,
            serves: 'time',
            offsetWeeks: 1,
            tier: MILESTONE_TIER.HEADLINE,
          },
          {
            key: `d${n}`,
            name: `Drilldown ${n}`,
            serves: 'quality',
            offsetWeeks: 2,
            tier: MILESTONE_TIER.DRILLDOWN,
          },
        ],
      },
    ],
    locationSensitive: [],
  })),
};

describe('completedStagesForEntry', () => {
  it('marks every stage before the declared stage complete for an adopter', () => {
    expect(completedStagesForEntry(5)).toEqual([0, 1, 2, 3, 4]);
    expect(completedStagesForEntry(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(completedStagesForEntry(2)).toEqual([0, 1]);
  });

  it('reads the from-scratch entry stage as nothing complete', () => {
    expect(FROM_SCRATCH_ENTRY_STAGE).toBe(1);
    expect(completedStagesForEntry(1)).toEqual([]);
    expect(completedStagesForEntry(0)).toEqual([]);
  });

  it('reads a missing or malformed entry stage as from scratch', () => {
    expect(completedStagesForEntry(undefined)).toEqual([]);
    expect(completedStagesForEntry(null)).toEqual([]);
    expect(completedStagesForEntry('not a stage')).toEqual([]);
    expect(completedStagesForEntry(2.5)).toEqual([]);
  });

  it('accepts the entry stage as a string, the controlled-select shape', () => {
    expect(completedStagesForEntry('5')).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('deriveStageStates with a declared entry stage', () => {
  it('marks stages 0 to 4 complete for a Stage 5 adopter, 5 to 7 sequential', () => {
    const states = statesFor(ADOPTER);
    for (const n of COMPLETED) {
      const s = stateOf(states, n);
      expect(s.state).toBe(STAGE_STATE.COMPLETE);
      expect(s.trigger).toBe(STATE_TRIGGER.DECLARED_COMPLETE);
      expect(s.windowAnchor.kind).toBe(WINDOW_ANCHOR_KIND.OPEN);
    }
    for (const n of REMAINING) {
      expect(stateOf(states, n).state).toBe(STAGE_STATE.SEQUENTIAL);
    }
  });

  it('is byte-identical to today for a from-scratch Stage 1 project', () => {
    const withEntry = statesFor({ entryStage: 1 });
    const without = statesFor({});
    expect(JSON.stringify(withEntry)).toBe(JSON.stringify(without));
  });

  it('keeps off-plan Stage 7 concurrency for an adopter', () => {
    const states = statesFor({
      entryStage: 5,
      fundingStructureType: 'off_plan_presales',
    });
    for (const n of COMPLETED) {
      expect(stateOf(states, n).state).toBe(STAGE_STATE.COMPLETE);
    }
    const s7 = stateOf(states, 7);
    expect(s7.state).toBe(STAGE_STATE.CONCURRENT);
    expect(s7.trigger).toBe(STATE_TRIGGER.OFF_PLAN_PRESALES);
    expect(s7.windowAnchor).toEqual({
      kind: WINDOW_ANCHOR_KIND.STAGE_GATE,
      stage: 3,
    });
  });

  it('lets a completed stage sit before a concurrent one, complete winning where both apply', () => {
    // A Stage 7 adopter in an off-plan scheme: stages 0 to 6 are history, and
    // complete beats concurrent on any stage both could claim.
    const states = statesFor({
      entryStage: 7,
      fundingStructureType: 'off_plan_presales',
    });
    for (let n = 0; n <= 6; n += 1) {
      expect(stateOf(states, n).state).toBe(STAGE_STATE.COMPLETE);
    }
    expect(stateOf(states, 7).state).toBe(STAGE_STATE.CONCURRENT);
  });
});

describe('advised dates for an adopter', () => {
  const states = statesFor(ADOPTER);

  it('advises no gate and no milestones for a completed stage', () => {
    const advised = deriveAdvisedDates(START, T, [], states);
    for (const n of COMPLETED) {
      const s = advised.stages.find((x) => x.stage === n);
      expect(s.gateAdvisedDate).toBeNull();
      expect(s.stageStart).toBeNull();
      expect(s.milestones).toEqual([]);
      expect(s.state).toBe(STAGE_STATE.COMPLETE);
    }
  });

  it('advises the remaining stages only, the first anchored on the project start', () => {
    const advised = deriveAdvisedDates(START, T, [], states);
    const s5def = T.stages.find((x) => x.stage === 5);
    const s5 = advised.stages.find((x) => x.stage === 5);
    // The completed stages advise nothing and add nothing, so the first
    // remaining gate counts from the project start.
    expect(s5.gateAdvisedDate).toEqual(w(s5def.gateWeeks));
    const s6 = advised.stages.find((x) => x.stage === 6);
    expect(s6.gateAdvisedDate).not.toBeNull();
    const s7 = advised.stages.find((x) => x.stage === 7);
    expect(s7.gateAdvisedDate).not.toBeNull();
  });

  it('is byte-identical to today for a from-scratch Stage 1 project', () => {
    const withEntry = deriveAdvisedDates(START, T, [], statesFor({ entryStage: 1 }));
    const without = deriveAdvisedDates(START, T, []);
    expect(JSON.stringify(withEntry)).toBe(JSON.stringify(without));
  });
});

describe('rolling gate dates for an adopter', () => {
  const states = statesFor(ADOPTER);

  it('advises nothing on a completed gate and leaves its window open', () => {
    const rolling = deriveRollingGateDates(START, T, makeChoices(T), states);
    for (const n of COMPLETED) {
      const s = rolling.stages.find((x) => x.stage === n);
      expect(s.advisedDate).toBeNull();
      expect(s.spanWeeks).toBeNull();
      expect(s.windowOpenStart).toBe(true);
    }
  });

  it('rolls the first remaining gate from a backfilled actual, not Gate 1 to 2 arithmetic', () => {
    // The developer records what happened on the stage 4 gate; the stage 5
    // advised date rolls from that recorded fact.
    const backfilled = w(-10);
    const rolling = deriveRollingGateDates(
      START,
      T,
      makeChoices(T, { 4: { gate: backfilled } }),
      states
    );
    const s5def = T.stages.find((x) => x.stage === 5);
    const s5 = rolling.stages.find((x) => x.stage === 5);
    expect(s5.anchorDate).toEqual(backfilled);
    expect(s5.advisedDate).toEqual(
      new Date(backfilled.getTime() + s5def.gateWeeks * MS_PER_WEEK)
    );
  });

  it('is byte-identical to today for a from-scratch Stage 1 project', () => {
    const withEntry = deriveRollingGateDates(
      START,
      T,
      makeChoices(T),
      statesFor({ entryStage: 1 })
    );
    const without = deriveRollingGateDates(START, T, makeChoices(T));
    expect(JSON.stringify(withEntry)).toBe(JSON.stringify(without));
  });
});

describe('milestone view for an adopter', () => {
  it('leaves a completed stage with no lower bound, an actual-date backfill', () => {
    const view = deriveMilestoneView(
      T,
      makeChoices(T),
      OBJECTIVES,
      iso(START),
      statesFor(ADOPTER)
    );
    for (const n of COMPLETED) {
      const s = view.stages.find((x) => x.stage === n);
      expect(s.state).toBe(STAGE_STATE.COMPLETE);
      for (const m of s.milestones) expect(m.minDate).toBeNull();
    }
    const s5 = view.stages.find((x) => x.stage === 5);
    expect(s5.state).toBe(STAGE_STATE.SEQUENTIAL);
  });
});

describe('reality check for an adopter', () => {
  it('raises no items for a completed stage, even a dated one: backfill is recorded fact, not a mismatch', () => {
    const choices = makeChoices(T, {
      3: { gate: w(-20) },
      4: { gate: w(-10) },
      5: { gate: w(60) },
    });
    const check = deriveRealityCheck(START, T, choices, {
      stageStates: statesFor(ADOPTER),
    });
    expect(check.items.every((item) => item.stage >= 5)).toBe(true);
    // The stage 5 gate was dated, so validation still covers the remaining
    // stages.
    expect(check.items.some((item) => item.stage === 5)).toBe(true);
  });

  it('is byte-identical to today for a from-scratch Stage 1 project', () => {
    const choices = makeChoices(T, { 0: { gate: w(8) }, 1: { gate: w(20) } });
    const withEntry = deriveRealityCheck(START, T, choices, {
      stageStates: statesFor({ entryStage: 1 }),
    });
    const without = deriveRealityCheck(START, T, choices, {});
    expect(JSON.stringify(withEntry)).toBe(JSON.stringify(without));
  });
});

describe('assembly for an adopter', () => {
  const states = deriveStageStates(SYNTH, ADOPTER);
  const backfilled = {
    2: { gate: w(-30), milestones: { h2: w(-32) } },
    4: { gate: w(-10) },
  };
  const assembled = assembleProgramme(
    START,
    SYNTH,
    makeChoices(SYNTH, backfilled),
    [],
    OBJECTIVES,
    { stageStates: states }
  );
  const stageOf = (n) => assembled.stages.find((s) => s.stage === n);
  const milestoneOf = (n, key) =>
    stageOf(n)
      .activities.flatMap((a) => a.milestones)
      .find((m) => m.key === key);

  it('records a completed gate as completed prior to adoption, never passed through the ceremony', () => {
    for (const n of COMPLETED) {
      expect(stageOf(n).state).toBe(STAGE_STATE.COMPLETE);
      expect(stageOf(n).gate.completedPriorToAdoption).toBe(true);
    }
    for (const n of REMAINING) {
      expect(stageOf(n).gate.completedPriorToAdoption).toBe(false);
    }
  });

  it('carries a backfilled actual on a completed gate and never fabricates one', () => {
    expect(stageOf(2).gate.baselineDate).toEqual(w(-30));
    expect(stageOf(4).gate.baselineDate).toEqual(w(-10));
    // Unbackfilled completed gates are honestly undated, never inherited from
    // a neighbouring gate.
    expect(stageOf(0).gate.baselineDate).toBeNull();
    expect(stageOf(3).gate.baselineDate).toBeNull();
  });

  it('carries a backfilled milestone actual and derives nothing in a completed stage', () => {
    expect(milestoneOf(2, 'h2').baselineDate).toEqual(w(-32));
    expect(milestoneOf(2, 'h2').origin).toBe(ITEM_ORIGIN.CARRIED);
    // The standard drill-downs of every completed stage stay undated: the
    // engine invents no history.
    for (const n of COMPLETED) {
      const d = milestoneOf(n, `d${n}`);
      expect(d.origin).toBe(ITEM_ORIGIN.ADDED);
      expect(d.baselineDate).toBeNull();
    }
  });

  it('derives drill-down dates in the remaining stages only, anchored on the backfilled record', () => {
    // The last backfilled gate (stage 4, w(-10)) carries the anchor, so stage
    // 5 starts there and its standard drill-down lands at start plus offset.
    expect(stageOf(5).stageStart).toEqual(w(-10));
    expect(milestoneOf(5, 'd5').baselineDate).toEqual(w(-8));
    for (const n of REMAINING) {
      expect(milestoneOf(n, `d${n}`).baselineDate).not.toBeNull();
    }
  });

  it('is byte-identical to today for a from-scratch Stage 1 project', () => {
    const choices = makeChoices(SYNTH, { 0: { gate: w(4) } });
    const withEntry = assembleProgramme(START, SYNTH, choices, [], OBJECTIVES, {
      stageStates: deriveStageStates(SYNTH, { entryStage: 1 }),
    });
    const without = assembleProgramme(START, SYNTH, choices, [], OBJECTIVES, {
      stageStates: deriveStageStates(SYNTH, {}),
    });
    expect(JSON.stringify(withEntry)).toBe(JSON.stringify(without));
  });
});

describe('lock reconciliation for an adopter', () => {
  const states = deriveStageStates(SYNTH, ADOPTER);
  const choices = makeChoices(SYNTH, {
    2: { gate: w(-30), milestones: { h2: w(-32) } },
    4: { gate: w(-10) },
    5: { gate: w(2) },
    6: { gate: w(6) },
    7: { gate: w(10) },
  });
  const assembled = assembleProgramme(START, SYNTH, choices, [], OBJECTIVES, {
    stageStates: states,
  });
  const result = reconcileBaseline({
    assembled,
    reference: referenceFromChoices(choices),
    resolutions: [],
    targetCompletionDate: iso(w(12)),
  });

  it('reads backfilled actuals as recorded fact, not as mismatches', () => {
    expect(result.ok).toBe(true);
    expect(result.differences).toEqual([]);
  });

  it('discloses an undated point in a completed stage under its own rule, not the protected one', () => {
    const completedUndated = result.derivations.filter(
      (d) => d.rule === DERIVATION_RULES.UNDATED_COMPLETED_STAGE
    );
    expect(completedUndated.length).toBeGreaterThan(0);
    expect(completedUndated.every((d) => d.stage <= 4)).toBe(true);
  });

  it('never reads a backfilled historic gate as the plan completion', () => {
    const completion = baselineCompletionGateEpoch(assembled);
    // The completion gate is the latest remaining gate (stage 7), never the
    // backfilled stage 4 record.
    expect(completion).toBe(w(10).getTime());
    expect(result.completion.breached).toBe(false);
  });
});

describe('the adopter sequence and next gate', () => {
  it('confirms the transition into the current stage from gates completed prior to adoption', () => {
    expect(
      deriveGateConfirmed({
        currentStage: 5,
        passedGateStages: [],
        completedPriorStages: completedStagesForEntry(5),
      })
    ).toBe(true);
  });

  it('does not confirm an adopter from passed rows alone: nothing is fake-passed', () => {
    expect(
      deriveGateConfirmed({ currentStage: 5, passedGateStages: [] })
    ).toBe(false);
  });

  it('keeps the from-scratch rule exactly as it was', () => {
    expect(
      deriveGateConfirmed({
        currentStage: 1,
        passedGateStages: [],
        completedPriorStages: completedStagesForEntry(1),
      })
    ).toBe(false);
    expect(
      deriveGateConfirmed({
        currentStage: 2,
        passedGateStages: [1],
        completedPriorStages: completedStagesForEntry(1),
      })
    ).toBe(true);
  });

  it("names the adopter's next gate as its own next transition, never Gate 1 to 2", () => {
    expect(nextGateTransition(5)).toEqual({ fromStage: 5, toStage: 6 });
    expect(nextGateTransition(1)).toEqual({ fromStage: 1, toStage: 2 });
    expect(nextGateTransition(7)).toBeNull();
  });
});

describe('suggestion scoping for an adopter', () => {
  // A stage-tagged fixture in the shape the starter sets use. It was the risk
  // starter set until Note 7 replaced that content with the RAID suggestion
  // engine; the scoping RULE this pins is unchanged and still serves Step 7's
  // milestones, so the test keeps its own fixture rather than depending on
  // content another note is free to rewrite.
  const SEEDED = [
    { description: 'Planning permission delayed or refused', stages: [2, 3] },
    { description: 'Construction costs exceed budget', stages: [4, 5] },
    { description: 'Funding delayed or falls through', stages: [1, 2, 3, 4, 5, 6, 7] },
    { description: 'Sales slower than forecast', stages: [3, 4, 5, 6, 7] },
  ];

  it('drops seeded items whose stages completed before adoption and keeps the remaining ones', () => {
    const scoped = scopeSuggestions(SEEDED, 5);
    const names = scoped.map((s) => s.description);
    expect(names).not.toContain('Planning permission delayed or refused');
    expect(names).toContain('Construction costs exceed budget');
    expect(names).toContain('Funding delayed or falls through');
    expect(names).toContain('Sales slower than forecast');
  });

  it('drops seeded milestones whose stages completed before adoption', () => {
    const scoped = scopeSuggestions(LIST_CONFIG.milestones.suggested, 5);
    const names = scoped.map((s) => s.name);
    expect(names).not.toContain('Planning approval secured');
    expect(names).not.toContain('Contractor appointed');
    expect(names).toContain('Construction commenced');
    expect(names).toContain('Handover complete');
  });

  it('keeps every suggestion for a from-scratch Stage 1 project and strips the tag', () => {
    const scoped = scopeSuggestions(SEEDED, 1);
    expect(scoped.length).toBe(SEEDED.length);
    for (const s of scoped) expect(s.stages).toBeUndefined();
  });

  it('reads a missing entry stage as from scratch', () => {
    const scoped = scopeSuggestions(LIST_CONFIG.milestones.suggested, undefined);
    expect(scoped.length).toBe(LIST_CONFIG.milestones.suggested.length);
  });
});

import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  MILESTONE_TIER,
  withinNormBand,
} from '../lib/engine/programmeTemplate.js';
import {
  STAGE_STATE,
  STATE_TRIGGER,
  WINDOW_ANCHOR_KIND,
  concurrencyTrigger,
  deriveStageStates,
  stageStateFor,
  stageStateLookup,
} from '../lib/engine/stageStates.js';
import {
  deriveAdvisedDates,
  deriveRollingGateDates,
} from '../lib/engine/programmeSchedule.js';
import { deriveMilestoneView } from '../lib/engine/programmeMilestones.js';
import {
  deriveRealityCheck,
  RECONCILE_TIERS,
} from '../lib/engine/programmeRealityCheck.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';

/**
 * The stage-state model and the four stage-window readers that consume it
 * (notes 5 and 6 of the 23 Jul 2026 walkthrough).
 *
 * Note 6. Stage 7 Sales and Disposal was validated inside a strict sequential
 * window, so "First unit exchanged" could only be dated at project completion.
 * For an off-plan or Nigeria scheme sales run concurrent with construction
 * (framework Section 8), and these prove the concurrent state opens the window
 * at sales launch, measures the benchmark from there, and places a derived
 * milestone there, while stages 0 to 6 stay strictly sequential.
 *
 * Note 5. Each gate's advised date must be a deterministic function of its
 * inputs: the prior gate date, or the project start for the first open gate,
 * plus the stated typical span. These prove the invariant holds gate by gate
 * across every combination of chosen, undated, N/A and complete stages, which
 * is what makes the helper text reconcile with the suggestion it sits under.
 *
 * The project start is the one from the walkthrough, 2 Nov 2026, so the reported
 * arithmetic is asserted directly. Distances are checked in whole weeks from
 * that fixed UTC anchor rather than as hand-computed calendar dates, so nothing
 * depends on the test runner's timezone.
 */

const START = new Date(Date.UTC(2026, 10, 2)); // 2026-11-02
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const weeksFromStart = (date) => (date.getTime() - START.getTime()) / MS_PER_WEEK;
// A date a whole number of weeks after the project start, as the 'YYYY-MM-DD'
// string a date input holds.
const w = (weeks) =>
  new Date(START.getTime() + weeks * MS_PER_WEEK).toISOString().slice(0, 10);

const stageOf = (result, n) => result.stages.find((s) => s.stage === n);

// The advised gate positions, in whole weeks from the project start, when every
// gate is left undated: the running sum of the template's gate durations.
const ADVISED_GATE_WEEKS = { 0: 12, 1: 20, 2: 26, 3: 56, 4: 68, 5: 120, 6: 126, 7: 146 };

// The baselines the two concurrency triggers come from.
const OFF_PLAN = { fundingStructureType: 'off_plan_presales', country: 'united_kingdom' };
const NIGERIA = { fundingStructureType: 'development_finance', country: 'nigeria' };
const SEQUENTIAL_BASELINE = {
  fundingStructureType: 'development_finance',
  country: 'united_kingdom',
};

// Build the developer's programme choices: a per-stage gate date (a 'YYYY-MM-DD'
// string), an N/A flag, and per-milestone dates keyed by the stable key. Mirrors
// the fixtures the sibling reconcile tests build.
function makeChoices(spec = {}) {
  return {
    stages: PROGRAMME_TEMPLATE.stages.map((s) => {
      const entry = spec[s.stage] ?? {};
      return {
        stage: s.stage,
        target_date: entry.gate ?? '',
        target_na: entry.na === true,
        milestones: entry.milestones ?? {},
      };
    }),
  };
}

// Every gate dated on its advised week, the clean baseline a walkthrough
// produces by accepting each suggestion in turn.
const ALL_ADVISED = makeChoices(
  Object.fromEntries(
    Object.entries(ADVISED_GATE_WEEKS).map(([stage, weeks]) => [
      stage,
      { gate: w(weeks) },
    ])
  )
);

const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'flexible' },
  { id: 'o-time', objective_type: 'time', classification: 'flexible' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

describe('deriveStageStates, reading the state off the baseline', () => {
  it('leaves every stage sequential with no baseline at all', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, undefined);
    expect(states.stages).toHaveLength(8);
    for (const s of states.stages) {
      expect(s.state).toBe(STAGE_STATE.SEQUENTIAL);
      expect(s.trigger).toBeNull();
      expect(s.windowAnchor.kind).toBe(WINDOW_ANCHOR_KIND.PREVIOUS_GATE);
    }
  });

  it('leaves every stage sequential for a UK development-finance scheme', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, SEQUENTIAL_BASELINE);
    for (const s of states.stages) expect(s.state).toBe(STAGE_STATE.SEQUENTIAL);
  });

  it('makes stage 7 concurrent when the funding structure is off-plan presales', () => {
    const stage7 = stageOf(deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN), 7);
    expect(stage7.state).toBe(STAGE_STATE.CONCURRENT);
    expect(stage7.trigger).toBe(STATE_TRIGGER.OFF_PLAN_PRESALES);
    expect(stage7.windowAnchor).toEqual({
      kind: WINDOW_ANCHOR_KIND.STAGE_GATE,
      stage: 3,
    });
    expect(stage7.windowAnchorLabel).toBe('sales launch');
  });

  it('makes stage 7 concurrent when the project country is Nigeria', () => {
    const stage7 = stageOf(deriveStageStates(PROGRAMME_TEMPLATE, NIGERIA), 7);
    expect(stage7.state).toBe(STAGE_STATE.CONCURRENT);
    expect(stage7.trigger).toBe(STATE_TRIGGER.NIGERIA);
  });

  it('leaves stages 0 to 6 sequential when stage 7 turns concurrent', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, NIGERIA);
    for (let n = 0; n <= 6; n += 1) {
      expect(stageOf(states, n).state).toBe(STAGE_STATE.SEQUENTIAL);
    }
  });

  it('reports the funding reason where both triggers are true', () => {
    const both = { fundingStructureType: 'off_plan_presales', country: 'nigeria' };
    expect(concurrencyTrigger(both)).toBe(STATE_TRIGGER.OFF_PLAN_PRESALES);
  });

  it('matches a trigger value that arrives with stray case or whitespace', () => {
    expect(concurrencyTrigger({ country: '  Nigeria ' })).toBe(
      STATE_TRIGGER.NIGERIA
    );
    expect(concurrencyTrigger({ fundingStructureType: 'OFF_PLAN_PRESALES' })).toBe(
      STATE_TRIGGER.OFF_PLAN_PRESALES
    );
  });

  it('triggers nothing on an absent or blank baseline value', () => {
    expect(concurrencyTrigger({ country: '', fundingStructureType: null })).toBeNull();
    expect(concurrencyTrigger({})).toBeNull();
  });

  it('marks a declared stage complete, and complete beats concurrent', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, {
      ...NIGERIA,
      completedStages: [0, 1, 7],
    });
    expect(stageOf(states, 0).state).toBe(STAGE_STATE.COMPLETE);
    expect(stageOf(states, 0).trigger).toBe(STATE_TRIGGER.DECLARED_COMPLETE);
    expect(stageOf(states, 0).windowAnchor.kind).toBe(WINDOW_ANCHOR_KIND.OPEN);
    // Stage 7 would be concurrent under this baseline; already complete wins.
    expect(stageOf(states, 7).state).toBe(STAGE_STATE.COMPLETE);
    expect(stageOf(states, 2).state).toBe(STAGE_STATE.SEQUENTIAL);
  });

  it('defaults an unknown stage to sequential through the lookup', () => {
    const lookup = stageStateLookup(deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN));
    expect(stageStateFor(lookup, 7).state).toBe(STAGE_STATE.CONCURRENT);
    expect(stageStateFor(lookup, 99).state).toBe(STAGE_STATE.SEQUENTIAL);
    expect(stageStateFor(undefined, 7).state).toBe(STAGE_STATE.SEQUENTIAL);
  });
});

describe('note 5, an advised date is its anchor plus its stated span', () => {
  it('advises stage 0 at the project start plus the twelve weeks it cites', () => {
    // The walkthrough's own case: 2 Nov 2026 plus the cited twelve-week span.
    const rolling = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, makeChoices());
    const stage0 = stageOf(rolling, 0);
    expect(stage0.spanWeeks).toBe(12);
    expect(stage0.anchorDate.getTime()).toBe(START.getTime());
    expect(stage0.advisedDate.toISOString().slice(0, 10)).toBe('2027-01-25');
  });

  it('holds advised equals anchor plus span on every open gate, undated', () => {
    const rolling = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, makeChoices());
    for (const stage of rolling.stages) {
      expect(stage.advisedDate.getTime()).toBe(
        stage.anchorDate.getTime() + stage.spanWeeks * MS_PER_WEEK
      );
      expect(stage.spanWeeks).toBe(stage.gateWeeks);
    }
  });

  it('anchors the first open gate on the project start and each later gate on the one before', () => {
    const rolling = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, makeChoices());
    expect(stageOf(rolling, 0).anchorDate.getTime()).toBe(START.getTime());
    for (let n = 1; n <= 7; n += 1) {
      expect(stageOf(rolling, n).anchorDate.getTime()).toBe(
        stageOf(rolling, n - 1).effectiveDate.getTime()
      );
    }
  });

  it('anchors on the developer date where one gate is chosen away from advised', () => {
    // Stage 0 dated eight weeks later than advised: every later anchor follows.
    const rolling = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      makeChoices({ 0: { gate: w(20) } })
    );
    const stage1 = stageOf(rolling, 1);
    expect(weeksFromStart(stage1.anchorDate)).toBe(20);
    expect(stage1.spanWeeks).toBe(8);
    expect(weeksFromStart(stage1.advisedDate)).toBe(28);
    expect(stage1.advisedDate.getTime()).toBe(
      stage1.anchorDate.getTime() + stage1.spanWeeks * MS_PER_WEEK
    );
  });

  it('carries the anchor unchanged across an N/A gate', () => {
    const rolling = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      makeChoices({ 0: { gate: w(12) }, 1: { na: true } })
    );
    expect(stageOf(rolling, 1).advisedDate).toBeNull();
    expect(stageOf(rolling, 1).anchorDate).toBeNull();
    // Stage 2 anchors on stage 0, the last applicable gate, not on the skipped one.
    expect(weeksFromStart(stageOf(rolling, 2).anchorDate)).toBe(12);
    expect(weeksFromStart(stageOf(rolling, 2).advisedDate)).toBe(18);
  });

  it('advises nothing for a stage already complete, and carries its date forward', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, {
      ...SEQUENTIAL_BASELINE,
      completedStages: [0],
    });
    const rolling = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      makeChoices({ 0: { gate: w(9) } }),
      states
    );
    const stage0 = stageOf(rolling, 0);
    expect(stage0.state).toBe(STAGE_STATE.COMPLETE);
    expect(stage0.advisedDate).toBeNull();
    expect(stage0.spanWeeks).toBeNull();
    expect(stage0.windowOpenStart).toBe(true);
    // The recorded date still seeds the chain: stage 1 rolls from what happened.
    expect(weeksFromStart(stageOf(rolling, 1).anchorDate)).toBe(9);
    expect(weeksFromStart(stageOf(rolling, 1).advisedDate)).toBe(17);
  });

  it('leaves the concurrent stage gate advising in sequence, unchanged', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const concurrent = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      makeChoices(),
      states
    );
    const strict = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, makeChoices());
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(concurrent, n).advisedDate.getTime()).toBe(
        stageOf(strict, n).advisedDate.getTime()
      );
    }
  });

  it('opens the concurrent stage window at sales launch, not at the previous gate', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const rolling = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      ALL_ADVISED,
      states
    );
    // Sequential: each stage's window start is the gate before it.
    expect(weeksFromStart(stageOf(rolling, 6).windowStart)).toBe(
      ADVISED_GATE_WEEKS[5]
    );
    // Concurrent: stage 7 opens at the stage 3 gate, consent secured.
    expect(weeksFromStart(stageOf(rolling, 7).windowStart)).toBe(
      ADVISED_GATE_WEEKS[3]
    );
    expect(stageOf(rolling, 7).windowStartLabel).toBe('sales launch');
  });
});

describe('note 6, the stage-window validation', () => {
  const chosen = {
    0: { gate: w(12) },
    1: { gate: w(20) },
    2: { gate: w(26) },
    3: { gate: w(56) },
    4: { gate: w(68) },
    5: { gate: w(120) },
    6: { gate: w(126) },
    7: { gate: w(146) },
  };

  it('confines a sequential stage 7 milestone to the window after completion', () => {
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices(chosen),
      OBJECTIVES,
      START
    );
    const stage7 = stageOf(view, 7);
    expect(stage7.state).toBe(STAGE_STATE.SEQUENTIAL);
    // The reported behaviour: the earliest date allowed is the completion gate.
    expect(stage7.milestones[0].minDate).toBe(w(126));
    expect(stage7.milestones[0].maxDate).toBe(w(146));
  });

  it('opens a concurrent stage 7 milestone from sales launch to the stage 7 gate', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices(chosen),
      OBJECTIVES,
      START,
      states
    );
    const stage7 = stageOf(view, 7);
    const firstExchange = stage7.milestones.find((m) => m.key === 'first_exchange');
    expect(stage7.state).toBe(STAGE_STATE.CONCURRENT);
    expect(firstExchange.minDate).toBe(w(56)); // the consent gate
    expect(firstExchange.maxDate).toBe(w(146)); // the end of the programme
    // A first exchange dated mid-construction now sits inside the window.
    const midConstruction = w(90);
    expect(midConstruction > firstExchange.minDate).toBe(true);
    expect(midConstruction < firstExchange.maxDate).toBe(true);
  });

  it('leaves stages 0 to 6 strictly sequential when stage 7 is concurrent', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, NIGERIA);
    const strict = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices(chosen),
      OBJECTIVES,
      START
    );
    const withStates = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices(chosen),
      OBJECTIVES,
      START,
      states
    );
    for (let n = 0; n <= 6; n += 1) {
      expect(stageOf(withStates, n).milestones).toEqual(
        stageOf(strict, n).milestones
      );
    }
  });

  it('leaves the concurrent window open where the anchor gate is not yet dated', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    // Stage 3 applicable but undated: nothing pins sales launch yet.
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices({ ...chosen, 3: {} }),
      OBJECTIVES,
      START,
      states
    );
    expect(stageOf(view, 7).milestones[0].minDate).toBeNull();
  });

  it('steps back past an N/A anchor gate to the applicable stage before it', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices({ ...chosen, 3: { na: true } }),
      OBJECTIVES,
      START,
      states
    );
    // Stage 3 is out of the programme, so the window opens at the stage 2 gate.
    expect(stageOf(view, 7).milestones[0].minDate).toBe(w(26));
  });

  it('gives a stage already complete no lower bound', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, {
      ...SEQUENTIAL_BASELINE,
      completedStages: [1],
    });
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      makeChoices(chosen),
      OBJECTIVES,
      START,
      states
    );
    const stage1 = stageOf(view, 1);
    expect(stage1.state).toBe(STAGE_STATE.COMPLETE);
    // Its dates are history, so the project start is not a floor under them.
    expect(stage1.milestones[0].minDate).toBeNull();
    expect(stage1.milestones[0].maxDate).toBe(w(20));
  });
});

describe('note 6, the typical-span benchmark', () => {
  // Sales finished with the build, so the developer dates the stage 7 gate on
  // the completion gate. This is the walkthrough's case.
  const salesWithBuild = makeChoices({
    3: { gate: w(56) },
    5: { gate: w(120) },
    6: { gate: w(126) },
    7: { gate: w(126) },
  });

  it('reads a sequential stage 7 as no duration and pushes disposal past completion', () => {
    // The behaviour as it stood, held here so the fix is measured against it.
    const check = deriveRealityCheck(START, PROGRAMME_TEMPLATE, salesWithBuild);
    const gate7 = check.items.find((i) => i.key === 'gate_7');
    expect(gate7.implied.weeks).toBe(0);
    expect(gate7.tier).toBe(RECONCILE_TIERS.PROPOSE);
    // It recommends disposal thirty-two weeks after practical completion.
    expect(weeksFromStart(gate7.recommendedDate)).toBe(126 + 32);
  });

  it('measures a concurrent stage 7 from sales launch and reads it within norm', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const check = deriveRealityCheck(START, PROGRAMME_TEMPLATE, salesWithBuild, {
      stageStates: states,
    });
    const gate7 = check.items.find((i) => i.key === 'gate_7');
    expect(gate7.implied.weeks).toBe(126 - 56); // launch to disposal
    expect(gate7.implied.band.max).toBeNull(); // no upper norm on an overlap
    expect(gate7.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
    expect(gate7.recommendedDate).toBeNull();
    expect(gate7.reason).toBe('');
  });

  it('still flags a concurrent stage 7 too short to contain its own work', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    // Four weeks from consent to full disposal, well under the sixteen-week floor.
    const tooShort = makeChoices({ 3: { gate: w(56) }, 7: { gate: w(60) } });
    const check = deriveRealityCheck(START, PROGRAMME_TEMPLATE, tooShort, {
      stageStates: states,
    });
    const gate7 = check.items.find((i) => i.key === 'gate_7');
    expect(gate7.implied.weeks).toBe(4);
    expect(gate7.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(gate7.reason).toContain('below the 16 week minimum');
    expect(gate7.reason).toContain('alongside the rest of the programme');
  });

  it('leaves every sequential stage benchmark untouched', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const strict = deriveRealityCheck(START, PROGRAMME_TEMPLATE, ALL_ADVISED);
    const withStates = deriveRealityCheck(START, PROGRAMME_TEMPLATE, ALL_ADVISED, {
      stageStates: states,
    });
    for (const item of strict.items.filter((i) => i.stage <= 6)) {
      const same = withStates.items.find((i) => i.key === item.key);
      expect(same).toEqual(item);
    }
  });

  it('raises no item for a stage already complete', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, {
      ...SEQUENTIAL_BASELINE,
      completedStages: [0],
    });
    // A stage 0 that ran three weeks would be far below its norm as a plan.
    const choices = makeChoices({ 0: { gate: w(3) }, 1: { gate: w(20) } });
    const strict = deriveRealityCheck(START, PROGRAMME_TEMPLATE, choices);
    const withStates = deriveRealityCheck(START, PROGRAMME_TEMPLATE, choices, {
      stageStates: states,
    });
    expect(strict.items.some((i) => i.stage === 0)).toBe(true);
    expect(withStates.items.some((i) => i.stage === 0)).toBe(false);
    // The stages after it are still checked.
    expect(withStates.items.some((i) => i.stage === 1)).toBe(true);
  });

  it('measures a concurrent stage milestone offset from sales launch', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    // First exchange ten weeks after consent, inside the eight-week norm's band.
    const choices = makeChoices({
      3: { gate: w(56) },
      6: { gate: w(126) },
      7: { gate: w(146), milestones: { first_exchange: { target_date: w(66) } } },
    });
    const check = deriveRealityCheck(START, PROGRAMME_TEMPLATE, choices, {
      stageStates: states,
    });
    const exchange = check.items.find((i) => i.key === 'first_exchange');
    expect(exchange.implied.weeks).toBe(10);
    expect(exchange.implied.band.min).toBe(withinNormBand(8).min);
    expect(exchange.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);

    // Measured the old way, from the completion gate, the same date sits sixty
    // weeks before its own stage start and is flagged.
    const strict = deriveRealityCheck(START, PROGRAMME_TEMPLATE, choices);
    const strictExchange = strict.items.find((i) => i.key === 'first_exchange');
    expect(strictExchange.implied.weeks).toBe(-60);
    expect(strictExchange.tier).toBe(RECONCILE_TIERS.PROPOSE);
  });

  it('accepts a concurrent stage milestone dated far into the build', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const choices = makeChoices({
      3: { gate: w(56) },
      7: { gate: w(146), milestones: { first_exchange: { target_date: w(90) } } },
    });
    const check = deriveRealityCheck(START, PROGRAMME_TEMPLATE, choices, {
      stageStates: states,
    });
    const exchange = check.items.find((i) => i.key === 'first_exchange');
    expect(exchange.implied.weeks).toBe(34);
    expect(exchange.implied.band.max).toBeNull();
    expect(exchange.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });
});

describe('note 6, the drill-down derivation', () => {
  // The shipped template has no drill-down milestone in stage 7, so this fixture
  // adds one to activity 7a to exercise the derivation path directly. Everything
  // else is the real template.
  const templateWithStage7Drilldown = {
    ...PROGRAMME_TEMPLATE,
    stages: PROGRAMME_TEMPLATE.stages.map((s) =>
      s.stage !== 7
        ? s
        : {
            ...s,
            activities: s.activities.map((a, i) =>
              i !== 0
                ? a
                : {
                    ...a,
                    milestones: [
                      ...a.milestones,
                      {
                        key: 'reservations_open',
                        name: 'Reservations open',
                        serves: 'scope',
                        offsetWeeks: 4,
                        tier: MILESTONE_TIER.DRILLDOWN,
                      },
                    ],
                  }
            ),
          }
    ),
  };

  const dated = makeChoices({
    3: { gate: w(56) },
    6: { gate: w(126) },
    7: { gate: w(146) },
  });

  const drilldownOf = (programme) =>
    stageOf(programme, 7)
      .activities.flatMap((a) => a.milestones)
      .find((m) => m.key === 'reservations_open');

  it('places a sequential stage 7 drill-down after the completion gate', () => {
    // The behaviour as it stood: four weeks past practical completion.
    const programme = assembleProgramme(
      START,
      templateWithStage7Drilldown,
      dated,
      [],
      OBJECTIVES
    );
    expect(weeksFromStart(drilldownOf(programme).baselineDate)).toBe(126 + 4);
  });

  it('places a concurrent stage 7 drill-down on the sales launch anchor', () => {
    const states = deriveStageStates(templateWithStage7Drilldown, OFF_PLAN);
    const programme = assembleProgramme(
      START,
      templateWithStage7Drilldown,
      dated,
      [],
      OBJECTIVES,
      { stageStates: states }
    );
    expect(weeksFromStart(drilldownOf(programme).baselineDate)).toBe(56 + 4);
    // The gate itself is untouched: it still closes the stage in sequence.
    expect(weeksFromStart(stageOf(programme, 7).gate.baselineDate)).toBe(146);
    expect(weeksFromStart(stageOf(programme, 7).stageStart)).toBe(56);
  });

  it('advises a concurrent stage 7 milestone from launch, not from completion', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const strict = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    const concurrent = deriveAdvisedDates(START, PROGRAMME_TEMPLATE, [], states);
    const advisedFor = (result) =>
      weeksFromStart(
        stageOf(result, 7).milestones.find((m) => m.name === 'First unit exchanged')
          .advisedDate
      );
    // Eight weeks past the completion gate before, eight weeks past consent now.
    expect(advisedFor(strict)).toBe(ADVISED_GATE_WEEKS[6] + 8);
    expect(advisedFor(concurrent)).toBe(ADVISED_GATE_WEEKS[3] + 8);
  });

  it('leaves the whole assembly untouched for a sequential baseline', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, SEQUENTIAL_BASELINE);
    const strict = assembleProgramme(
      START,
      PROGRAMME_TEMPLATE,
      ALL_ADVISED,
      [],
      OBJECTIVES
    );
    const withStates = assembleProgramme(
      START,
      PROGRAMME_TEMPLATE,
      ALL_ADVISED,
      [],
      OBJECTIVES,
      { stageStates: states }
    );
    expect(withStates).toEqual(strict);
  });
});

describe('purity and determinism', () => {
  it('gives the same result for the same inputs', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, NIGERIA);
    const a = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, ALL_ADVISED, states);
    const b = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, ALL_ADVISED, states);
    expect(a).toEqual(b);
  });

  it('never mutates the template or the choices it is given', () => {
    const states = deriveStageStates(PROGRAMME_TEMPLATE, OFF_PLAN);
    const choicesBefore = JSON.stringify(ALL_ADVISED);
    deriveRollingGateDates(START, PROGRAMME_TEMPLATE, ALL_ADVISED, states);
    deriveRealityCheck(START, PROGRAMME_TEMPLATE, ALL_ADVISED, { stageStates: states });
    deriveMilestoneView(PROGRAMME_TEMPLATE, ALL_ADVISED, OBJECTIVES, START, states);
    expect(JSON.stringify(ALL_ADVISED)).toBe(choicesBefore);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  PROGRAMME_TEMPLATE_VERSION,
  withinNormBand,
} from '../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../lib/engine/programmeRealityCheck.js';
import {
  RECONCILE_DECISIONS,
  buildResolutions,
} from '../app/pulse/app/programme/setup/reconcileModel.js';
import {
  assembleProgramme,
  ITEM_ORIGIN,
} from '../lib/engine/programmeAssembly.js';

/**
 * The Programme assembly engine (Programme module Phase 2.1). Proves it applies
 * the reconcile resolutions to get agreed dates, builds the agreed skeleton from
 * those (so a moved gate moves the following stage), places headline milestones on
 * their agreed date and drill-down milestones by their absolute offset on the
 * skeleton, bakes criticality from the served objective, assembles an activity
 * with no milestones cleanly, produces a fully-resolved deterministic programme,
 * and is pure.
 *
 * A fixed UTC anchor keeps every assertion independent of the test runner's
 * timezone. Positions are checked in whole weeks from that anchor rather than
 * hand-computed calendar dates. The real eight drill-down milestones are deferred
 * content, so a synthetic two-level fixture with several drill-down milestones per
 * stage exercises the moved-gate and absolute-offset placement.
 */

const T = PROGRAMME_TEMPLATE;
const { ACCEPTED, KEPT, VERIFIED } = RECONCILE_DECISIONS;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// A Date a whole number of weeks after the fixed anchor, in UTC.
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
// An ISO date input value (YYYY-MM-DD), as the date input gives.
const iso = (date) => date.toISOString().slice(0, 10);
// Whole-week distance of a Date from the anchor.
const weeksFromStart = (date) => (date.getTime() - START.getTime()) / MS_PER_WEEK;

// Build the developer's programme choices from a compact per-stage spec, for any
// template, the same shape loadProgrammeChoices returns:
//   { [stage]: { gate?: Date, na?: boolean, milestones?: { [key]: Date } } }
function makeChoices(template, spec) {
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

// Navigation helpers over the assembled programme.
const stageOf = (prog, n) => prog.stages.find((s) => s.stage === n);
const gateOf = (prog, n) => stageOf(prog, n).gate;
const activityOf = (prog, n, key) =>
  stageOf(prog, n).activities.find((a) => a.key === key);
const milestoneOf = (prog, n, key) => {
  for (const a of stageOf(prog, n).activities) {
    const m = a.milestones.find((x) => x.key === key);
    if (m) return m;
  }
  return undefined;
};

// The project's objective rows for the criticality join. Cost and Time are
// non-negotiable (critical), Quality and Funding are flexible (standard), so the
// real template's milestones split cleanly: heads_of_terms (cost) is critical,
// lead_consultant (quality) is standard.
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

// The advised, gateWeeks-derived dates, accepted in full: every gate and every
// headline milestone at its advised position. Gate weeks 12, 20, 26, 56, 68, 120,
// 126, 146 from the start; each milestone at its stage start plus its offset.
const ADVISED_SPEC = {
  0: { gate: w(12), milestones: { heads_of_terms: w(6) } },
  1: { gate: w(20), milestones: { finance_committed: w(18) } },
  2: { gate: w(26), milestones: { lead_consultant: w(24) } },
  3: { gate: w(56), milestones: { planning_validated: w(40) } },
  4: { gate: w(68), milestones: { tenders_returned: w(64) } },
  5: { gate: w(120), milestones: { superstructure: w(94), finishing: w(112) } },
  6: { gate: w(126), milestones: { completion_certificate: w(124) } },
  7: { gate: w(146), milestones: { first_exchange: w(134) } },
};

// A synthetic two-level template with several drill-down milestones per stage, so
// the placement and moved-gate behaviour can be exercised where the real template
// has only headline milestones today. Two stages are enough to show a moved gate
// shifting the next stage.
const mkAct = (key, name, typicalWeeks, milestones) => ({
  key,
  name,
  typicalWeeks,
  withinNormWeeks: withinNormBand(typicalWeeks),
  milestones,
});
// The synthetic milestones are tagged drill-down: derivation only ever dates a
// drill-down point (a headline point the developer left undated stays undated,
// covered in its own describe below). The objectives here are all flexible so
// every drill-down is standard and takes its derived date; the critical
// drill-down staying undated is covered in its own describe too.
const SYNTH = {
  version: 'synth-1.0.0',
  stages: [
    {
      stage: 0,
      name: 'Alpha',
      gateWeeks: 10,
      activities: [
        mkAct('a0_one', 'Alpha one', 5, [
          { key: 'a0_m1', name: 'Alpha m1', serves: 'cost', offsetWeeks: 2, tier: 'drilldown' },
          { key: 'a0_m2', name: 'Alpha m2', serves: 'time', offsetWeeks: 8, tier: 'drilldown' },
        ]),
        mkAct('a0_two', 'Alpha two', 5, []),
      ],
      locationSensitive: [],
    },
    {
      stage: 1,
      name: 'Beta',
      gateWeeks: 12,
      activities: [
        mkAct('b1_one', 'Beta one', 6, [
          { key: 'b1_m1', name: 'Beta m1', serves: 'quality', offsetWeeks: 3, tier: 'drilldown' },
          { key: 'b1_m2', name: 'Beta m2', serves: 'funding', offsetWeeks: 10, tier: 'drilldown' },
        ]),
        mkAct('b1_two', 'Beta two', 6, []),
      ],
      locationSensitive: [],
    },
  ],
};
const SYNTH_OBJECTIVES = [
  { id: 's-cost', objective_type: 'cost', classification: 'flexible' },
  { id: 's-time', objective_type: 'time', classification: 'flexible' },
  { id: 's-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 's-funding', objective_type: 'funding', classification: 'flexible' },
];

// Run the genuine reconcile pipeline (reality check then resolution set) and
// assemble, so the engine is tested against the real shape the 1.2 flow emits, not
// a hand-mocked one.
function assembleVia(template, spec, decisions, objectives, options) {
  const choices = makeChoices(template, spec);
  const rc = deriveRealityCheck(START, template, choices, options);
  const resolutions = buildResolutions(rc, decisions ?? {});
  const prog = assembleProgramme(START, template, choices, resolutions, objectives);
  return { prog, rc, resolutions, choices };
}

describe('an empty resolution set uses the developer dates throughout', () => {
  const choices = makeChoices(T, ADVISED_SPEC);
  const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);

  it('dates every gate on the developer date', () => {
    expect(weeksFromStart(gateOf(prog, 0).baselineDate)).toBe(12);
    expect(weeksFromStart(gateOf(prog, 1).baselineDate)).toBe(20);
    expect(weeksFromStart(gateOf(prog, 7).baselineDate)).toBe(146);
    expect(gateOf(prog, 0).origin).toBe(ITEM_ORIGIN.CARRIED);
  });

  it('dates every developer-dated headline milestone on the developer date, tagged carried', () => {
    const hot = milestoneOf(prog, 0, 'heads_of_terms');
    expect(weeksFromStart(hot.baselineDate)).toBe(6);
    expect(hot.origin).toBe(ITEM_ORIGIN.CARRIED);
    expect(weeksFromStart(milestoneOf(prog, 5, 'finishing').baselineDate)).toBe(112);
  });

  it('echoes the template version and the project start', () => {
    expect(prog.version).toBe(PROGRAMME_TEMPLATE_VERSION);
    expect(prog.projectStart.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  it('treats absent resolutions the same as an empty set', () => {
    const a = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const b = assembleProgramme(START, T, choices, undefined, OBJECTIVES);
    expect(b).toEqual(a);
  });
});

describe('resolutions are applied to get the agreed date', () => {
  it('an accepted gate propose moves the gate to the recommendation and the next stage start with it', () => {
    // Stage 0 gate at 31 weeks: propose (band 10 to 30), recommended back to the
    // activity-sum typical (20 weeks). Accepting agrees 20 weeks.
    const { prog } = assembleVia(T, { 0: { gate: w(31) } }, {
      gate_0: { decision: ACCEPTED, note: '' },
    });
    expect(weeksFromStart(gateOf(prog, 0).baselineDate)).toBe(20);
    // Stage 1 starts where the agreed gate 0 lands, not at the developer's 31.
    expect(weeksFromStart(stageOf(prog, 1).stageStart)).toBe(20);
  });

  it('an accepted milestone propose moves the milestone to the recommended offset', () => {
    // heads_of_terms at 10 weeks: offset band 3 to 9, propose; recommended back to
    // the curated 6 week offset. Accepting agrees 6 weeks.
    const { prog } = assembleVia(T, { 0: { milestones: { heads_of_terms: w(10) } } }, {
      heads_of_terms: { decision: ACCEPTED, note: '' },
    });
    const hot = milestoneOf(prog, 0, 'heads_of_terms');
    expect(weeksFromStart(hot.baselineDate)).toBe(6);
    expect(hot.origin).toBe(ITEM_ORIGIN.CARRIED);
  });

  it('a kept propose keeps the developer date and records it carried', () => {
    const { prog } = assembleVia(T, { 0: { milestones: { heads_of_terms: w(10) } } }, {
      heads_of_terms: { decision: KEPT, note: 'Holding to the agent timeline.' },
    });
    const hot = milestoneOf(prog, 0, 'heads_of_terms');
    expect(weeksFromStart(hot.baselineDate)).toBe(10);
    expect(hot.origin).toBe(ITEM_ORIGIN.CARRIED);
  });

  it('an accepted force moves the gate to the floor-compliant date', () => {
    // Stage 3 starts at week 26 (rolled gates 0 to 2). Gate at week 36 implies a 10
    // week span, below the confirmed 20 week floor: force, recommended to week 46.
    const { prog } = assembleVia(
      T,
      { 3: { gate: w(36) } },
      { gate_3: { decision: ACCEPTED, note: '' } },
      OBJECTIVES,
      { localFloors: { 3: { floorWeeks: 20 } } }
    );
    expect(weeksFromStart(gateOf(prog, 3).baselineDate)).toBe(46);
  });

  it('a verified flag_verify keeps the developer date', () => {
    // Stage 3 gate at the advised span, location-sensitive with no confirmed floor:
    // flag_verify. Verifying keeps the developer date (week 56).
    const { prog } = assembleVia(T, { 3: { gate: w(56) } }, {
      gate_3: { decision: VERIFIED, note: '' },
    });
    expect(weeksFromStart(gateOf(prog, 3).baselineDate)).toBe(56);
  });

  it('a within_norm gate is not in the resolution set and keeps its developer date', () => {
    // Stage 0 gate at 12 weeks is within_norm, so the reconcile emits nothing and
    // the developer date carries straight through.
    const { prog, resolutions } = assembleVia(T, { 0: { gate: w(12) } }, {});
    expect(resolutions).toEqual([]);
    expect(weeksFromStart(gateOf(prog, 0).baselineDate)).toBe(12);
  });
});

describe('the agreed skeleton reflects a moved gate', () => {
  // Developer set gate 0 to week 20 and dated no milestones, so every milestone is
  // a drill-down placed by its offset. An accepted propose then moves gate 0 to
  // week 10.
  const spec = { 0: { gate: w(20) } };
  const choices = makeChoices(SYNTH, spec);
  const movedGate = [
    {
      key: 'gate_0',
      kind: 'gate',
      stage: 0,
      tier: 'propose',
      developerDate: w(20),
      recommendedDate: w(10),
      agreedDate: w(10),
      decision: 'accepted',
      note: null,
    },
  ];
  const moved = assembleProgramme(START, SYNTH, choices, movedGate, SYNTH_OBJECTIVES);
  const unmoved = assembleProgramme(START, SYNTH, choices, [], SYNTH_OBJECTIVES);

  it('moves gate 0 to the agreed date and starts stage 1 there', () => {
    expect(weeksFromStart(gateOf(moved, 0).baselineDate)).toBe(10);
    expect(weeksFromStart(stageOf(moved, 1).stageStart)).toBe(10);
    // The downstream gate rolls from the moved gate plus gateWeeks (10 + 12), not
    // from the developer's original date: gateWeeks stays authoritative for the
    // undated gate after the move. Without the move it rolls from week 20 (20 + 12).
    expect(weeksFromStart(gateOf(moved, 1).baselineDate)).toBe(22);
    expect(weeksFromStart(gateOf(unmoved, 1).baselineDate)).toBe(32);
  });

  it('places the drill-down milestones in the following stage relative to the moved gate', () => {
    // Stage 1 drill-downs follow the moved start (week 10): offsets 3 and 10.
    expect(weeksFromStart(milestoneOf(moved, 1, 'b1_m1').baselineDate)).toBe(13);
    expect(weeksFromStart(milestoneOf(moved, 1, 'b1_m2').baselineDate)).toBe(20);
    expect(milestoneOf(moved, 1, 'b1_m1').origin).toBe(ITEM_ORIGIN.ADDED);
    // Without the move they would sit at the developer's gate (week 20): 23 and 30.
    expect(weeksFromStart(milestoneOf(unmoved, 1, 'b1_m1').baselineDate)).toBe(23);
    expect(weeksFromStart(milestoneOf(unmoved, 1, 'b1_m2').baselineDate)).toBe(30);
  });

  it('does not move the drill-downs of the stage whose start did not move (stage 0)', () => {
    // Moving gate 0 moves stage 1's start, never stage 0's (which is the project
    // start), so stage 0 drill-downs sit at their offsets in both cases.
    expect(weeksFromStart(milestoneOf(moved, 0, 'a0_m1').baselineDate)).toBe(2);
    expect(weeksFromStart(milestoneOf(moved, 0, 'a0_m2').baselineDate)).toBe(8);
    expect(weeksFromStart(milestoneOf(unmoved, 0, 'a0_m1').baselineDate)).toBe(2);
  });
});

describe('drill-down placement is by the absolute offset on the agreed skeleton', () => {
  it('places each drill-down at the agreed stage start plus its offset, unscaled', () => {
    // The offset distance from the stage start is the same whether or not the gate
    // moved: 3 and 10 weeks. A scaled offset would compress to fit the moved gate.
    const choices = makeChoices(SYNTH, { 0: { gate: w(20) } });
    const movedGate = [
      {
        key: 'gate_0',
        kind: 'gate',
        stage: 0,
        tier: 'propose',
        developerDate: w(20),
        recommendedDate: w(10),
        agreedDate: w(10),
        decision: 'accepted',
        note: null,
      },
    ];
    const prog = assembleProgramme(START, SYNTH, choices, movedGate, SYNTH_OBJECTIVES);
    const start1 = weeksFromStart(stageOf(prog, 1).stageStart);
    expect(weeksFromStart(milestoneOf(prog, 1, 'b1_m1').baselineDate) - start1).toBe(3);
    expect(weeksFromStart(milestoneOf(prog, 1, 'b1_m2').baselineDate) - start1).toBe(10);
  });

  it('leaves a drill-down that lands past its agreed gate where it falls, not clamped', () => {
    // Move gate 0 earlier, to week 6. Stage 0 drill-down a0_m2 has offset 8, so it
    // lands at week 8, past the agreed gate at week 6. It is left there.
    const choices = makeChoices(SYNTH, { 0: { gate: w(20) } });
    const movedEarly = [
      {
        key: 'gate_0',
        kind: 'gate',
        stage: 0,
        tier: 'propose',
        developerDate: w(20),
        recommendedDate: w(6),
        agreedDate: w(6),
        decision: 'accepted',
        note: null,
      },
    ];
    const prog = assembleProgramme(START, SYNTH, choices, movedEarly, SYNTH_OBJECTIVES);
    expect(weeksFromStart(gateOf(prog, 0).baselineDate)).toBe(6);
    expect(weeksFromStart(milestoneOf(prog, 0, 'a0_m2').baselineDate)).toBe(8);
  });
});

describe('a developer-dated milestone is authoritative', () => {
  it('takes the developer date even where it differs from the start-plus-offset position', () => {
    // a0_m1 has offset 2 but the developer dated it at week 4. With no resolution
    // the developer date stands, not the offset-derived week 2.
    const choices = makeChoices(SYNTH, { 0: { milestones: { a0_m1: w(4) } } });
    const prog = assembleProgramme(START, SYNTH, choices, [], SYNTH_OBJECTIVES);
    const m = milestoneOf(prog, 0, 'a0_m1');
    expect(weeksFromStart(m.baselineDate)).toBe(4);
    expect(m.origin).toBe(ITEM_ORIGIN.CARRIED);
    // Its sibling a0_m2 was not dated, so it is a drill-down at its offset (8).
    expect(weeksFromStart(milestoneOf(prog, 0, 'a0_m2').baselineDate)).toBe(8);
    expect(milestoneOf(prog, 0, 'a0_m2').origin).toBe(ITEM_ORIGIN.ADDED);
  });
});

describe('derivation never dates a point the developer governs or a protected point', () => {
  it('leaves an undated headline milestone undated and carried, named in v1', () => {
    // Every gate is dated but first_exchange (headline, stage 7) is left blank.
    // The engine must not invent a date for it: it stays in v1 by name, undated,
    // tagged carried, its criticality still baked.
    const spec = { ...ADVISED_SPEC, 7: { gate: w(146) } };
    const choices = makeChoices(T, spec);
    const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const m = milestoneOf(prog, 7, 'first_exchange');
    expect(m).toBeDefined();
    expect(m.baselineDate).toBeNull();
    expect(m.origin).toBe(ITEM_ORIGIN.CARRIED);
    expect(m.tier).toBe('headline');
  });

  it('leaves a critical drill-down milestone undated, tagged added', () => {
    // substructure_complete is a drill-down serving time, non-negotiable here, so
    // it is critical: no derived date may reach it. It stays undated and added.
    const choices = makeChoices(T, ADVISED_SPEC);
    const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const m = milestoneOf(prog, 5, 'substructure_complete');
    expect(m).toBeDefined();
    expect(m.baselineDate).toBeNull();
    expect(m.origin).toBe(ITEM_ORIGIN.ADDED);
    expect(m.criticality).toBe('critical');
    expect(m.tier).toBe('drilldown');
  });

  it('still dates a critical drill-down from a developer date, carried', () => {
    // The constraint is on derivation only: a developer (or resolution) date on a
    // drill-down stands, whatever the criticality.
    const spec = {
      ...ADVISED_SPEC,
      5: {
        gate: w(120),
        milestones: { ...ADVISED_SPEC[5].milestones, substructure_complete: w(80) },
      },
    };
    const choices = makeChoices(T, spec);
    const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const m = milestoneOf(prog, 5, 'substructure_complete');
    expect(weeksFromStart(m.baselineDate)).toBe(80);
    expect(m.origin).toBe(ITEM_ORIGIN.CARRIED);
  });
});

describe('an activity with zero milestones assembles cleanly', () => {
  const choices = makeChoices(T, ADVISED_SPEC);
  const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);

  it('contributes its duration and raises no milestone events for the four closing activities', () => {
    // Only the four closing activities are bare now: 1a, 2a, 3a and 5a each carry
    // a drill-down completion milestone the engine places (see the drill-down
    // describe below).
    const emptyKeys = [
      '0b_legal_completion',
      '4b_evaluation_award',
      '6b_handover_defects',
      '7b_completions_disposal',
    ];
    for (const stage of prog.stages) {
      for (const a of stage.activities) {
        if (emptyKeys.includes(a.key)) {
          expect(a.milestones).toEqual([]);
          expect(a.durationWeeks).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries the activity duration and within-norm band onto every activity', () => {
    const a = activityOf(prog, 0, '0a_site_search');
    expect(a.durationWeeks).toBe(12);
    expect(a.withinNormWeeks).toEqual({ min: 6, max: 18 });
    // The gate names the final activity it closes.
    expect(gateOf(prog, 0).closesActivityKey).toBe('0b_legal_completion');
  });

  it('does not invent milestones to fill the empty activities', () => {
    const total = prog.stages
      .flatMap((s) => s.activities)
      .reduce((n, a) => n + a.milestones.length, 0);
    // Nine headline milestones plus the four drill-down completion milestones on
    // activities 1a, 2a, 3a and 5a: thirteen, no more invented.
    expect(total).toBe(13);
  });
});

describe('criticality is baked from the served objective', () => {
  const choices = makeChoices(T, ADVISED_SPEC);
  const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);

  it('bakes critical for a milestone serving a non-negotiable objective', () => {
    // heads_of_terms serves cost, which is non-negotiable here.
    expect(milestoneOf(prog, 0, 'heads_of_terms').criticality).toBe('critical');
    // planning_validated serves time, also non-negotiable.
    expect(milestoneOf(prog, 3, 'planning_validated').criticality).toBe('critical');
  });

  it('bakes standard for a milestone serving a flexible objective', () => {
    // lead_consultant serves quality, which is flexible here.
    expect(milestoneOf(prog, 2, 'lead_consultant').criticality).toBe('standard');
    // finance_committed serves funding, also flexible.
    expect(milestoneOf(prog, 1, 'finance_committed').criticality).toBe('standard');
  });

  it('accepts an already-built objective index as well as the rows', () => {
    const index = {
      byType: {
        cost: { classification: 'non_negotiable' },
        quality: { classification: 'flexible' },
      },
    };
    const viaIndex = assembleProgramme(START, T, choices, [], index);
    expect(milestoneOf(viaIndex, 0, 'heads_of_terms').criticality).toBe('critical');
    expect(milestoneOf(viaIndex, 2, 'lead_consultant').criticality).toBe('standard');
  });

  it('defaults a milestone with no matching objective to standard', () => {
    const prog2 = assembleProgramme(START, T, choices, [], []);
    expect(milestoneOf(prog2, 0, 'heads_of_terms').criticality).toBe('standard');
  });
});

describe('the four real drill-down milestones are placed as added on the agreed skeleton', () => {
  // The developer dated every gate and headline milestone at its advised position
  // (ADVISED_SPEC) and dated no drill-down. Each standard drill-down is placed by
  // its absolute offset from its agreed stage start and tagged added. Stage starts
  // on the accepted advised gates: stage 1 at week 12, stage 2 at 20, stage 3 at
  // 26, stage 5 at 68. Objectives here make cost and time non-negotiable, so
  // substructure_complete (serves time) is the one critical drill-down, and a
  // critical drill-down takes no derived date: it stays undated, tagged added.
  //   [stage, key, weeksFromStart, criticality]
  const DATED_CASES = [
    [1, 'feasibility_confirmed', 15, 'standard'],
    [2, 'consultant_scope_agreed', 24, 'standard'],
    [3, 'developed_design_complete', 34, 'standard'],
  ];
  const choices = makeChoices(T, ADVISED_SPEC);
  const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);

  it('places each standard drill-down at its agreed stage start plus its offset, tagged added', () => {
    for (const [stage, key, weeks] of DATED_CASES) {
      const m = milestoneOf(prog, stage, key);
      expect(m).toBeDefined();
      expect(weeksFromStart(m.baselineDate)).toBe(weeks);
      expect(m.origin).toBe(ITEM_ORIGIN.ADDED);
    }
  });

  it('sits each dated drill-down exactly its curated offset from its agreed stage start', () => {
    for (const [stage, key] of DATED_CASES) {
      const m = milestoneOf(prog, stage, key);
      const start = weeksFromStart(stageOf(prog, stage).stageStart);
      expect(weeksFromStart(m.baselineDate) - start).toBe(m.offsetWeeks);
    }
  });

  it('leaves the critical drill-down undated, tagged added, criticality baked', () => {
    const m = milestoneOf(prog, 5, 'substructure_complete');
    expect(m).toBeDefined();
    expect(m.baselineDate).toBeNull();
    expect(m.origin).toBe(ITEM_ORIGIN.ADDED);
    expect(m.criticality).toBe('critical');
  });

  it('bakes each drill-down criticality from the objective it serves', () => {
    for (const [stage, key, , criticality] of DATED_CASES) {
      expect(milestoneOf(prog, stage, key).criticality).toBe(criticality);
    }
  });

  it('homes each drill-down on its first mid-stage activity (1a, 2a, 3a, 5a)', () => {
    const homes = [
      [1, '1a_brief_feasibility', 'feasibility_confirmed'],
      [2, '2a_scope_selection', 'consultant_scope_agreed'],
      [3, '3a_design_development', 'developed_design_complete'],
      [5, '5a_substructure', 'substructure_complete'],
    ];
    for (const [stage, activityKey, key] of homes) {
      expect(activityOf(prog, stage, activityKey).milestones.map((m) => m.key)).toContain(
        key
      );
    }
  });
});

describe('the output is fully resolved', () => {
  const choices = makeChoices(T, ADVISED_SPEC);
  const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);

  it('dates every gate, and every milestone except a critical drill-down, on every applicable stage', () => {
    for (const stage of prog.stages) {
      if (!stage.applicable) continue;
      expect(stage.gate.baselineDate).toBeInstanceOf(Date);
      expect(stage.stageStart).toBeInstanceOf(Date);
      for (const a of stage.activities) {
        for (const m of a.milestones) {
          // The one honest gap: a critical drill-down takes no derived date.
          if (m.origin === ITEM_ORIGIN.ADDED && m.criticality === 'critical') {
            expect(m.baselineDate).toBeNull();
          } else {
            expect(m.baselineDate).toBeInstanceOf(Date);
            expect(Number.isNaN(m.baselineDate.getTime())).toBe(false);
          }
          expect(m.criticality === 'critical' || m.criticality === 'standard').toBe(true);
          expect(m.tier === 'headline' || m.tier === 'drilldown').toBe(true);
          expect(m.origin === ITEM_ORIGIN.CARRIED || m.origin === ITEM_ORIGIN.ADDED).toBe(true);
        }
      }
    }
  });

  it('keeps the full two-level structure: eight stages, seventeen activities, eight gates', () => {
    expect(prog.stages).toHaveLength(8);
    const activityCount = prog.stages.reduce((n, s) => n + s.activities.length, 0);
    expect(activityCount).toBe(17);
    expect(prog.stages.every((s) => s.gate.key === `gate_${s.stage}`)).toBe(true);
  });
});

describe('not-applicable stages', () => {
  it('marks an N/A stage not applicable, dates nothing, and carries the chain across it', () => {
    const choices = makeChoices(T, {
      0: { gate: w(12) },
      1: { na: true },
      2: { gate: w(18) },
    });
    const prog = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const s1 = stageOf(prog, 1);
    expect(s1.applicable).toBe(false);
    expect(s1.stageStart).toBeNull();
    expect(s1.gate.baselineDate).toBeNull();
    // Stage 2 anchors on the carried gate 0 date (week 12), so its developer gate
    // at week 18 stands and its start is week 12.
    expect(weeksFromStart(stageOf(prog, 2).stageStart)).toBe(12);
    expect(weeksFromStart(gateOf(prog, 2).baselineDate)).toBe(18);
  });
});

describe('deterministic and pure', () => {
  it('gives identical output on repeated calls with identical input', () => {
    const choices = makeChoices(T, ADVISED_SPEC);
    const a = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const b = assembleProgramme(START, T, choices, [], OBJECTIVES);
    expect(a).toEqual(b);
  });

  it('does not mutate the choices, the resolutions, the objectives, or the template', () => {
    const choices = makeChoices(T, { 0: { gate: w(31) } });
    const resolutions = [
      {
        key: 'gate_0',
        kind: 'gate',
        stage: 0,
        tier: 'propose',
        developerDate: w(31),
        recommendedDate: w(20),
        agreedDate: w(20),
        decision: 'accepted',
        note: null,
      },
    ];
    const objectives = OBJECTIVES.map((o) => ({ ...o }));
    const choicesSnapshot = JSON.stringify(choices);
    const resolutionsSnapshot = JSON.stringify(resolutions);
    const objectivesSnapshot = JSON.stringify(objectives);

    assembleProgramme(START, T, choices, resolutions, objectives);

    expect(JSON.stringify(choices)).toBe(choicesSnapshot);
    expect(JSON.stringify(resolutions)).toBe(resolutionsSnapshot);
    expect(JSON.stringify(objectives)).toBe(objectivesSnapshot);
    // No derived field leaks onto the frozen template.
    expect(PROGRAMME_TEMPLATE.stages[0].baselineDate).toBeUndefined();
    expect(
      PROGRAMME_TEMPLATE.stages[0].activities[0].milestones[0].baselineDate
    ).toBeUndefined();
  });

  it('throws a clear error when no project start is held', () => {
    expect(() => assembleProgramme('', T, makeChoices(T, {}), [], OBJECTIVES)).toThrow(
      /project start/
    );
  });
});

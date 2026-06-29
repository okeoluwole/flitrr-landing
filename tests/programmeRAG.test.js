import { describe, it, expect } from 'vitest';
import {
  deriveRAG,
  RAG_STATUS,
  RAG_CONDITIONS,
  RAG_ITEM_KINDS,
} from '../lib/engine/programmeRAG.js';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';

/**
 * The Programme RAG engine (Programme module Phase 3.2). Proves it colours the
 * frozen baseline under the observed-slip rule: a met point is never behind, an
 * unmet point is behind only once today has passed its baseline date, a behind gate
 * is Red ahead of any tolerance, a behind critical milestone is Amber within the
 * tolerance and Red beyond it (the boundary Amber), a behind standard milestone is
 * Amber, a confirmed hard-floor breach is Red (the dormant branch), a not-applicable
 * stage is excluded, the overall colour is the worst across points and the per-stage
 * colour the worst within, the flagged list carries the right working, and the whole
 * engine is pure, deterministic, and reads no clock.
 *
 * A fixed UTC anchor and a fixed today keep every assertion independent of the test
 * runner's timezone and the wall clock, the same fixed-anchor style as the sibling
 * engine tests. Dates are placed in whole weeks (and whole days, where a fractional
 * slip is wanted) from the anchor. The default tolerance the surface will pass is
 * four weeks; every test passes it in explicitly, never relying on a hardcoded
 * value.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOLERANCE = 4; // the specification's four-week dial, passed in by the surface

// A Date a whole number of weeks after the anchor, in UTC.
const w = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK);
// A Date a whole number of weeks plus whole days after the anchor, for a slip that
// lands off a whole-week boundary.
const wd = (weeks, days) => new Date(ANCHOR + weeks * MS_PER_WEEK + days * MS_PER_DAY);

// A baked milestone in the assembled-baseline shape: a key, a name, a baked
// criticality, and a baseline date. The RAG engine reads the baked criticality and
// the baseline date; it never recomputes criticality.
const mkMilestone = (key, criticality, baselineDate, name = key) => ({
  key,
  name,
  serves: 'cost', // present for shape fidelity; never read by this engine
  criticality,
  baselineDate,
});

// A stage in the assembled-baseline shape. The gate sits at stage.gate with its own
// baseline date; the milestones sit under one activity. closesActivityKey is carried
// for shape fidelity and is not read by this engine.
function mkStage(
  stage,
  { stageStart = w(0), milestones = [], gateDate, applicable = true } = {}
) {
  return {
    stage,
    name: `Stage ${stage}`,
    applicable,
    stageStart,
    activities: [{ key: `${stage}a`, name: `${stage}a`, milestones }],
    gate: {
      key: `gate_${stage}`,
      name: `Stage ${stage}`,
      baselineDate: gateDate,
      closesActivityKey: `${stage}a`,
    },
  };
}

const mkBaseline = (...stages) => ({ version: 'test-1.0.0', stages });

// A baseline holding a single milestone of the given criticality at the given date,
// with the stage gate parked far in the future so the gate never flags and the
// milestone's colour stands alone.
const oneMilestone = (criticality, msDate) =>
  mkBaseline(
    mkStage(0, {
      milestones: [mkMilestone('m1', criticality, msDate)],
      gateDate: w(500),
    })
  );

// Find a flagged item by key.
const flaggedOf = (result, key) => result.flagged.find((f) => f.key === key);
// The per-stage status for a stage number.
const stageStatus = (result, n) =>
  result.stages.find((s) => s.stage === n)?.status;

describe('green: all points met, or none behind', () => {
  it('reads Green when every behind-dated point is met', () => {
    // Two stages of points all dated in the past (so all would be behind), but all
    // met: nothing is flagged.
    const baseline = mkBaseline(
      mkStage(0, {
        milestones: [
          mkMilestone('m1', 'critical', w(10)),
          mkMilestone('m2', 'standard', w(12)),
        ],
        gateDate: w(14),
      }),
      mkStage(1, { milestones: [mkMilestone('m3', 'critical', w(20))], gateDate: w(22) })
    );
    const metAll = { m1: { met: true }, m2: { met: true }, m3: { met: true }, gate_0: { met: true }, gate_1: { met: true } };
    const r = deriveRAG(baseline, metAll, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
    expect(stageStatus(r, 0)).toBe(RAG_STATUS.GREEN);
    expect(stageStatus(r, 1)).toBe(RAG_STATUS.GREEN);
  });

  it('reads Green when nothing is behind (every point still in the future)', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        milestones: [mkMilestone('m1', 'critical', w(60))],
        gateDate: w(70),
      })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('treats an empty or absent baseline as Green, with no throw', () => {
    expect(deriveRAG({ stages: [] }, {}, w(50), TOLERANCE)).toEqual({
      status: RAG_STATUS.GREEN,
      stages: [],
      flagged: [],
    });
    expect(deriveRAG(undefined, {}, w(50), TOLERANCE)).toEqual({
      status: RAG_STATUS.GREEN,
      stages: [],
      flagged: [],
    });
  });
});

describe('a standard milestone behind reads Amber, by any amount', () => {
  it('flags a behind standard milestone Amber', () => {
    const r = deriveRAG(oneMilestone('standard', w(40)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
    const m = flaggedOf(r, 'm1');
    expect(m.colour).toBe(RAG_STATUS.AMBER);
    expect(m.condition).toBe(RAG_CONDITIONS.STANDARD_BEHIND);
    expect(m.weeksBehind).toBe(10);
  });

  it('stays Amber even when a standard milestone is behind by a long way', () => {
    // Far beyond four weeks, but standard never escalates to Red.
    const r = deriveRAG(oneMilestone('standard', w(1)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
    expect(flaggedOf(r, 'm1').colour).toBe(RAG_STATUS.AMBER);
  });
});

describe('a critical milestone behind, against the tolerance', () => {
  it('reads Amber when behind within the tolerance', () => {
    // Behind by three weeks, inside the four-week tolerance.
    const r = deriveRAG(oneMilestone('critical', w(47)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
    const m = flaggedOf(r, 'm1');
    expect(m.colour).toBe(RAG_STATUS.AMBER);
    expect(m.condition).toBe(RAG_CONDITIONS.CRITICAL_WITHIN_TOLERANCE);
    expect(m.weeksBehind).toBe(3);
  });

  it('reads Amber when behind by exactly the tolerance (the boundary is Amber)', () => {
    // Behind by exactly four weeks.
    const r = deriveRAG(oneMilestone('critical', w(46)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
    const m = flaggedOf(r, 'm1');
    expect(m.weeksBehind).toBe(4);
    expect(m.condition).toBe(RAG_CONDITIONS.CRITICAL_WITHIN_TOLERANCE);
    expect(m.colour).toBe(RAG_STATUS.AMBER);
  });

  it('reads Red when behind beyond the tolerance', () => {
    // Behind by five weeks, past the four-week tolerance.
    const r = deriveRAG(oneMilestone('critical', w(45)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.RED);
    const m = flaggedOf(r, 'm1');
    expect(m.weeksBehind).toBe(5);
    expect(m.condition).toBe(RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE);
    expect(m.colour).toBe(RAG_STATUS.RED);
  });

  it('reads Red just one day past the tolerance boundary', () => {
    // Four weeks and one day behind: just over the boundary.
    const r = deriveRAG(oneMilestone('critical', wd(46, -1)), {}, w(50), TOLERANCE);
    const m = flaggedOf(r, 'm1');
    expect(m.weeksBehind).toBeCloseTo(4 + 1 / 7, 6);
    expect(m.colour).toBe(RAG_STATUS.RED);
  });

  it('honours a tolerance the surface passes, not a hardcoded four', () => {
    // With a zero tolerance, any behind critical milestone is Red at once.
    const r = deriveRAG(oneMilestone('critical', wd(50, -1)), {}, w(50), 0);
    expect(flaggedOf(r, 'm1').colour).toBe(RAG_STATUS.RED);
    // With a wide tolerance, the same milestone behind five weeks reads Amber.
    const wide = deriveRAG(oneMilestone('critical', w(45)), {}, w(50), 10);
    expect(flaggedOf(wide, 'm1').colour).toBe(RAG_STATUS.AMBER);
  });
});

describe('the observed-slip lag, made concrete (the walkthrough check)', () => {
  // One unmet critical milestone dated at week 40, watched across the days around it.
  const baselineWeek = 40;
  const at = (today) =>
    deriveRAG(oneMilestone('critical', w(baselineWeek)), {}, today, TOLERANCE);

  it('reads Green the day before its baseline date', () => {
    const r = at(wd(baselineWeek, -1));
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('reads Green on its baseline date (the date has not yet passed)', () => {
    const r = at(w(baselineWeek));
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('reads Amber the day after its baseline date', () => {
    const r = at(wd(baselineWeek, 1));
    expect(r.status).toBe(RAG_STATUS.AMBER);
    expect(flaggedOf(r, 'm1').condition).toBe(
      RAG_CONDITIONS.CRITICAL_WITHIN_TOLERANCE
    );
  });

  it('still reads Amber at exactly four weeks past', () => {
    const r = at(wd(baselineWeek, 28));
    expect(r.status).toBe(RAG_STATUS.AMBER);
  });

  it('crosses to Red only once it is more than four weeks past', () => {
    const r = at(wd(baselineWeek, 29));
    expect(r.status).toBe(RAG_STATUS.RED);
    expect(flaggedOf(r, 'm1').condition).toBe(
      RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE
    );
  });
});

describe('an unmet critical item not yet at its baseline date is not flagged', () => {
  it('reads Green, with no approaching-amber state', () => {
    const r = deriveRAG(oneMilestone('critical', w(60)), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });
});

describe('a gate behind reads Red, ahead of any tolerance', () => {
  it('flags an unmet gate whose baseline date has passed as Red', () => {
    const baseline = mkBaseline(
      mkStage(0, { milestones: [], gateDate: w(40) })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.RED);
    const g = flaggedOf(r, 'gate_0');
    expect(g.kind).toBe(RAG_ITEM_KINDS.GATE);
    expect(g.criticality).toBe('critical');
    expect(g.condition).toBe(RAG_CONDITIONS.GATE_OVERDUE);
    expect(g.colour).toBe(RAG_STATUS.RED);
    expect(g.weeksBehind).toBe(10);
  });

  it('is Red regardless of how large the tolerance is', () => {
    const baseline = mkBaseline(mkStage(0, { gateDate: w(40) }));
    const r = deriveRAG(baseline, {}, w(50), 1000);
    expect(r.status).toBe(RAG_STATUS.RED);
    expect(flaggedOf(r, 'gate_0').colour).toBe(RAG_STATUS.RED);
  });

  it('does not flag a gate still in the future', () => {
    const baseline = mkBaseline(mkStage(0, { gateDate: w(60) }));
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });
});

describe('the hard-floor breach (the dormant branch), proven with a supplied floor', () => {
  // Stage 0 starts at week 0; its gate is placed only four weeks in, well below a
  // confirmed twelve-week local floor. Today is set before the gate date, so the
  // gate is not overdue: the only thing that can colour it Red is the floor breach.
  const baseline = mkBaseline(mkStage(0, { stageStart: w(0), gateDate: w(4) }));
  const today = w(2);

  it('reads Green with no floor supplied (the gate is not yet overdue)', () => {
    const r = deriveRAG(baseline, {}, today, TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('lights the gate Red when a confirmed floor is breached', () => {
    const r = deriveRAG(baseline, {}, today, TOLERANCE, {
      localFloors: { 0: { floorWeeks: 12 } },
    });
    expect(r.status).toBe(RAG_STATUS.RED);
    const g = flaggedOf(r, 'gate_0');
    expect(g.condition).toBe(RAG_CONDITIONS.HARD_FLOOR_BREACH);
    expect(g.colour).toBe(RAG_STATUS.RED);
    // Not yet overdue, so there is no observed slip to report.
    expect(g.weeksBehind).toBeNull();
  });

  it('does not breach when the confirmed floor is met', () => {
    // Span of four weeks against a three-week floor: above the floor, no breach.
    const r = deriveRAG(baseline, {}, today, TOLERANCE, {
      localFloors: { 0: { floorWeeks: 3 } },
    });
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('treats a malformed floor as not supplied (mirrors the reality check)', () => {
    for (const floorWeeks of [NaN, Infinity, -5]) {
      const r = deriveRAG(baseline, {}, today, TOLERANCE, {
        localFloors: { 0: { floorWeeks } },
      });
      expect(r.status).toBe(RAG_STATUS.GREEN);
    }
  });

  it('reports the breach over the overdue when a gate is both breaching and overdue', () => {
    // Today now past the gate date: the gate is both overdue and floor-breached.
    const r = deriveRAG(baseline, {}, w(10), TOLERANCE, {
      localFloors: { 0: { floorWeeks: 12 } },
    });
    const g = flaggedOf(r, 'gate_0');
    expect(g.condition).toBe(RAG_CONDITIONS.HARD_FLOOR_BREACH);
    expect(g.colour).toBe(RAG_STATUS.RED);
    // Overdue now, so the observed slip is reported alongside the breach.
    expect(g.weeksBehind).toBe(6);
  });
});

describe('a met point never flags, even with its baseline date passed', () => {
  it('does not flag a met critical milestone whose baseline date has passed', () => {
    const r = deriveRAG(oneMilestone('critical', w(10)), { m1: { met: true } }, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('does not flag a met gate whose baseline date has passed', () => {
    const baseline = mkBaseline(mkStage(0, { gateDate: w(10) }));
    const r = deriveRAG(baseline, { gate_0: { met: true } }, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('never reads the met date, only met or not met', () => {
    const baseline = oneMilestone('critical', w(10));
    const early = deriveRAG(baseline, { m1: { met: true, metDate: '2026-01-01' } }, w(50), TOLERANCE);
    const late = deriveRAG(baseline, { m1: { met: true, metDate: '2099-12-31' } }, w(50), TOLERANCE);
    const bare = deriveRAG(baseline, { m1: true }, w(50), TOLERANCE);
    expect(late).toEqual(early);
    expect(bare).toEqual(early);
  });

  it('treats an explicit met: false as not met', () => {
    const r = deriveRAG(oneMilestone('standard', w(40)), { m1: { met: false } }, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
    expect(flaggedOf(r, 'm1').condition).toBe(RAG_CONDITIONS.STANDARD_BEHIND);
  });
});

describe('a not-applicable stage is excluded entirely', () => {
  it('does not fire Red on a not-applicable stage with an unmet overdue gate', () => {
    const baseline = mkBaseline(
      mkStage(0, { milestones: [mkMilestone('m1', 'standard', w(60))], gateDate: w(70) }),
      mkStage(1, {
        milestones: [mkMilestone('m2', 'critical', w(10))],
        gateDate: w(12),
        applicable: false,
      })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    // Stage 1 is N/A: its overdue gate and behind critical milestone never flag.
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
    expect(stageStatus(r, 1)).toBeNull();
    expect(r.stages.find((s) => s.stage === 1).applicable).toBe(false);
  });

  it('treats an absent applicable flag as applicable', () => {
    const stage = mkStage(0, { gateDate: w(40) });
    delete stage.applicable;
    const r = deriveRAG(mkBaseline(stage), {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.RED); // overdue gate still colours
    expect(stageStatus(r, 0)).toBe(RAG_STATUS.RED);
  });
});

describe('the overall colour is the worst across points, and per-stage the worst within', () => {
  it('rolls the worst point up to the stage and the worst stage up to the programme', () => {
    const baseline = mkBaseline(
      // Stage 0: a standard milestone behind (Amber), gate in the future.
      mkStage(0, {
        milestones: [mkMilestone('m0', 'standard', w(40))],
        gateDate: w(80),
      }),
      // Stage 1: a critical milestone behind beyond tolerance (Red), gate future.
      mkStage(1, {
        milestones: [mkMilestone('m1', 'critical', w(30))],
        gateDate: w(80),
      }),
      // Stage 2: nothing behind (Green).
      mkStage(2, {
        milestones: [mkMilestone('m2', 'critical', w(90))],
        gateDate: w(95),
      })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(stageStatus(r, 0)).toBe(RAG_STATUS.AMBER);
    expect(stageStatus(r, 1)).toBe(RAG_STATUS.RED);
    expect(stageStatus(r, 2)).toBe(RAG_STATUS.GREEN);
    expect(r.status).toBe(RAG_STATUS.RED); // worst across the three
  });

  it('takes the worst within a stage when a stage holds both Amber and Red', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        milestones: [mkMilestone('m0', 'standard', w(40))], // Amber
        gateDate: w(45), // overdue -> Red
      })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(stageStatus(r, 0)).toBe(RAG_STATUS.RED);
    expect(r.status).toBe(RAG_STATUS.RED);
    // Both points are flagged, the milestone Amber and the gate Red.
    expect(flaggedOf(r, 'm0').colour).toBe(RAG_STATUS.AMBER);
    expect(flaggedOf(r, 'gate_0').colour).toBe(RAG_STATUS.RED);
  });

  it('reads Amber overall when the worst point anywhere is Amber', () => {
    const baseline = mkBaseline(
      mkStage(0, { milestones: [mkMilestone('m0', 'standard', w(40))], gateDate: w(80) }),
      mkStage(1, { milestones: [mkMilestone('m1', 'critical', w(48))], gateDate: w(80) }) // 2w behind -> Amber
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.AMBER);
  });
});

describe('the flagged list carries the right items and working', () => {
  it('lists behind and breaching points in stage then milestone-before-gate order', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        milestones: [
          mkMilestone('m_std', 'standard', w(40), 'Standard point'),
          mkMilestone('m_crit', 'critical', w(30), 'Critical point'),
        ],
        gateDate: w(35), // overdue
      })
    );
    const r = deriveRAG(baseline, {}, w(50), TOLERANCE);
    // Milestones in order, then the gate.
    expect(r.flagged.map((f) => f.key)).toEqual(['m_std', 'm_crit', 'gate_0']);

    const std = flaggedOf(r, 'm_std');
    expect(std).toMatchObject({
      key: 'm_std',
      kind: RAG_ITEM_KINDS.MILESTONE,
      name: 'Standard point',
      criticality: 'standard',
      stage: 0,
      condition: RAG_CONDITIONS.STANDARD_BEHIND,
      colour: RAG_STATUS.AMBER,
    });
    expect(std.weeksBehind).toBe(10);
    expect(std.baselineDate.getTime()).toBe(w(40).getTime());

    const crit = flaggedOf(r, 'm_crit');
    expect(crit.criticality).toBe('critical');
    expect(crit.condition).toBe(RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE);
    expect(crit.colour).toBe(RAG_STATUS.RED);
    expect(crit.weeksBehind).toBe(20);

    const gate = flaggedOf(r, 'gate_0');
    expect(gate.kind).toBe(RAG_ITEM_KINDS.GATE);
    expect(gate.criticality).toBe('critical');
    expect(gate.condition).toBe(RAG_CONDITIONS.GATE_OVERDUE);
    expect(gate.weeksBehind).toBe(15);
  });

  it('does not list met, not-yet-due, or not-behind points', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        milestones: [
          mkMilestone('m_met', 'critical', w(10)), // behind but met
          mkMilestone('m_future', 'critical', w(90)), // not yet due
        ],
        gateDate: w(95), // future
      })
    );
    const r = deriveRAG(baseline, { m_met: { met: true } }, w(50), TOLERANCE);
    expect(r.flagged).toEqual([]);
    expect(r.status).toBe(RAG_STATUS.GREEN);
  });
});

describe('input shapes', () => {
  it('accepts the met-points view as a Map as well as a plain object', () => {
    const baseline = oneMilestone('critical', w(10));
    const viaObject = deriveRAG(baseline, { m1: { met: true } }, w(50), TOLERANCE);
    const viaMap = deriveRAG(baseline, new Map([['m1', { met: true }]]), w(50), TOLERANCE);
    expect(viaMap).toEqual(viaObject);
  });

  it('ignores a met record for a point not in the baseline', () => {
    const baseline = oneMilestone('standard', w(40));
    const clean = deriveRAG(baseline, {}, w(50), TOLERANCE);
    const noisy = deriveRAG(
      baseline,
      { not_a_point: { met: true }, gate_9: { met: true } },
      w(50),
      TOLERANCE
    );
    expect(noisy).toEqual(clean);
  });

  it('accepts today as an ISO string and as epoch milliseconds', () => {
    const baseline = oneMilestone('standard', w(40));
    const viaDate = deriveRAG(baseline, {}, w(50), TOLERANCE);
    const viaIso = deriveRAG(baseline, {}, w(50).toISOString().slice(0, 10), TOLERANCE);
    const viaEpoch = deriveRAG(baseline, {}, w(50).getTime(), TOLERANCE);
    expect(viaIso).toEqual(viaDate);
    expect(viaEpoch).toEqual(viaDate);
  });
});

describe('required inputs', () => {
  const baseline = oneMilestone('standard', w(40));

  it('throws a clear error when no today is held', () => {
    expect(() => deriveRAG(baseline, {}, '', TOLERANCE)).toThrow(/today/);
    expect(() => deriveRAG(baseline, {}, undefined, TOLERANCE)).toThrow(/today/);
    expect(() => deriveRAG(baseline, {}, null, TOLERANCE)).toThrow(/today/);
  });

  it('throws a clear error when the tolerance is missing or invalid', () => {
    expect(() => deriveRAG(baseline, {}, w(50), undefined)).toThrow(/tolerance/);
    expect(() => deriveRAG(baseline, {}, w(50), -1)).toThrow(/tolerance/);
    expect(() => deriveRAG(baseline, {}, w(50), NaN)).toThrow(/tolerance/);
    expect(() => deriveRAG(baseline, {}, w(50), 'four')).toThrow(/tolerance/);
  });

  it('accepts a tolerance of zero as a valid dial', () => {
    expect(() => deriveRAG(baseline, {}, w(50), 0)).not.toThrow();
  });
});

describe('determinism and purity (reproducible from today, no clock, no side effects)', () => {
  const baseline = mkBaseline(
    mkStage(0, { milestones: [mkMilestone('m1', 'critical', w(30))], gateDate: w(45) }),
    mkStage(1, { milestones: [mkMilestone('m2', 'standard', w(60))], gateDate: w(80), applicable: false })
  );
  const view = { m1: { met: false } };

  it('gives identical output on repeated calls with identical input', () => {
    expect(deriveRAG(baseline, view, w(50), TOLERANCE)).toEqual(
      deriveRAG(baseline, view, w(50), TOLERANCE)
    );
  });

  it('is driven by the today passed in, not the wall clock', () => {
    // Different todays give different colours from the same baseline; the same today
    // always gives the same colour, so the colour is reproducible from the input.
    const early = deriveRAG(baseline, {}, w(20), TOLERANCE); // before everything
    const late = deriveRAG(baseline, {}, w(50), TOLERANCE); // after the gate
    expect(early.status).toBe(RAG_STATUS.GREEN);
    expect(late.status).toBe(RAG_STATUS.RED);
    expect(deriveRAG(baseline, {}, w(20), TOLERANCE)).toEqual(early);
  });

  it('does not mutate the baseline or the met-points view', () => {
    const baselineSnapshot = JSON.stringify(baseline);
    const viewSnapshot = JSON.stringify(view);
    deriveRAG(baseline, view, w(50), TOLERANCE);
    expect(JSON.stringify(baseline)).toBe(baselineSnapshot);
    expect(JSON.stringify(view)).toBe(viewSnapshot);
  });
});

describe('it consumes a real assembled v1 baseline', () => {
  // Build a real assembled programme from the live template, then colour it. This
  // proves the engine reads the actual baseline shape: gate.baselineDate, the baked
  // milestone criticality, and stageStart.
  const START = new Date(Date.UTC(2026, 0, 5));
  const iso = (weeks) =>
    new Date(START.getTime() + weeks * MS_PER_WEEK).toISOString().slice(0, 10);
  const ADVISED = {
    0: { gate: 12, m: { heads_of_terms: 6 } },
    1: { gate: 20, m: { finance_committed: 18 } },
    2: { gate: 26, m: { lead_consultant: 24 } },
    3: { gate: 56, m: { planning_validated: 40 } },
    4: { gate: 68, m: { tenders_returned: 64 } },
    5: { gate: 120, m: { superstructure: 94, finishing: 112 } },
    6: { gate: 126, m: { completion_certificate: 124 } },
    7: { gate: 146, m: { first_exchange: 134 } },
  };
  const choices = {
    stages: PROGRAMME_TEMPLATE.stages.map((s) => {
      const o = ADVISED[s.stage] ?? {};
      const milestones = {};
      for (const [key, weeks] of Object.entries(o.m ?? {})) {
        milestones[key] = { target_date: iso(weeks) };
      }
      return { stage: s.stage, target_date: o.gate ? iso(o.gate) : '', target_na: false, milestones };
    }),
  };
  const objectives = [
    { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
    { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
    { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
    { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
    { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
  ];
  const baseline = assembleProgramme(START, PROGRAMME_TEMPLATE, choices, [], objectives);
  // A Date a number of weeks from the assembled start.
  const fromStart = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);

  it('reads Green on a fresh programme before any date has passed', () => {
    const r = deriveRAG(baseline, {}, START, TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('reads Green once every point is met, long after all dates', () => {
    const everything = {};
    for (const stage of baseline.stages) {
      everything[stage.gate.key] = { met: true };
      for (const a of stage.activities) for (const m of a.milestones) everything[m.key] = { met: true };
    }
    const r = deriveRAG(baseline, everything, fromStart(200), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.GREEN);
    expect(r.flagged).toEqual([]);
  });

  it('reads Red partway through, flagging the passed gates and the behind critical milestone', () => {
    // At week 30, gates 0 (w12), 1 (w20) and 2 (w26) have passed unmet, and the
    // critical milestone heads_of_terms (cost, week 6) is behind beyond tolerance.
    const r = deriveRAG(baseline, {}, fromStart(30), TOLERANCE);
    expect(r.status).toBe(RAG_STATUS.RED);

    const gate0 = flaggedOf(r, 'gate_0');
    expect(gate0.kind).toBe(RAG_ITEM_KINDS.GATE);
    expect(gate0.condition).toBe(RAG_CONDITIONS.GATE_OVERDUE);
    expect(gate0.weeksBehind).toBeCloseTo(18, 6); // 30 - 12

    const heads = flaggedOf(r, 'heads_of_terms');
    expect(heads.criticality).toBe('critical'); // serves cost (non-negotiable)
    expect(heads.condition).toBe(RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE);
    expect(heads.weeksBehind).toBeCloseTo(24, 6); // 30 - 6

    // A future gate is not flagged, and its stage reads Green.
    expect(flaggedOf(r, 'gate_3')).toBeUndefined();
    expect(stageStatus(r, 3)).toBe(RAG_STATUS.GREEN);
  });
});

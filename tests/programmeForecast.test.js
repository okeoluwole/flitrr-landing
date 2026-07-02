import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  deriveForecast,
  CONCURRENT_STAGES,
} from '../lib/engine/programmeForecast.js';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';

/**
 * The Programme forecast-completion engine (Programme module Phase 3.4). Proves
 * it rolls the actuals forward through the running order on the baseline's own
 * spacing: a met point's forecast is its actual met date (the first engine to
 * read the met date), an unmet point rolls from its predecessor's completion
 * plus its baseline span, a late actual pushes what follows and an early actual
 * pulls it (the symmetric roll, never floored at the baseline), an unmet point
 * whose predecessor is in the past forecasts from today plus its span (the
 * overdue floor), a slipped early gate cascades through the spine, stage 7
 * rolls concurrent with construction and is never serialised onto the end, the
 * programme forecast completion is the latest across the programme respecting
 * the concurrency, a not-applicable stage is excluded, and the whole engine is
 * pure, deterministic, and reads no clock.
 *
 * A fixed UTC anchor and a fixed today keep every assertion independent of the
 * test runner's timezone and the wall clock, the same fixed-anchor style as the
 * sibling engine tests. Dates are placed in whole weeks from the anchor.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// A Date a whole number of weeks after the anchor, in UTC.
const w = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK);

// A milestone in the assembled-baseline shape. The forecast engine reads the
// key and the baseline date; serves and criticality are carried for shape
// fidelity and never read here.
const mkMilestone = (key, baselineDate, name = key) => ({
  key,
  name,
  serves: 'cost',
  criticality: 'standard',
  baselineDate,
});

// A stage in the assembled-baseline shape, with one or more activities. The
// gate closes the final activity, exactly as assembly emits it.
function mkStage(
  stage,
  { stageStart, activities, gateDate, applicable = true } = {}
) {
  const acts = activities ?? [{ key: `${stage}a`, milestones: [] }];
  return {
    stage,
    name: `Stage ${stage}`,
    applicable,
    stageStart,
    activities: acts.map((a) => ({
      key: a.key,
      name: a.key,
      durationWeeks: a.durationWeeks ?? 1,
      milestones: a.milestones ?? [],
    })),
    gate: {
      key: `gate_${stage}`,
      name: `Stage ${stage}`,
      baselineDate: gateDate,
      closesActivityKey: acts.length ? acts[acts.length - 1].key : null,
    },
  };
}

const mkBaseline = (...stages) => ({ version: 'test-1.0.0', stages });

// One spine stage: start week 0, one milestone at week 6, the gate at week 12.
const oneStage = () =>
  mkBaseline(
    mkStage(0, {
      stageStart: w(0),
      activities: [{ key: '0a', milestones: [mkMilestone('m1', w(6))] }],
      gateDate: w(12),
    })
  );

// Two spine stages: the second starts where the first gate falls, one
// milestone at week 16, its gate at week 20.
const twoStages = () =>
  mkBaseline(
    mkStage(0, {
      stageStart: w(0),
      activities: [{ key: '0a', milestones: [mkMilestone('m1', w(6))] }],
      gateDate: w(12),
    }),
    mkStage(1, {
      stageStart: w(12),
      activities: [{ key: '1a', milestones: [mkMilestone('m2', w(16))] }],
      gateDate: w(20),
    })
  );

// Look-ups on the result tree.
const stageOf = (r, n) => r.stages.find((s) => s.stage === n);
const milestoneOf = (r, key) => {
  for (const s of r.stages)
    for (const a of s.activities)
      for (const m of a.milestones) if (m.key === key) return m;
  return undefined;
};
const gateOf = (r, n) => stageOf(r, n)?.gate;
const activityOf = (r, key) => {
  for (const s of r.stages)
    for (const a of s.activities) if (a.key === key) return a;
  return undefined;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a met point forecasts its actual met date, a fact not a projection', () => {
  it('returns the actual met date, late or early, exactly', () => {
    const late = deriveForecast(oneStage(), { m1: { met: true, metDate: w(8) } }, w(8));
    expect(milestoneOf(late, 'm1').met).toBe(true);
    expect(milestoneOf(late, 'm1').forecastDate.getTime()).toBe(w(8).getTime());

    const early = deriveForecast(oneStage(), { m1: { met: true, metDate: w(4) } }, w(4));
    expect(milestoneOf(early, 'm1').forecastDate.getTime()).toBe(w(4).getTime());
  });

  it('reads the met date in any of the accepted forms', () => {
    const viaDate = deriveForecast(oneStage(), { m1: { met: true, metDate: w(8) } }, w(8));
    const viaIso = deriveForecast(
      oneStage(),
      { m1: { met: true, metDate: w(8).toISOString().slice(0, 10) } },
      w(8)
    );
    const viaEpoch = deriveForecast(
      oneStage(),
      { m1: { met: true, metDate: w(8).getTime() } },
      w(8)
    );
    expect(viaIso).toEqual(viaDate);
    expect(viaEpoch).toEqual(viaDate);
  });

  it('may sit in the past: a fact is never floored at today', () => {
    const r = deriveForecast(oneStage(), { m1: { met: true, metDate: w(6) } }, w(50));
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(6).getTime());
  });
});

describe('an unmet point rolls from its predecessor plus its baseline span', () => {
  it('reproduces the baseline exactly when nothing is met and nothing is overdue', () => {
    const r = deriveForecast(twoStages(), {}, w(0));
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(6).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(12).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(16).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(20).getTime());
    expect(r.forecastCompletion.getTime()).toBe(w(20).getTime());
  });

  it('rolls each unmet point from the point before it, span by span', () => {
    // m1 met two weeks late: the gate keeps its six week span from m1.
    const r = deriveForecast(oneStage(), { m1: { met: true, metDate: w(8) } }, w(8));
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(14).getTime());
  });
});

describe('the symmetric roll: late pushes, early pulls, no baseline floor', () => {
  it('pushes what follows when a point is met late', () => {
    const r = deriveForecast(twoStages(), { m1: { met: true, metDate: w(8) } }, w(8));
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(14).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(18).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(22).getTime());
  });

  it('pulls what follows earlier when a point is met early, below the baseline', () => {
    const r = deriveForecast(twoStages(), { m1: { met: true, metDate: w(4) } }, w(4));
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(10).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(14).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(18).getTime());
    // The finish lands two weeks before the baseline finish: no baseline floor.
    expect(r.forecastCompletion.getTime()).toBe(w(18).getTime());
  });
});

describe('the overdue floor: unmet work forecasts from today, never the past', () => {
  it('forecasts an overdue unmet point from today plus its span', () => {
    // Nothing met, today at week 20: every baseline date has passed.
    const r = deriveForecast(twoStages(), {}, w(20));
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(26).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(32).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(36).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(40).getTime());
  });

  it('floors an unmet point whose predecessor completed in the past at today', () => {
    // m1 met on its baseline, but the gate was never met and today is week 20:
    // the gate forecasts today plus its six week span, not w(6) plus six.
    const r = deriveForecast(oneStage(), { m1: { met: true, metDate: w(6) } }, w(20));
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(26).getTime());
  });

  it('never lands an unmet forecast before today', () => {
    const r = deriveForecast(twoStages(), { m1: { met: true, metDate: w(6) } }, w(30));
    for (const key of ['m2']) {
      expect(milestoneOf(r, key).forecastDate.getTime()).toBeGreaterThanOrEqual(
        w(30).getTime()
      );
    }
    expect(gateOf(r, 0).forecastDate.getTime()).toBeGreaterThanOrEqual(w(30).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBeGreaterThanOrEqual(w(30).getTime());
  });
});

describe('the spine cascades: a slipped early gate moves the stages after it', () => {
  it('starts the next stage from the gate actual when the gate is met late', () => {
    const r = deriveForecast(twoStages(), { gate_0: { met: true, metDate: w(16) } }, w(16));
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(16).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(20).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(24).getTime());
  });

  it('pulls the next stage in when the gate is met early', () => {
    const r = deriveForecast(twoStages(), { gate_0: { met: true, metDate: w(9) } }, w(9));
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(9).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(13).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(17).getTime());
  });

  it('starts the next stage from the gate forecast when the gate is unmet', () => {
    // Gate 0 unmet and overdue at week 20: it forecasts w(26), and stage 1
    // rolls from that forecast, not from its baseline start.
    const r = deriveForecast(twoStages(), { m1: { met: true, metDate: w(6) } }, w(20));
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(26).getTime());
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(26).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(30).getTime());
  });
});

describe('stage 7 rolls concurrent with construction, never serialised onto the end', () => {
  // A spine of stages 4 to 6 and a concurrent stage 7 whose points were hand
  // set mid construction: the sales milestone at week 40, inside the stage 5
  // window (weeks 30 to 60), the sales gate at week 52. Stage 7's stageStart
  // sits at week 66 (the serial artefact of the rolling chain) and must NOT be
  // what the branch anchors on.
  const concurrentBaseline = () =>
    mkBaseline(
      mkStage(4, { stageStart: w(20), gateDate: w(30) }),
      mkStage(5, {
        stageStart: w(30),
        activities: [{ key: '5a', milestones: [mkMilestone('m5', w(45))] }],
        gateDate: w(60),
      }),
      mkStage(6, { stageStart: w(60), gateDate: w(66) }),
      mkStage(7, {
        stageStart: w(66),
        activities: [
          { key: '7a', milestones: [mkMilestone('s7m', w(40))] },
          { key: '7b', milestones: [] },
        ],
        gateDate: w(52),
      })
    );

  it('anchors sales on its baseline placement, carrying the overlapped drift', () => {
    // Gate 4 met three weeks late; today just after. Construction starts three
    // weeks late, and sales, placed mid construction, carries the same drift.
    const r = deriveForecast(
      concurrentBaseline(),
      { gate_4: { met: true, metDate: w(33) } },
      w(34)
    );
    const s7 = stageOf(r, 7);
    expect(s7.concurrent).toBe(true);
    expect(s7.anchorGateKey).toBe('gate_4');
    expect(s7.driftWeeks).toBe(3);
    expect(s7.forecastStart.getTime()).toBe(w(43).getTime());
    expect(milestoneOf(r, 's7m').forecastDate.getTime()).toBe(w(43).getTime());
    // The sales gate keeps its twelve week baseline span from the milestone.
    expect(gateOf(r, 7).forecastDate.getTime()).toBe(w(55).getTime());
  });

  it('finishes at the later of the two branches, not handover plus the sales run', () => {
    const r = deriveForecast(
      concurrentBaseline(),
      { gate_4: { met: true, metDate: w(33) } },
      w(34)
    );
    // The spine lands last here: m5 floors at today and cascades to gate 6.
    // m5: max(w33, w34) + 15 = w49; gate 5: w49 + 15 = w64; gate 6: w64 + 6 = w70.
    expect(gateOf(r, 6).forecastDate.getTime()).toBe(w(70).getTime());
    expect(r.forecastCompletion.getTime()).toBe(w(70).getTime());
    // Serialising sales onto the end would push the finish past week 82
    // (handover plus the twelve week sales tail). The concurrency keeps the
    // sales branch at week 55 and the finish at handover.
    expect(r.forecastCompletion.getTime()).toBeLessThan(w(82).getTime());
  });

  it('lets the sales branch set the finish when it lands last', () => {
    // The same shape with the sales gate placed at week 80: sales lands last
    // and the finish is the sales gate, respecting the concurrency both ways.
    const baseline = concurrentBaseline();
    baseline.stages[3].gate.baselineDate = w(80);
    const r = deriveForecast(baseline, { gate_4: { met: true, metDate: w(33) } }, w(34));
    expect(gateOf(r, 7).forecastDate.getTime()).toBe(w(83).getTime());
    expect(r.forecastCompletion.getTime()).toBe(w(83).getTime());
  });

  it('degrades to the serial behaviour when the baseline placed sales after handover', () => {
    // Sales placed after gate 6 (the default rolling chain shape): the branch
    // carries gate 6's drift, preserving the baseline gap to handover.
    const baseline = mkBaseline(
      mkStage(6, { stageStart: w(60), gateDate: w(66) }),
      mkStage(7, {
        stageStart: w(66),
        activities: [{ key: '7a', milestones: [mkMilestone('s7m', w(74))] }],
        gateDate: w(86),
      })
    );
    const r = deriveForecast(baseline, { gate_6: { met: true, metDate: w(70) } }, w(70));
    const s7 = stageOf(r, 7);
    expect(s7.anchorGateKey).toBe('gate_6');
    expect(s7.driftWeeks).toBe(4);
    expect(milestoneOf(r, 's7m').forecastDate.getTime()).toBe(w(78).getTime());
    expect(gateOf(r, 7).forecastDate.getTime()).toBe(w(90).getTime());
  });

  it('carries no drift when no spine gate sits at or before the placement', () => {
    const baseline = mkBaseline(
      mkStage(5, { stageStart: w(30), gateDate: w(60) }),
      mkStage(7, {
        stageStart: w(60),
        activities: [{ key: '7a', milestones: [mkMilestone('s7m', w(20))] }],
        gateDate: w(32),
      })
    );
    const r = deriveForecast(baseline, {}, w(0));
    const s7 = stageOf(r, 7);
    expect(s7.anchorGateKey).toBeNull();
    expect(s7.driftWeeks).toBeNull();
    expect(milestoneOf(r, 's7m').forecastDate.getTime()).toBe(w(20).getTime());
  });

  it('re-anchors the sales branch to its own actuals', () => {
    // The sales milestone met five weeks late: the sales gate rolls from the
    // actual, not from the drifted placement.
    const r = deriveForecast(
      concurrentBaseline(),
      { gate_4: { met: true, metDate: w(33) }, s7m: { met: true, metDate: w(45) } },
      w(45)
    );
    expect(milestoneOf(r, 's7m').forecastDate.getTime()).toBe(w(45).getTime());
    expect(gateOf(r, 7).forecastDate.getTime()).toBe(w(57).getTime());
  });

  it('names stage 7 as the one concurrent stage', () => {
    expect(CONCURRENT_STAGES).toEqual([7]);
  });
});

describe('the programme forecast completion is the latest across the programme', () => {
  it('takes the latest point across every applicable stage', () => {
    const r = deriveForecast(twoStages(), {}, w(0));
    expect(r.forecastCompletion.getTime()).toBe(w(20).getTime());
  });

  it('is null when the baseline holds nothing dated', () => {
    expect(deriveForecast({ stages: [] }, {}, w(0)).forecastCompletion).toBeNull();
    expect(deriveForecast(undefined, {}, w(0)).forecastCompletion).toBeNull();
  });

  it('can be dragged past a met gate by an unmet milestone under it, honestly', () => {
    // The gate was passed on time but m1 was never marked met: unmet is unmet,
    // exactly as the RAG engine still flags it. The met gate re-anchors the
    // chain so the phantom never leaks into the next stage.
    const r = deriveForecast(
      twoStages(),
      { gate_0: { met: true, metDate: w(12) }, m2: { met: true, metDate: w(16) }, gate_1: { met: true, metDate: w(20) } },
      w(22)
    );
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(28).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(12).getTime());
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(12).getTime());
    expect(r.forecastCompletion.getTime()).toBe(w(28).getTime());
  });
});

describe('a not-applicable stage is excluded entirely', () => {
  const naBaseline = () =>
    mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [{ key: '0a', milestones: [mkMilestone('m1', w(6))] }],
        gateDate: w(12),
      }),
      mkStage(1, {
        stageStart: w(12),
        activities: [{ key: '1a', milestones: [mkMilestone('mNA', w(16))] }],
        gateDate: w(500), // would dominate the finish if it were counted
        applicable: false,
      }),
      mkStage(2, {
        stageStart: w(12),
        activities: [{ key: '2a', milestones: [mkMilestone('m2', w(16))] }],
        gateDate: w(20),
      })
    );

  it('carries no forecast, no finish candidate, and the chain rolls across it', () => {
    const r = deriveForecast(naBaseline(), { gate_0: { met: true, metDate: w(13) } }, w(13));
    const na = stageOf(r, 1);
    expect(na.applicable).toBe(false);
    expect(na.forecastStart).toBeNull();
    expect(na.forecastCompletion).toBeNull();
    expect(na.gate.forecastDate).toBeNull();
    expect(milestoneOf(r, 'mNA').forecastDate).toBeNull();
    // Stage 2 rolls from gate 0's actual, one week late, straight across the
    // excluded stage.
    expect(stageOf(r, 2).forecastStart.getTime()).toBe(w(13).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(17).getTime());
    // The excluded gate at week 500 never becomes the finish.
    expect(r.forecastCompletion.getTime()).toBe(w(21).getTime());
  });

  it('still reports the met facts of an excluded stage, with no dates', () => {
    const r = deriveForecast(naBaseline(), { mNA: { met: true, metDate: w(16) } }, w(0));
    expect(milestoneOf(r, 'mNA').met).toBe(true);
    expect(milestoneOf(r, 'mNA').forecastDate).toBeNull();
  });

  it('treats an absent applicable flag as applicable', () => {
    const baseline = oneStage();
    delete baseline.stages[0].applicable;
    const r = deriveForecast(baseline, {}, w(0));
    expect(stageOf(r, 0).applicable).toBe(true);
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(12).getTime());
  });

  it('excludes a not-applicable stage 7 with no concurrent branch', () => {
    const baseline = mkBaseline(
      mkStage(6, { stageStart: w(0), gateDate: w(6) }),
      mkStage(7, { stageStart: w(6), gateDate: w(20), applicable: false })
    );
    const r = deriveForecast(baseline, {}, w(0));
    expect(stageOf(r, 7).applicable).toBe(false);
    expect(stageOf(r, 7).forecastCompletion).toBeNull();
    expect(r.forecastCompletion.getTime()).toBe(w(6).getTime());
  });
});

describe('activity forecast completions', () => {
  const baseline = () =>
    mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [
          { key: '0a', milestones: [mkMilestone('m1', w(6))] },
          { key: '0b', milestones: [] },
        ],
        gateDate: w(12),
      })
    );

  it('completes the closing activity at the gate, met or forecast', () => {
    const r = deriveForecast(baseline(), {}, w(0));
    const closing = activityOf(r, '0b');
    expect(closing.closesStage).toBe(true);
    expect(closing.forecastCompletion.getTime()).toBe(w(12).getTime());

    const met = deriveForecast(baseline(), { gate_0: { met: true, metDate: w(11) } }, w(11));
    expect(activityOf(met, '0b').forecastCompletion.getTime()).toBe(w(11).getTime());
  });

  it('completes a non-closing activity at its last trackable point', () => {
    const r = deriveForecast(baseline(), {}, w(0));
    const open = activityOf(r, '0a');
    expect(open.closesStage).toBe(false);
    expect(open.forecastCompletion.getTime()).toBe(w(6).getTime());
  });

  it('reports null for a non-closing activity with no trackable point', () => {
    const shuffled = mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [
          { key: '0a', milestones: [] },
          { key: '0b', milestones: [mkMilestone('m1', w(6))] },
        ],
        gateDate: w(12),
      })
    );
    const r = deriveForecast(shuffled, {}, w(0));
    expect(activityOf(r, '0a').forecastCompletion).toBeNull();
  });
});

describe('input shapes and honest edges', () => {
  it('accepts the met-points view as a Map as well as a plain object', () => {
    const viaObject = deriveForecast(oneStage(), { m1: { met: true, metDate: w(8) } }, w(8));
    const viaMap = deriveForecast(
      oneStage(),
      new Map([['m1', { met: true, metDate: w(8) }]]),
      w(8)
    );
    expect(viaMap).toEqual(viaObject);
  });

  it('ignores a met record for a point not in the baseline', () => {
    const clean = deriveForecast(oneStage(), {}, w(0));
    const noisy = deriveForecast(
      oneStage(),
      { not_a_point: { met: true, metDate: w(3) }, gate_9: { met: true, metDate: w(3) } },
      w(0)
    );
    expect(noisy).toEqual(clean);
  });

  it('treats an explicit met: false as not met', () => {
    const r = deriveForecast(oneStage(), { m1: { met: false, metDate: w(8) } }, w(0));
    expect(milestoneOf(r, 'm1').met).toBe(false);
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(6).getTime());
  });

  it('treats a met point with no recorded date as a fact with no forecast', () => {
    // A bare truthy record and a record with no metDate both mark the point
    // met but undated: no forecast is asserted, no re-anchor happens, and the
    // baseline spacing carries forward unchanged.
    const r = deriveForecast(oneStage(), { m1: true }, w(0));
    expect(milestoneOf(r, 'm1').met).toBe(true);
    expect(milestoneOf(r, 'm1').forecastDate).toBeNull();
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(12).getTime());
  });

  it('carries the chain across a dateless met gate with nothing observed', () => {
    const r = deriveForecast(twoStages(), { m1: { met: true, metDate: w(6) }, gate_0: { met: true } }, w(0));
    expect(gateOf(r, 0).forecastDate).toBeNull();
    // Everything ran on its baseline, so the carried position crossing the
    // boundary is the baseline position and stage 1 holds its baseline dates.
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(12).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(16).getTime());
  });

  it('carries the observed drift across a dateless met gate', () => {
    // m1 met ten weeks late, then the gate passed with no recorded date: the
    // chain's carried position, m1's actual plus the gate's six week spacing,
    // crosses the boundary, so the slip is never erased by the dateless gate.
    const r = deriveForecast(
      twoStages(),
      { m1: { met: true, metDate: w(16) }, gate_0: { met: true } },
      w(16)
    );
    expect(gateOf(r, 0).forecastDate).toBeNull();
    expect(stageOf(r, 1).forecastStart.getTime()).toBe(w(22).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(26).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(30).getTime());
  });

  it('skips a milestone with no key, folding its spacing into the next point', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [
          {
            key: '0a',
            milestones: [
              { name: 'keyless', baselineDate: w(6) },
              mkMilestone('m2', w(9)),
            ],
          },
        ],
        gateDate: w(12),
      })
    );
    const r = deriveForecast(baseline, {}, w(0));
    expect(stageOf(r, 0).activities[0].milestones.map((m) => m.key)).toEqual(['m2']);
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(9).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(12).getTime());
  });

  it('reproduces an out-of-order baseline as it stands, with no phantom variance', () => {
    // A hand-set gate placed before the milestone that precedes it in the
    // running order (assembly leaves such positions as they fall): on day one
    // both points forecast their own baseline dates, so the variance reads
    // zero, and nothing downstream is pushed by a phantom overhang.
    const baseline = mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [{ key: '0a', milestones: [mkMilestone('m1', w(10))] }],
        gateDate: w(8),
      }),
      mkStage(1, {
        stageStart: w(8),
        activities: [{ key: '1a', milestones: [mkMilestone('m2', w(12))] }],
        gateDate: w(16),
      })
    );
    const r = deriveForecast(baseline, {}, w(0));
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(10).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(8).getTime());
    expect(milestoneOf(r, 'm2').forecastDate.getTime()).toBe(w(12).getTime());
    expect(gateOf(r, 1).forecastDate.getTime()).toBe(w(16).getTime());
  });

  it('still floors an out-of-order unmet forecast at today', () => {
    const baseline = mkBaseline(
      mkStage(0, {
        stageStart: w(0),
        activities: [{ key: '0a', milestones: [mkMilestone('m1', w(10))] }],
        gateDate: w(8),
      })
    );
    const r = deriveForecast(baseline, {}, w(20));
    // m1 floors to today plus its ten week span; the gate keeps the baseline's
    // backwards spacing but never lands before today.
    expect(milestoneOf(r, 'm1').forecastDate.getTime()).toBe(w(30).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBe(w(28).getTime());
    expect(gateOf(r, 0).forecastDate.getTime()).toBeGreaterThanOrEqual(w(20).getTime());
  });
});

describe('required inputs', () => {
  it('throws a clear error when no today is held', () => {
    expect(() => deriveForecast(oneStage(), {}, '')).toThrow(/today/);
    expect(() => deriveForecast(oneStage(), {}, undefined)).toThrow(/today/);
    expect(() => deriveForecast(oneStage(), {}, null)).toThrow(/today/);
  });

  it('accepts today as a Date, an ISO string, and epoch milliseconds', () => {
    const viaDate = deriveForecast(oneStage(), {}, w(20));
    const viaIso = deriveForecast(oneStage(), {}, w(20).toISOString().slice(0, 10));
    const viaEpoch = deriveForecast(oneStage(), {}, w(20).getTime());
    expect(viaIso).toEqual(viaDate);
    expect(viaEpoch).toEqual(viaDate);
  });
});

describe('determinism and purity (reproducible from today, no clock, no side effects)', () => {
  const view = () => ({ m1: { met: true, metDate: w(8) } });

  it('gives identical output on repeated calls with identical input', () => {
    expect(deriveForecast(twoStages(), view(), w(10))).toEqual(
      deriveForecast(twoStages(), view(), w(10))
    );
  });

  it('is driven by the today passed in, not the wall clock', () => {
    const early = deriveForecast(twoStages(), {}, w(0));
    const late = deriveForecast(twoStages(), {}, w(30));
    expect(early.forecastCompletion.getTime()).toBe(w(20).getTime());
    expect(late.forecastCompletion.getTime()).toBe(w(50).getTime());
    expect(deriveForecast(twoStages(), {}, w(0))).toEqual(early);
  });

  it('never reads the clock', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('the engine read the clock');
    });
    expect(() => deriveForecast(twoStages(), view(), w(10))).not.toThrow();
  });

  it('does not mutate the baseline or the met-points view', () => {
    const baseline = twoStages();
    const metView = view();
    const baselineSnapshot = JSON.stringify(baseline);
    const viewSnapshot = JSON.stringify(metView);
    deriveForecast(baseline, metView, w(10));
    expect(JSON.stringify(baseline)).toBe(baselineSnapshot);
    expect(JSON.stringify(metView)).toBe(viewSnapshot);
  });
});

describe('it consumes a real assembled v1 baseline', () => {
  // Build a real assembled programme from the live template, exactly as the
  // sibling engine tests do, then forecast it. The hand-set dates mirror the
  // RAG test's advised placements.
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
  const mkChoices = (advised) => ({
    stages: PROGRAMME_TEMPLATE.stages.map((s) => {
      const o = advised[s.stage] ?? {};
      const milestones = {};
      for (const [key, weeks] of Object.entries(o.m ?? {})) {
        milestones[key] = { target_date: iso(weeks) };
      }
      return {
        stage: s.stage,
        target_date: o.gate ? iso(o.gate) : '',
        target_na: false,
        milestones,
      };
    }),
  });
  const objectives = [
    { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
    { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
    { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
    { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
    { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
  ];
  const baseline = assembleProgramme(
    START,
    PROGRAMME_TEMPLATE,
    mkChoices(ADVISED),
    [],
    objectives
  );
  const fromStart = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);

  it('reproduces every baseline date on a fresh programme, nothing met, day one', () => {
    const r = deriveForecast(baseline, {}, START);
    for (const stage of baseline.stages) {
      const node = r.stages.find((s) => s.stage === stage.stage);
      expect(node.gate.forecastDate.getTime()).toBe(stage.gate.baselineDate.getTime());
      for (const activity of stage.activities) {
        for (const m of activity.milestones) {
          const forecast = node.activities
            .flatMap((a) => a.milestones)
            .find((f) => f.key === m.key);
          expect(forecast.forecastDate.getTime()).toBe(m.baselineDate.getTime());
        }
      }
    }
    expect(r.forecastCompletion.getTime()).toBe(fromStart(146).getTime());
  });

  it('reproduces day one even where a placed offset lands past a hand-set gate', () => {
    // Gate 2 hand-set three weeks after gate 1, so the drill-down milestone
    // consultant_scope_agreed, placed at the stage start plus its four week
    // offset, lands a week past the gate (assembly leaves it as it falls). On
    // day one every point must still forecast its own baseline date: the
    // baseline's out-of-order spacing reproduces as it stands, nothing
    // downstream is pushed by a phantom overhang, and stage 7 carries no
    // phantom drift.
    const compressed = assembleProgramme(
      START,
      PROGRAMME_TEMPLATE,
      mkChoices({ ...ADVISED, 2: { gate: 23, m: { lead_consultant: 22 } } }),
      [],
      objectives
    );
    const r = deriveForecast(compressed, {}, START);
    for (const stage of compressed.stages) {
      const node = r.stages.find((s) => s.stage === stage.stage);
      expect(node.gate.forecastDate.getTime()).toBe(stage.gate.baselineDate.getTime());
      for (const activity of stage.activities) {
        for (const m of activity.milestones) {
          const forecast = node.activities
            .flatMap((a) => a.milestones)
            .find((f) => f.key === m.key);
          expect(forecast.forecastDate.getTime()).toBe(m.baselineDate.getTime());
        }
      }
    }
    expect(r.stages.find((s) => s.stage === 7).driftWeeks).toBe(0);
  });

  it('cascades a slipped early gate through the spine and into the sales drift', () => {
    // Everything to gate 1 met on its baseline except gate 1 itself, met four
    // weeks late. Today sits at the actual. Every later date shifts four weeks.
    const met = {
      heads_of_terms: { met: true, metDate: iso(6) },
      gate_0: { met: true, metDate: iso(12) },
      feasibility_confirmed: { met: true, metDate: iso(15) },
      finance_committed: { met: true, metDate: iso(18) },
      gate_1: { met: true, metDate: iso(24) },
    };
    const r = deriveForecast(baseline, met, fromStart(24));
    const gateF = (n) =>
      r.stages.find((s) => s.stage === n).gate.forecastDate.getTime();
    expect(gateF(2)).toBe(fromStart(30).getTime());
    expect(gateF(3)).toBe(fromStart(60).getTime());
    expect(gateF(4)).toBe(fromStart(72).getTime());
    expect(gateF(5)).toBe(fromStart(124).getTime());
    expect(gateF(6)).toBe(fromStart(130).getTime());
    // Sales, placed after handover in this baseline, carries gate 6's drift.
    const s7 = r.stages.find((s) => s.stage === 7);
    expect(s7.anchorGateKey).toBe('gate_6');
    expect(s7.driftWeeks).toBe(4);
    expect(gateF(7)).toBe(fromStart(150).getTime());
    expect(r.forecastCompletion.getTime()).toBe(fromStart(150).getTime());
  });

  it('pulls the finish in when an early completion runs ahead of the baseline', () => {
    const met = {
      heads_of_terms: { met: true, metDate: iso(6) },
      gate_0: { met: true, metDate: iso(12) },
      feasibility_confirmed: { met: true, metDate: iso(15) },
      finance_committed: { met: true, metDate: iso(16) },
      gate_1: { met: true, metDate: iso(16) }, // four weeks early
    };
    const r = deriveForecast(baseline, met, fromStart(16));
    const gateF = (n) =>
      r.stages.find((s) => s.stage === n).gate.forecastDate.getTime();
    expect(gateF(6)).toBe(fromStart(122).getTime());
    expect(gateF(7)).toBe(fromStart(142).getTime());
    expect(r.forecastCompletion.getTime()).toBe(fromStart(142).getTime());
  });

  it('keeps a hand-set concurrent sales run concurrent, mid construction', () => {
    // The Nigerian market pattern the specification names: sales hand set to
    // run concurrent with construction. First exchange at week 100, inside the
    // construction window (weeks 68 to 120), disposal at week 132. Gate 4 met
    // two weeks late, substructure met two weeks late, today mid build.
    const advised = {
      ...ADVISED,
      7: { gate: 132, m: { first_exchange: 100 } },
    };
    const concurrent = assembleProgramme(
      START,
      PROGRAMME_TEMPLATE,
      mkChoices(advised),
      [],
      objectives
    );
    const met = {
      heads_of_terms: { met: true, metDate: iso(6) },
      gate_0: { met: true, metDate: iso(12) },
      feasibility_confirmed: { met: true, metDate: iso(15) },
      finance_committed: { met: true, metDate: iso(18) },
      gate_1: { met: true, metDate: iso(20) },
      consultant_scope_agreed: { met: true, metDate: iso(24) },
      lead_consultant: { met: true, metDate: iso(24) },
      gate_2: { met: true, metDate: iso(26) },
      developed_design_complete: { met: true, metDate: iso(34) },
      planning_validated: { met: true, metDate: iso(40) },
      gate_3: { met: true, metDate: iso(56) },
      tenders_returned: { met: true, metDate: iso(64) },
      gate_4: { met: true, metDate: iso(70) }, // two weeks late
      substructure_complete: { met: true, metDate: iso(82) }, // two weeks late
    };
    const r = deriveForecast(concurrent, met, fromStart(84));
    const s7 = r.stages.find((s) => s.stage === 7);

    // Sales carries construction's start drift, two weeks, from gate 4.
    expect(s7.concurrent).toBe(true);
    expect(s7.anchorGateKey).toBe('gate_4');
    expect(s7.driftWeeks).toBe(2);
    const firstExchange = s7.activities
      .flatMap((a) => a.milestones)
      .find((m) => m.key === 'first_exchange');
    expect(firstExchange.forecastDate.getTime()).toBe(fromStart(102).getTime());
    expect(s7.gate.forecastDate.getTime()).toBe(fromStart(134).getTime());

    // Handover forecasts week 130, four weeks late: two from the actuals, and
    // two more because at today, week 84, the unmet superstructure span cannot
    // finish before week 98 (the overdue floor at work mid chain).
    const gate6 = r.stages.find((s) => s.stage === 6).gate;
    expect(gate6.forecastDate.getTime()).toBe(fromStart(130).getTime());

    // The finish is the later of handover and disposal, week 134, NOT handover
    // plus the thirty two week sales run (week 162): sales stays concurrent.
    expect(r.forecastCompletion.getTime()).toBe(fromStart(134).getTime());
    expect(r.forecastCompletion.getTime()).toBeLessThan(fromStart(162).getTime());
  });
});

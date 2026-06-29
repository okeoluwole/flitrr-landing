import { describe, it, expect } from 'vitest';
import { deriveProgress } from '../lib/engine/programmeProgress.js';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';

/**
 * The Programme percent-complete engine (Programme module Phase 3.1). Proves it
 * scores a non-closing activity by met-point count over its milestones, scores a
 * closing activity over its milestones plus its gate with the closing-gate
 * override taking it to one hundred, scores an empty closing activity by its gate
 * alone, weights the programme figure by activity duration rather than flat,
 * returns and computes the per-stage and per-activity figures, ignores a met
 * record for a point not in the baseline, leaves a not-applicable stage out of
 * the figure, never reads the met date, holds full precision, and is pure.
 *
 * The fixtures are hand-built minimal baselines in the assembled-baseline shape,
 * so each rule is exercised in isolation, plus one run on a real assembled
 * programme to prove the engine consumes the live v1 shape. Dates are not read by
 * this engine, so the met-points view carries only the met marker; a fixed met
 * date is used where realism helps and is never asserted on.
 */

// A met-points entry in the canonical { met: true, metDate } shape. The date is a
// fixed string for realism only; the engine never reads it.
const met = { met: true, metDate: '2026-03-02' };
// Build a met-points view that marks the given keys met.
const metView = (...keys) => Object.fromEntries(keys.map((k) => [k, met]));

// Build one activity in the assembled-baseline shape: a key, a duration, and the
// milestone keys it homes (each as a minimal { key, name } milestone).
function mkActivity(key, durationWeeks, milestoneKeys = []) {
  return {
    key,
    name: key,
    durationWeeks,
    milestones: milestoneKeys.map((k) => ({ key: k, name: k })),
  };
}

// Build one stage in the assembled-baseline shape. The gate closes the final
// activity by default, the same rule the assembly engine applies.
function mkStage(stage, activities, { applicable = true, closesActivityKey } = {}) {
  const closes =
    closesActivityKey ??
    (activities.length ? activities[activities.length - 1].key : null);
  return {
    stage,
    name: `Stage ${stage}`,
    applicable,
    activities,
    gate: { key: `gate_${stage}`, name: `Stage ${stage}`, closesActivityKey: closes },
  };
}

const mkBaseline = (stages) => ({ version: 'test-1.0.0', stages });

// Navigation helpers over the progress tree.
const stageOf = (tree, n) => tree.stages.find((s) => s.stage === n);
const activityOf = (tree, n, key) =>
  stageOf(tree, n).activities.find((a) => a.key === key);

describe('a non-closing activity is scored by met-point count over its milestones', () => {
  // Stage 0: a non-closing activity with four milestones and a separate closing
  // activity, so the gate falls on the closing one and the non-closing activity
  // holds only its four milestones.
  const baseline = mkBaseline([
    mkStage(0, [
      mkActivity('a_open', 10, ['m1', 'm2', 'm3', 'm4']),
      mkActivity('a_close', 10, ['m5']),
    ]),
  ]);

  it('reads one of four met milestones as twenty five percent, gate not in its point set', () => {
    const tree = deriveProgress(baseline, metView('m1'));
    const a = activityOf(tree, 0, 'a_open');
    expect(a.percentComplete).toBe(25);
    expect(a.metPoints).toBe(1);
    expect(a.totalPoints).toBe(4);
    expect(a.closesStage).toBe(false);
    expect(a.closedByGate).toBe(false);
    expect(a.counted).toBe(true);
  });

  it('does not count the gate towards a non-closing activity even when the gate is met', () => {
    const tree = deriveProgress(baseline, metView('m1', 'gate_0'));
    const a = activityOf(tree, 0, 'a_open');
    expect(a.totalPoints).toBe(4);
    expect(a.percentComplete).toBe(25);
  });
});

describe('a closing activity is scored over its milestones plus its gate', () => {
  // Stage 0: a single closing activity holding two milestones plus the stage gate,
  // so its point set is three.
  const baseline = mkBaseline([mkStage(0, [mkActivity('a_close', 10, ['m1', 'm2'])])]);

  it('counts the gate as one of the points, so one met of three reads a third', () => {
    const tree = deriveProgress(baseline, metView('m1'));
    const a = activityOf(tree, 0, 'a_close');
    expect(a.closesStage).toBe(true);
    expect(a.totalPoints).toBe(3);
    expect(a.metPoints).toBe(1);
    expect(a.percentComplete).toBeCloseTo(33.3333, 3);
    expect(a.percentComplete).not.toBe(33); // unrounded
    expect(a.closedByGate).toBe(false);
  });

  it('the closing-gate override reads one hundred percent when the gate is met, even with an unmarked milestone', () => {
    // Gate met, m1 and m2 both unmarked. Without the override the count would be
    // one of three; the override takes it to one hundred.
    const tree = deriveProgress(baseline, metView('gate_0'));
    const a = activityOf(tree, 0, 'a_close');
    expect(a.percentComplete).toBe(100);
    expect(a.closedByGate).toBe(true);
    expect(a.metPoints).toBe(1); // the working still shows only the gate met
    expect(a.totalPoints).toBe(3);
  });
});

describe('an empty closing activity is scored by its gate alone', () => {
  const baseline = mkBaseline([
    mkStage(0, [mkActivity('a_open', 10, ['m1']), mkActivity('a_close', 10, [])]),
  ]);

  it('reads zero while the gate is unmet, its single point being the gate', () => {
    const tree = deriveProgress(baseline, metView('m1'));
    const a = activityOf(tree, 0, 'a_close');
    expect(a.totalPoints).toBe(1);
    expect(a.metPoints).toBe(0);
    expect(a.percentComplete).toBe(0);
    expect(a.counted).toBe(true);
  });

  it('reads one hundred percent once the gate is met', () => {
    const tree = deriveProgress(baseline, metView('m1', 'gate_0'));
    const a = activityOf(tree, 0, 'a_close');
    expect(a.percentComplete).toBe(100);
    expect(a.closedByGate).toBe(true);
  });
});

describe('the programme figure is weighted by activity duration, not a flat average', () => {
  // One stage, two activities of different durations: a short fully complete
  // activity and a long empty one. A flat average would read fifty; the
  // duration-weighted average reads twenty five.
  const baseline = mkBaseline([
    mkStage(0, [
      mkActivity('a_short', 10, ['m1']), // 1 of 1 met -> 100 percent
      mkActivity('a_long', 30, []), // closing, gate unmet -> 0 percent
    ]),
  ]);

  it('weights an activity twice as long twice as much', () => {
    const tree = deriveProgress(baseline, metView('m1'));
    // (100 * 10 + 0 * 30) / 40 = 25
    expect(tree.percentComplete).toBe(25);
    expect(tree.percentComplete).not.toBe(50); // not the flat average
    expect(stageOf(tree, 0).percentComplete).toBe(25);
    expect(activityOf(tree, 0, 'a_short').percentComplete).toBe(100);
    expect(activityOf(tree, 0, 'a_long').percentComplete).toBe(0);
  });

  it('weights across stages by activity duration too', () => {
    // Stage A: one 10 week activity fully met (100). Stage B: one 30 week
    // activity empty and unmet (0). Programme = (100*10 + 0*30)/40 = 25.
    const twoStage = mkBaseline([
      mkStage(0, [mkActivity('a', 10, ['mA'])]),
      mkStage(1, [mkActivity('b', 30, [])]),
    ]);
    // Stage 0's single activity is its closing activity, so it holds mA plus
    // gate_0; both met reads 100. Stage 1's empty closing activity is gate_1 only,
    // unmet, reading 0.
    const tree = deriveProgress(twoStage, metView('mA', 'gate_0'));
    expect(stageOf(tree, 0).percentComplete).toBe(100);
    expect(stageOf(tree, 1).percentComplete).toBe(0);
    expect(tree.percentComplete).toBe(25);
  });
});

describe('all points met gives one hundred, no points met gives zero', () => {
  const baseline = mkBaseline([
    mkStage(0, [mkActivity('a0', 10, ['m1', 'm2']), mkActivity('a0b', 5, [])]),
    mkStage(1, [mkActivity('a1', 8, ['m3'])]),
  ]);

  it('every point met reads one hundred at every level', () => {
    const tree = deriveProgress(baseline, metView('m1', 'm2', 'm3', 'gate_0', 'gate_1'));
    expect(tree.percentComplete).toBe(100);
    for (const stage of tree.stages) {
      expect(stage.percentComplete).toBe(100);
      for (const a of stage.activities) expect(a.percentComplete).toBe(100);
    }
  });

  it('no point met reads zero at every level', () => {
    const tree = deriveProgress(baseline, {});
    expect(tree.percentComplete).toBe(0);
    for (const stage of tree.stages) {
      expect(stage.percentComplete).toBe(0);
      for (const a of stage.activities) expect(a.percentComplete).toBe(0);
    }
  });

  it('treats an absent met-points view the same as an empty one', () => {
    expect(deriveProgress(baseline, undefined)).toEqual(deriveProgress(baseline, {}));
  });
});

describe('a met record for a point not in the baseline is ignored', () => {
  const baseline = mkBaseline([mkStage(0, [mkActivity('a', 10, ['m1'])])]);

  it('extra keys in the met view do not change the result', () => {
    const clean = deriveProgress(baseline, metView('m1'));
    const noisy = deriveProgress(
      baseline,
      metView('m1', 'not_a_point', 'gate_9', 'ghost_milestone')
    );
    expect(noisy).toEqual(clean);
  });
});

describe('the per-stage and per-activity figures are returned and correct', () => {
  // Two stages with a mix of met and unmet points, durations chosen so the
  // weighted figures are exact.
  const baseline = mkBaseline([
    mkStage(0, [
      mkActivity('s0_open', 10, ['m1', 'm2', 'm3', 'm4']), // 2 met -> 50
      mkActivity('s0_close', 30, ['m5']), // closing, m5 + gate_0; m5 met, gate unmet -> 50
    ]),
    mkStage(1, [
      mkActivity('s1_open', 20, ['m6']), // unmet -> 0
      mkActivity('s1_close', 20, []), // closing, gate_1 met -> 100
    ]),
  ]);
  const tree = deriveProgress(baseline, metView('m1', 'm2', 'm5', 'gate_1'));

  it('returns the per-activity figures', () => {
    expect(activityOf(tree, 0, 's0_open').percentComplete).toBe(50);
    expect(activityOf(tree, 0, 's0_close').percentComplete).toBe(50);
    expect(activityOf(tree, 1, 's1_open').percentComplete).toBe(0);
    expect(activityOf(tree, 1, 's1_close').percentComplete).toBe(100);
  });

  it('returns the per-stage figures, duration-weighted within the stage', () => {
    // Stage 0: (50*10 + 50*30)/40 = 50. Stage 1: (0*20 + 100*20)/40 = 50.
    expect(stageOf(tree, 0).percentComplete).toBe(50);
    expect(stageOf(tree, 1).percentComplete).toBe(50);
  });

  it('returns the programme figure as the flat duration-weighted average over all activities', () => {
    // (50*10 + 50*30 + 0*20 + 100*20)/80 = 4000/80 = 50.
    expect(tree.percentComplete).toBe(50);
  });
});

describe('a not-applicable stage is left out of the figure', () => {
  it('does not score and does not drag the programme, even with an unmet skipped gate', () => {
    const withNa = mkBaseline([
      mkStage(0, [mkActivity('a', 10, ['m1'])]),
      mkStage(1, [mkActivity('b', 30, ['m2'])], { applicable: false }),
    ]);
    const tree = deriveProgress(withNa, metView('m1'));
    // Stage 1 is N/A: its gate and milestone are never counted.
    const s1 = stageOf(tree, 1);
    expect(s1.applicable).toBe(false);
    expect(s1.percentComplete).toBeNull();
    for (const a of s1.activities) {
      expect(a.counted).toBe(false);
      expect(a.percentComplete).toBeNull();
    }
    // The programme reads only stage 0: one of one met plus its gate unmet -> 50.
    expect(tree.percentComplete).toBe(50);
    // Identical to a baseline that simply omits the N/A stage.
    const without = mkBaseline([mkStage(0, [mkActivity('a', 10, ['m1'])])]);
    expect(tree.percentComplete).toBe(deriveProgress(without, metView('m1')).percentComplete);
  });
});

describe('the point-less guard', () => {
  it('excludes an activity that holds no points from the weighting', () => {
    // a_open is non-closing and has no milestones, so it holds no points. a_close
    // is the empty closing activity, holding only the gate.
    const baseline = mkBaseline([
      mkStage(0, [mkActivity('a_open', 99, []), mkActivity('a_close', 10, [])]),
    ]);
    const tree = deriveProgress(baseline, metView('gate_0'));
    const open = activityOf(tree, 0, 'a_open');
    expect(open.totalPoints).toBe(0);
    expect(open.counted).toBe(false);
    expect(open.percentComplete).toBeNull();
    // Despite a_open's huge duration, it does not move the average: the stage
    // reads the closing activity alone, gate met -> 100.
    expect(stageOf(tree, 0).percentComplete).toBe(100);
    expect(tree.percentComplete).toBe(100);
  });
});

describe('the met date is never read, only met or not met', () => {
  it('gives the same output regardless of the met date value', () => {
    const baseline = mkBaseline([mkStage(0, [mkActivity('a', 10, ['m1', 'm2'])])]);
    const early = { m1: { met: true, metDate: '2026-01-01' } };
    const late = { m1: { met: true, metDate: '2099-12-31' } };
    const noDate = { m1: { met: true } };
    expect(deriveProgress(baseline, late)).toEqual(deriveProgress(baseline, early));
    expect(deriveProgress(baseline, noDate)).toEqual(deriveProgress(baseline, early));
  });

  it('treats an explicit met: false entry as not met', () => {
    const baseline = mkBaseline([mkStage(0, [mkActivity('a', 10, ['m1', 'm2'])])]);
    const tree = deriveProgress(baseline, { m1: { met: true }, m2: { met: false } });
    // m1 met, m2 explicitly unmet, gate unmet: one of three.
    expect(activityOf(tree, 0, 'a').metPoints).toBe(1);
  });
});

describe('determinism and purity', () => {
  const baseline = mkBaseline([
    mkStage(0, [mkActivity('a', 10, ['m1', 'm2']), mkActivity('b', 20, [])]),
    mkStage(1, [mkActivity('c', 8, ['m3'])], { applicable: false }),
  ]);
  const view = metView('m1', 'gate_0');

  it('gives identical output on repeated calls with identical input', () => {
    expect(deriveProgress(baseline, view)).toEqual(deriveProgress(baseline, view));
  });

  it('does not mutate the baseline or the met-points view', () => {
    const baselineSnapshot = JSON.stringify(baseline);
    const viewSnapshot = JSON.stringify(view);
    deriveProgress(baseline, view);
    expect(JSON.stringify(baseline)).toBe(baselineSnapshot);
    expect(JSON.stringify(view)).toBe(viewSnapshot);
  });

  it('returns null figures for an empty or absent baseline, with no throw', () => {
    expect(deriveProgress({ stages: [] }, view)).toEqual({ percentComplete: null, stages: [] });
    expect(deriveProgress(undefined, view)).toEqual({ percentComplete: null, stages: [] });
  });
});

describe('it consumes a real assembled v1 baseline', () => {
  // Build a real assembled programme from the live template, then score it. This
  // proves the engine reads the actual baseline shape, keys, durations, and gates.
  const START = new Date(Date.UTC(2026, 0, 5));
  const iso = (weeks) =>
    new Date(START.getTime() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // The developer's hand-set choices at the advised positions, so assembly runs
  // cleanly with an empty resolution set.
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

  it('reads zero with nothing met and one hundred with everything met', () => {
    expect(deriveProgress(baseline, {}).percentComplete).toBe(0);
    // Mark every milestone and every gate met.
    const everything = {};
    for (const stage of baseline.stages) {
      everything[stage.gate.key] = met;
      for (const a of stage.activities) for (const m of a.milestones) everything[m.key] = met;
    }
    expect(deriveProgress(baseline, everything).percentComplete).toBe(100);
  });

  it('reads a single milestone met as one hundred for its activity', () => {
    // 0a_site_search holds the single milestone heads_of_terms.
    const tree = deriveProgress(baseline, metView('heads_of_terms'));
    expect(activityOf(tree, 0, '0a_site_search').percentComplete).toBe(100);
  });

  it('reads the empty closing activity 0b at one hundred once gate_0 is met', () => {
    const tree = deriveProgress(baseline, metView('gate_0'));
    const closing = activityOf(tree, 0, '0b_legal_completion');
    expect(closing.totalPoints).toBe(1);
    expect(closing.percentComplete).toBe(100);
    expect(closing.closedByGate).toBe(true);
  });

  it('weights Construction by activity duration: superstructure (24w) met alone reads about 44 percent of the stage', () => {
    // Stage 5 activities: 5a (12w), 5b (24w), 5c (18w, closing). Only the 5b
    // milestone superstructure is met. (100*24)/(12+24+18) = 2400/54.
    const tree = deriveProgress(baseline, metView('superstructure'));
    expect(stageOf(tree, 5).percentComplete).toBeCloseTo(2400 / 54, 6);
    expect(activityOf(tree, 5, '5b_superstructure').percentComplete).toBe(100);
    expect(activityOf(tree, 5, '5a_substructure').percentComplete).toBe(0);
    expect(activityOf(tree, 5, '5c_fitout_finishing').percentComplete).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  PROGRAMME_TEMPLATE_VERSION,
} from '../lib/engine/programmeTemplate.js';
import {
  deriveRealityCheck,
  summedActivityBand,
  RECONCILE_TIERS,
  RECONCILE_ITEM_KINDS,
  IMPLIED_BASES,
} from '../lib/engine/programmeRealityCheck.js';

/**
 * The Programme reality-check engine (Programme module Phase 1.1). Proves it
 * classifies the developer's hand-set programme dates against the two-level
 * template into the four reconcile tiers, returns a recommended date where a date
 * diverges, surfaces the held gateWeeks-vs-activity-sum divergence under the
 * generous band rather than resolving it, and is pure and deterministic.
 *
 * A fixed UTC anchor keeps every assertion independent of the test runner's
 * timezone. Implied durations are checked in whole weeks from that anchor rather
 * than hand-computed calendar dates.
 */

const T = PROGRAMME_TEMPLATE;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// A Date a whole number of weeks after the fixed anchor, in UTC.
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
// A Date a whole number of weeks plus whole days after the anchor, for a span
// that lands off a whole-week boundary (a fractional implied duration).
const wd = (weeks, days) =>
  new Date(START.getTime() + weeks * MS_PER_WEEK + days * 24 * 60 * 60 * 1000);
// Whole-week distance of a Date from the anchor.
const weeksFromStart = (date) => (date.getTime() - START.getTime()) / MS_PER_WEEK;
// An ISO date input value (YYYY-MM-DD), as the date input gives.
const iso = (date) => date.toISOString().slice(0, 10);

// Build the developer's programme choices from a compact per-stage spec:
//   { [stage]: { gate?: Date, na?: boolean, milestones?: { [key]: Date } } }
// Every template stage gets an entry, so the shape matches loadProgrammeChoices.
function makeChoices(spec) {
  const stages = T.stages.map((s) => {
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

// Find a checked item by stage and kind (and milestone key, for a milestone).
const item = (result, stage, kind, key) =>
  result.items.find(
    (i) => i.stage === stage && i.kind === kind && (key ? i.key === key : true)
  );
const gateItem = (result, stage) =>
  item(result, stage, RECONCILE_ITEM_KINDS.GATE);
const milestoneItem = (result, stage, key) =>
  item(result, stage, RECONCILE_ITEM_KINDS.MILESTONE, key);

// The advised gateWeeks dates, accepted in full: a fully clean baseline the held
// divergence must absorb. Gate weeks 12, 20, 26, 56, 68, 120, 126, 146 from the
// start; each milestone at its stage start plus its curated offset.
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
// Confirmed local floors for the four location-sensitive stages (3, 4, 5, 6),
// each set below the advised span so the floor is met and the gate is not held at
// flag_verify. Without these the location-sensitive gates would read flag_verify.
const FLOORS_MET = {
  localFloors: {
    3: { floorWeeks: 20 },
    4: { floorWeeks: 8 },
    5: { floorWeeks: 30 },
    6: { floorWeeks: 4 },
  },
};

describe('the summed activity band', () => {
  it('sums each stage activity band from its activities (the generous gate band)', () => {
    const bandOf = (n) =>
      summedActivityBand(T.stages.find((s) => s.stage === n));
    expect(bandOf(0)).toEqual({ min: 10, max: 30 });
    expect(bandOf(1)).toEqual({ min: 4, max: 14 });
    expect(bandOf(2)).toEqual({ min: 4, max: 12 });
    expect(bandOf(3)).toEqual({ min: 10, max: 30 });
    expect(bandOf(4)).toEqual({ min: 6, max: 18 });
    expect(bandOf(5)).toEqual({ min: 27, max: 81 });
    expect(bandOf(6)).toEqual({ min: 5, max: 15 });
    expect(bandOf(7)).toEqual({ min: 16, max: 48 });
  });
});

describe('within_norm: a gate span inside the generous band', () => {
  it('reads a stage span inside the band silently, with the gateWeeks advised date reported', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(12) } }));
    const g = gateItem(r, 0);
    expect(g.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
    expect(g.kind).toBe('gate');
    expect(g.key).toBe('gate_0');
    expect(g.implied.basis).toBe(IMPLIED_BASES.STAGE_SPAN);
    expect(g.implied.weeks).toBe(12);
    expect(g.implied.band).toEqual({ min: 10, max: 30 });
    expect(g.implied.withinBand).toBe(true);
    expect(g.recommendedDate).toBeNull();
    expect(g.reason).toBe('');
    // The advised date is the gateWeeks date (12 weeks), authoritative as ever.
    expect(weeksFromStart(g.advisedDate)).toBe(12);
  });
});

describe('the generous band boundary (a duration just inside vs just outside)', () => {
  it('reads a stage span exactly on the band edge as within_norm (inclusive)', () => {
    // Stage 0 band max is 30 weeks.
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(30) } }));
    const g = gateItem(r, 0);
    expect(g.implied.weeks).toBe(30);
    expect(g.implied.withinBand).toBe(true);
    expect(g.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });

  it('reads a stage span one week past the edge as propose, recommending the typical', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
    const g = gateItem(r, 0);
    expect(g.implied.weeks).toBe(31);
    expect(g.implied.withinBand).toBe(false);
    expect(g.tier).toBe(RECONCILE_TIERS.PROPOSE);
    // The recommended date brings the span back to the sum of the activity
    // typicals (stage 0: 12 + 8 = 20 weeks), the band centre.
    expect(weeksFromStart(g.recommendedDate)).toBe(20);
    expect(g.reason).toContain('above');
  });

  it('reads a stage span one week below the edge as propose', () => {
    // Stage 0 band min is 10 weeks; 9 weeks is just outside.
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(9) } }));
    const g = gateItem(r, 0);
    expect(g.implied.weeks).toBe(9);
    expect(g.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(weeksFromStart(g.recommendedDate)).toBe(20);
    expect(g.reason).toContain('below');
  });
});

describe('milestones are checked on their curated offset', () => {
  it('reads a milestone at its advised offset as within_norm', () => {
    const r = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { milestones: { heads_of_terms: w(6) } } })
    );
    const m = milestoneItem(r, 0, 'heads_of_terms');
    expect(m.kind).toBe('milestone');
    expect(m.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
    expect(m.implied.basis).toBe(IMPLIED_BASES.STAGE_OFFSET);
    expect(m.implied.weeks).toBe(6);
    // withinNormBand(6): half = max(round(3), 2) = 3, so 3 to 9 weeks.
    expect(m.implied.band).toEqual({ min: 3, max: 9 });
    expect(m.locationSensitive).toBe(false);
  });

  it('reads a milestone beyond its offset band as propose, recommending the offset', () => {
    const r = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { milestones: { heads_of_terms: w(10) } } })
    );
    const m = milestoneItem(r, 0, 'heads_of_terms');
    expect(m.implied.weeks).toBe(10);
    expect(m.tier).toBe(RECONCILE_TIERS.PROPOSE);
    // Recommended back to the curated offset (6 weeks from the stage start).
    expect(weeksFromStart(m.recommendedDate)).toBe(6);
    expect(m.reason).toContain('above');
  });
});

describe('flag_verify: a location-sensitive point with no confirmed local value', () => {
  it('flags a dated location-sensitive gate as flag_verify, not as a hard block', () => {
    // Stage 3 is location-sensitive (planning). Gate at the advised span (30
    // weeks), so the spacing is fine; with no confirmed floor it still verifies.
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }));
    const g = gateItem(r, 3);
    expect(g.tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
    expect(g.locationSensitive).toBe(true);
    expect(g.recommendedDate).toBeNull();
    // The reason carries the template's plain-language verify prompt.
    expect(g.reason).toContain('Planning approval');
    expect(g.reason).toContain('determination period');
  });

  it('leaves a non-location-sensitive gate alone (stage 0 never flag_verify)', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(12) } }));
    expect(gateItem(r, 0).locationSensitive).toBe(false);
    expect(gateItem(r, 0).tier).not.toBe(RECONCILE_TIERS.FLAG_VERIFY);
  });
});

describe('force: only when a confirmed local hard floor is breached', () => {
  it('assigns force when the gate date is below a confirmed local floor', () => {
    // Stage 3 starts at week 26 (advised gates 0 to 2). Gate at week 36 implies a
    // 10 week span, below the confirmed 20 week floor.
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(36) } }), {
      localFloors: { 3: { floorWeeks: 20 } },
    });
    const g = gateItem(r, 3);
    expect(g.tier).toBe(RECONCILE_TIERS.FORCE);
    // Recommended up to the floor: stage start (week 26) plus 20 weeks.
    expect(weeksFromStart(g.recommendedDate)).toBe(46);
    expect(g.reason).toContain('floor');
  });

  it('does not force or flag_verify when the confirmed floor is met (falls to the spacing check)', () => {
    // Gate at the advised span (30 weeks): above the 20 week floor and inside the
    // 10 to 30 week band, so the confirmed value resolves it to within_norm.
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }), {
      localFloors: { 3: { floorWeeks: 20 } },
    });
    expect(gateItem(r, 3).tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });

  it('falls through to a spacing propose when the floor is met but the span is out of band', () => {
    // Floor 10 weeks met (span 40), but 40 is above the 10 to 30 band, so propose.
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(66) } }), {
      localFloors: { 3: { floorWeeks: 10 } },
    });
    const g = gateItem(r, 3);
    expect(g.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(weeksFromStart(g.recommendedDate)).toBe(46); // start 26 + typical 20
  });

  it('lets force take precedence over the location-sensitive flag', () => {
    // Stage 5 is location-sensitive and the floor is breached: force, not flag_verify.
    const r = deriveRealityCheck(START, T, makeChoices({ 5: { gate: w(78) } }), {
      localFloors: { 5: { floorWeeks: 30 } },
    });
    const g = gateItem(r, 5);
    // Stage 5 starts at week 68 (advised gates 0 to 4); gate at 78 implies 10 weeks.
    expect(g.implied.weeks).toBe(10);
    expect(g.tier).toBe(RECONCILE_TIERS.FORCE);
  });
});

describe('all four tiers from one representative input', () => {
  const r = deriveRealityCheck(
    START,
    T,
    makeChoices({
      0: { gate: w(12) }, // within_norm: span 12 in 10 to 30
      3: { gate: w(56) }, // flag_verify: location-sensitive, no floor
      5: { gate: w(78) }, // force: location-sensitive floor breached
      7: { gate: w(176) }, // propose: span out of band, not location-sensitive
    }),
    { localFloors: { 5: { floorWeeks: 30 } } }
  );

  it('produces within_norm, flag_verify, force and propose together', () => {
    expect(gateItem(r, 0).tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
    expect(gateItem(r, 3).tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
    expect(gateItem(r, 5).tier).toBe(RECONCILE_TIERS.FORCE);
    expect(gateItem(r, 7).tier).toBe(RECONCILE_TIERS.PROPOSE);
  });

  it('tallies the tier counts and sets anyFlagged', () => {
    expect(r.counts).toEqual({
      within_norm: 1,
      propose: 1,
      force: 1,
      flag_verify: 1,
    });
    expect(r.anyFlagged).toBe(true);
  });
});

describe('the overall flag', () => {
  it('returns anyFlagged false when every checked item is within_norm, so reconcile is skipped', () => {
    const r = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(12) }, 1: { gate: w(20) } })
    );
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.tier === RECONCILE_TIERS.WITHIN_NORM)).toBe(
      true
    );
    expect(r.anyFlagged).toBe(false);
    expect(r.counts.within_norm).toBe(r.items.length);
  });

  it('checks only the dates the developer set (undated points raise no item)', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(12) } }));
    // Only the one dated gate is checked; nothing else.
    expect(r.items).toHaveLength(1);
    expect(r.items[0].key).toBe('gate_0');
  });
});

describe('the held gateWeeks-vs-activity-sum divergence', () => {
  it('reads every stage within_norm when the advised gateWeeks dates are accepted', () => {
    // The generous band absorbs the divergence: with confirmed floors met on the
    // location-sensitive stages, the whole advised programme is silent.
    const r = deriveRealityCheck(START, T, makeChoices(ADVISED_SPEC), FLOORS_MET);
    expect(r.items).toHaveLength(8 + 9); // eight gates, nine headline milestones
    expect(r.items.every((i) => i.tier === RECONCILE_TIERS.WITHIN_NORM)).toBe(
      true
    );
    expect(r.anyFlagged).toBe(false);
  });

  it('still absorbs the divergence on the stages whose activity sum diverges from gateWeeks', () => {
    // Stage 6 is the tightest: gateWeeks 6 against an activity sum of 10, band 5
    // to 15. The advised 6 week span sits inside the band, so it is silent.
    const r = deriveRealityCheck(START, T, makeChoices(ADVISED_SPEC), FLOORS_MET);
    const g6 = gateItem(r, 6);
    expect(g6.implied.weeks).toBe(6);
    expect(g6.implied.band).toEqual({ min: 5, max: 15 });
    expect(g6.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });

  it('surfaces a propose on a divergent stage when a developer date pushes its span out of band', () => {
    // Stage 7: activity sum 32 against gateWeeks 20, band 16 to 48. A gate that
    // implies a 50 week span breaks the band and is proposed back to the typical.
    const r = deriveRealityCheck(
      START,
      T,
      makeChoices({
        ...ADVISED_SPEC,
        7: { gate: w(176), milestones: { first_exchange: w(134) } },
      }),
      FLOORS_MET
    );
    const g7 = gateItem(r, 7);
    expect(g7.implied.weeks).toBe(50); // stage 7 starts at week 126
    expect(g7.implied.band).toEqual({ min: 16, max: 48 });
    expect(g7.tier).toBe(RECONCILE_TIERS.PROPOSE);
    // Recommended back to the activity-sum typical: start (126) plus 32 weeks.
    expect(weeksFromStart(g7.recommendedDate)).toBe(158);
    expect(r.anyFlagged).toBe(true);
  });
});

describe('N/A stages are skipped and the chain carries forward', () => {
  it('raises no item for a not-applicable stage and anchors the next stage on the carried date', () => {
    // Stage 1 N/A. Stage 2 then starts where stage 0 gate left off (week 12), so
    // a stage 2 gate at week 18 implies a 6 week span, inside the 4 to 12 band.
    const r = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(12) }, 1: { na: true }, 2: { gate: w(18) } })
    );
    expect(gateItem(r, 1)).toBeUndefined();
    const g2 = gateItem(r, 2);
    expect(g2.implied.weeks).toBe(6);
    expect(g2.tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });
});

describe('input shape and project start', () => {
  it('accepts the choices as a plain per-stage array as well as the { stages } object', () => {
    const viaObject = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(31) } })
    );
    const viaArray = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(31) } }).stages
    );
    expect(viaArray.items).toEqual(viaObject.items);
  });

  it('accepts an ISO date string project start', () => {
    const r = deriveRealityCheck('2026-01-05', T, makeChoices({ 0: { gate: w(12) } }));
    expect(r.projectStart.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(gateItem(r, 0).implied.weeks).toBe(12);
  });

  it('throws a clear error when no project start is held', () => {
    expect(() => deriveRealityCheck('', T, makeChoices({}))).toThrow(
      /project start/
    );
  });

  it('echoes the template version', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(12) } }));
    expect(r.version).toBe(PROGRAMME_TEMPLATE_VERSION);
  });
});

describe('confirmed-floor validity (a malformed floor must not silently clear the verify prompt)', () => {
  it('treats a NaN floor as not supplied, so a location-sensitive gate degrades to flag_verify', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }), {
      localFloors: { 3: { floorWeeks: NaN } },
    });
    expect(gateItem(r, 3).tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
  });

  it('treats a negative floor as not supplied, so the gate degrades to flag_verify', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }), {
      localFloors: { 3: { floorWeeks: -5 } },
    });
    expect(gateItem(r, 3).tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
  });

  it('accepts a floor of zero as a confirmed value (requirement checked, no minimum)', () => {
    // Confirmed and trivially met, so the location-sensitive prompt clears and the
    // gate falls to the spacing check (span 30 is inside the 10 to 30 band).
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }), {
      localFloors: { 3: { floorWeeks: 0 } },
    });
    expect(gateItem(r, 3).tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
  });

  it('treats a gate exactly on the floor as met, not breached (strict below)', () => {
    // Stage 3 starts at week 26; a gate at week 46 implies exactly the 20 week floor.
    const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(46) } }), {
      localFloors: { 3: { floorWeeks: 20 } },
    });
    expect(gateItem(r, 3).tier).not.toBe(RECONCILE_TIERS.FORCE);
  });
});

describe('the propose reason rounds the figure to stay honestly outside the band', () => {
  it('rounds a fractional span above the band up, so it never reads N is above the N week norm', () => {
    // Stage 0 band max is 30 weeks; a span of 30 weeks and 4 days is above it.
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: wd(30, 4) } }));
    const g = gateItem(r, 0);
    expect(g.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(g.implied.weeks).toBeCloseTo(30 + 4 / 7, 5);
    expect(g.reason).toContain('31 weeks');
    expect(g.reason).toContain('above');
  });

  it('rounds a fractional span below the band down', () => {
    // Stage 0 band min is 10 weeks; a span of 9 weeks and 6 days is below it.
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: wd(9, 6) } }));
    const g = gateItem(r, 0);
    expect(g.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(g.reason).toContain('9 weeks');
    expect(g.reason).toContain('below');
  });
});

describe('robustness on empty and pathological choice shapes', () => {
  it('raises no items for empty, undefined or null choices', () => {
    for (const c of [{}, undefined, null, { stages: [] }, []]) {
      const r = deriveRealityCheck(START, T, c);
      expect(r.items).toHaveLength(0);
      expect(r.anyFlagged).toBe(false);
    }
  });

  it('ignores a milestone key that is not in the template', () => {
    const choices = makeChoices({ 0: {} });
    choices.stages[0].milestones = { not_a_real_key: { target_date: iso(w(5)) } };
    const r = deriveRealityCheck(START, T, choices);
    expect(r.items).toHaveLength(0);
  });

  it('never emits NaN implied weeks (every checked item has a real anchor)', () => {
    const r = deriveRealityCheck(START, T, makeChoices(ADVISED_SPEC), FLOORS_MET);
    for (const i of r.items) expect(Number.isNaN(i.implied.weeks)).toBe(false);
  });
});

describe('summedActivityBand is re-exported from the engine', () => {
  it('exposes the helper that lives in the template', () => {
    expect(summedActivityBand(T.stages.find((s) => s.stage === 7))).toEqual({
      min: 16,
      max: 48,
    });
  });
});

describe('pure and deterministic', () => {
  it('gives identical output on repeated calls with identical input', () => {
    const a = deriveRealityCheck(START, T, makeChoices(ADVISED_SPEC), FLOORS_MET);
    const b = deriveRealityCheck(START, T, makeChoices(ADVISED_SPEC), FLOORS_MET);
    expect(a).toEqual(b);
  });

  it('does not mutate the template or the choices passed in', () => {
    const choices = makeChoices({ 0: { gate: w(31) } });
    const choicesSnapshot = JSON.parse(JSON.stringify(choices));
    deriveRealityCheck(START, T, choices);
    expect(choices).toEqual(choicesSnapshot);
    // The template is untouched: no derived field leaks onto it.
    expect(PROGRAMME_TEMPLATE.stages[0].tier).toBeUndefined();
    expect(
      PROGRAMME_TEMPLATE.stages[0].activities[0].milestones[0].advisedDate
    ).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  PROGRAMME_TEMPLATE_VERSION,
  SERVED_OBJECTIVES,
  MILESTONE_TIER,
  stageMilestones,
  stageActivityWeeks,
  withinNormBand,
} from '../lib/engine/programmeTemplate.js';

/**
 * The curated programme template (Step 7, sub-step 1a; extended to two levels by
 * Programme module Phase 1 Foundation). Proves the template is versioned, marked
 * as curated estimates, covers the eight lifecycle stages, and that its
 * location-sensitive checkpoints are flags only. The Foundation step adds the
 * two-level shape: an ordered activities array per stage (two as the norm, three
 * for Construction), each with a typical duration and a generous within-norm
 * band, the milestones re-homed onto the activity each sits under, and the gate
 * still placed by gateWeeks. It also proves the gate-timing divergence the step
 * deliberately holds for later reconciliation, rather than papering over it.
 */

const SERVED_VALUES = Object.values(SERVED_OBJECTIVES);
const stageOf = (n) => PROGRAMME_TEMPLATE.stages.find((s) => s.stage === n);
const activityOf = (stage, key) => stage.activities.find((a) => a.key === key);
const milestoneOf = (stage, name) =>
  stageMilestones(stage).find((m) => m.name === name);

// The first-draft activity breakdown (specification Section 6), as the canonical
// set the template must reproduce: per stage, the ordered activities by key,
// name, and typical weeks, with the milestone keys re-homed onto each.
const ACTIVITY_SPEC = {
  0: [
    ['0a_site_search', 'Site search and appraisal', 12, ['heads_of_terms']],
    ['0b_legal_completion', 'Acquisition and legal completion', 8, []],
  ],
  1: [
    ['1a_brief_feasibility', 'Brief and feasibility', 3, []],
    ['1b_funding_secured', 'Funding secured', 6, ['finance_committed']],
  ],
  2: [
    ['2a_scope_selection', 'Scope and selection', 4, []],
    ['2b_appointment_mobilisation', 'Appointment and mobilisation', 4, ['lead_consultant']],
  ],
  3: [
    ['3a_design_development', 'Design development', 8, []],
    ['3b_planning_approvals', 'Planning and statutory approvals', 12, ['planning_validated']],
  ],
  4: [
    ['4a_tender', 'Tender', 6, ['tenders_returned']],
    ['4b_evaluation_award', 'Evaluation and award', 6, []],
  ],
  5: [
    ['5a_substructure', 'Substructure', 12, []],
    ['5b_superstructure', 'Superstructure', 24, ['superstructure']],
    ['5c_fitout_finishing', 'Fit-out and finishing', 18, ['finishing']],
  ],
  6: [
    ['6a_completion_certification', 'Completion and certification', 4, ['completion_certificate']],
    ['6b_handover_defects', 'Handover and defects', 6, []],
  ],
  7: [
    ['7a_marketing_sales', 'Marketing and sales', 20, ['first_exchange']],
    ['7b_completions_disposal', 'Completions and disposal', 12, []],
  ],
};

// The gate durations the live Brief derives its advised dates from, retained
// unchanged at this step so the locked Brief stays byte-stable.
const GATE_WEEKS = { 0: 12, 1: 8, 2: 6, 3: 30, 4: 12, 5: 52, 6: 6, 7: 20 };

describe('PROGRAMME_TEMPLATE shape', () => {
  it('is versioned and marks its durations as curated estimates in weeks', () => {
    expect(PROGRAMME_TEMPLATE.version).toBe(PROGRAMME_TEMPLATE_VERSION);
    expect(PROGRAMME_TEMPLATE.version).toBe('1.2.0');
    expect(PROGRAMME_TEMPLATE.basis).toBe('curated estimate');
    expect(PROGRAMME_TEMPLATE.unit).toBe('weeks');
    expect(PROGRAMME_TEMPLATE.region).toBe('neutral');
  });

  it('covers the eight lifecycle stages 0 to 7 in order', () => {
    expect(PROGRAMME_TEMPLATE.stages.map((s) => s.stage)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('gives every stage a positive gate duration and at least one milestone', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      expect(stage.gateWeeks).toBeGreaterThan(0);
      expect(stageMilestones(stage).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('retains the shipped gate durations unchanged (the Brief stays byte-stable)', () => {
    for (const [stage, weeks] of Object.entries(GATE_WEEKS)) {
      expect(stageOf(Number(stage)).gateWeeks).toBe(weeks);
    }
  });

  it('is read-only (deep frozen) so the derivation cannot mutate it', () => {
    expect(Object.isFrozen(PROGRAMME_TEMPLATE)).toBe(true);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE.stages)).toBe(true);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE.stages[0].activities)).toBe(true);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE.stages[0].activities[0])).toBe(true);
    expect(
      Object.isFrozen(PROGRAMME_TEMPLATE.stages[0].activities[0].withinNormWeeks)
    ).toBe(true);
    expect(
      Object.isFrozen(PROGRAMME_TEMPLATE.stages[0].activities[0].milestones[0])
    ).toBe(true);
  });
});

describe('the two-level activities shape', () => {
  it('gives every stage an ordered activities array, two per stage and three for Construction', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      expect(Array.isArray(stage.activities)).toBe(true);
      const expected = stage.stage === 5 ? 3 : 2;
      expect(stage.activities).toHaveLength(expected);
    }
  });

  it('gives every activity a key, name, typical duration, within-norm band, and milestones array', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const a of stage.activities) {
        expect(typeof a.key).toBe('string');
        expect(a.key.length).toBeGreaterThan(0);
        expect(typeof a.name).toBe('string');
        expect(a.name.length).toBeGreaterThan(0);
        expect(typeof a.typicalWeeks).toBe('number');
        expect(a.typicalWeeks).toBeGreaterThan(0);
        expect(typeof a.withinNormWeeks.min).toBe('number');
        expect(typeof a.withinNormWeeks.max).toBe('number');
        expect(Array.isArray(a.milestones)).toBe(true);
      }
    }
  });

  it('encodes the Section 6 activities in order, by key, name and typical weeks', () => {
    for (const [stage, specs] of Object.entries(ACTIVITY_SPEC)) {
      const got = stageOf(Number(stage)).activities.map((a) => [
        a.key,
        a.name,
        a.typicalWeeks,
      ]);
      expect(got).toEqual(specs.map(([key, name, weeks]) => [key, name, weeks]));
    }
  });

  it('gives every activity a unique key, distinct from every milestone key', () => {
    const activityKeys = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
      s.activities.map((a) => a.key)
    );
    const milestoneKeys = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
      stageMilestones(s).map((m) => m.key)
    );
    // Activity keys are unique among themselves.
    expect(new Set(activityKeys).size).toBe(activityKeys.length);
    // And no activity key collides with any milestone key.
    const milestoneSet = new Set(milestoneKeys);
    for (const key of activityKeys) expect(milestoneSet.has(key)).toBe(false);
  });
});

describe('the within-norm band is generous (typical plus or minus fifty percent, minimum two weeks)', () => {
  // The rule recomputed independently of the implementation, so this is a real
  // check, not a mirror: half is fifty percent of the typical rounded to whole
  // weeks, floored at two weeks; the band is the typical plus or minus that.
  const expectedBand = (t) => {
    const half = Math.max(Math.round(t * 0.5), 2);
    return { min: t - half, max: t + half };
  };

  it('matches the rule for every activity', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const a of stage.activities) {
        expect(a.withinNormWeeks).toEqual(expectedBand(a.typicalWeeks));
        // The exported helper agrees with the stored value.
        expect(a.withinNormWeeks).toEqual(withinNormBand(a.typicalWeeks));
      }
    }
  });

  it('floors the band at plus or minus two weeks for a short activity', () => {
    // 1a, three weeks: fifty percent is 1.5, but the band floors at two.
    expect(activityOf(stageOf(1), '1a_brief_feasibility').withinNormWeeks).toEqual({
      min: 1,
      max: 5,
    });
  });

  it('scales the band with the typical for a long activity', () => {
    // 5b, twenty-four weeks: fifty percent is twelve.
    expect(activityOf(stageOf(5), '5b_superstructure').withinNormWeeks).toEqual({
      min: 12,
      max: 36,
    });
  });
});

describe('the existing milestones are re-homed onto activities, unedited', () => {
  it('places each named milestone under the activity Section 6 assigns it', () => {
    const home = (stage, activityKey, milestoneName) => {
      const a = activityOf(stageOf(stage), activityKey);
      expect(a.milestones.map((m) => m.name)).toContain(milestoneName);
    };
    home(0, '0a_site_search', 'Heads of terms agreed');
    home(1, '1b_funding_secured', 'Development finance committed');
    home(2, '2b_appointment_mobilisation', 'Lead consultant appointed');
    home(3, '3b_planning_approvals', 'Planning application validated');
    home(4, '4a_tender', 'Tenders returned');
    home(5, '5b_superstructure', 'Superstructure complete');
    home(5, '5c_fitout_finishing', 'Finishing complete');
    home(6, '6a_completion_certification', 'Building Regulations completion certificate issued');
    home(7, '7a_marketing_sales', 'First unit exchanged');
  });

  it('leaves only the four closing activities bare (they are tracked by their gate)', () => {
    // The four mid-stage activities 1a, 2a, 3a and 5a now carry a drill-down
    // completion milestone (see the drill-down describe below); only the four
    // closing activities stay bare, each closed by its stage gate under the
    // percent-complete rule, so they register progress without a milestone.
    const empty = [
      [0, '0b_legal_completion'],
      [4, '4b_evaluation_award'],
      [6, '6b_handover_defects'],
      [7, '7b_completions_disposal'],
    ];
    for (const [stage, key] of empty) {
      expect(activityOf(stageOf(stage), key).milestones).toEqual([]);
    }
  });

  it('keeps each milestone key, name, served objective and offset intact', () => {
    expect(milestoneOf(stageOf(0), 'Heads of terms agreed')).toMatchObject({
      key: 'heads_of_terms',
      serves: 'cost',
      offsetWeeks: 6,
    });
    expect(milestoneOf(stageOf(3), 'Planning application validated')).toMatchObject({
      key: 'planning_validated',
      serves: 'time',
      offsetWeeks: 14,
    });
    expect(milestoneOf(stageOf(5), 'Superstructure complete')).toMatchObject({
      key: 'superstructure',
      serves: 'time',
      offsetWeeks: 26,
    });
    expect(milestoneOf(stageOf(5), 'Finishing complete')).toMatchObject({
      key: 'finishing',
      serves: 'quality',
      offsetWeeks: 44,
    });
  });
});

describe('the four drill-down milestones (Programme module drill-down step)', () => {
  // One completion milestone on each of the four mid-stage activities that could
  // not otherwise register progress under the percent-complete rule. Each sits at
  // its activity end: the stage-relative offset equals the activity's own typical
  // duration, because each is the first activity in its stage. They serve,
  // respectively, Scope, Scope, Quality and Time.
  //   [stage, activityKey, key, name, serves, offsetWeeks]
  const DRILLDOWNS = [
    [1, '1a_brief_feasibility', 'feasibility_confirmed', 'Brief and feasibility confirmed', 'scope', 3],
    [2, '2a_scope_selection', 'consultant_scope_agreed', 'Consultant scope agreed', 'scope', 4],
    [3, '3a_design_development', 'developed_design_complete', 'Developed design complete', 'quality', 8],
    [5, '5a_substructure', 'substructure_complete', 'Substructure complete', 'time', 12],
  ];

  // The raw activity milestones, including the drill-downs stageMilestones filters
  // out, so the four can be inspected directly on the template.
  const rawMilestonesOf = (stage, activityKey) =>
    activityOf(stageOf(stage), activityKey).milestones;

  it('places one drill-down on each of 1a, 2a, 3a and 5a, with the right key, name, served objective and offset', () => {
    for (const [stage, activityKey, key, name, serves, offsetWeeks] of DRILLDOWNS) {
      const ms = rawMilestonesOf(stage, activityKey);
      expect(ms).toHaveLength(1);
      expect(ms[0]).toMatchObject({ key, name, serves, offsetWeeks });
    }
  });

  it('serves Scope, Scope, Quality and Time respectively, by the kernel identifier', () => {
    expect(DRILLDOWNS.map(([, , , , serves]) => serves)).toEqual([
      'scope',
      'scope',
      'quality',
      'time',
    ]);
  });

  it('tags the four as drill-down and the nine the one-level template held as headline', () => {
    const drilldownKeys = new Set(DRILLDOWNS.map(([, , key]) => key));
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const a of stage.activities) {
        for (const m of a.milestones) {
          const expected = drilldownKeys.has(m.key)
            ? MILESTONE_TIER.DRILLDOWN
            : MILESTONE_TIER.HEADLINE;
          expect(m.tier).toBe(expected);
        }
      }
    }
  });

  it("sets each offset to its activity's own typical duration, so it sits at the activity end", () => {
    for (const [stage, activityKey, , , , offsetWeeks] of DRILLDOWNS) {
      expect(offsetWeeks).toBe(activityOf(stageOf(stage), activityKey).typicalWeeks);
    }
  });

  it('keeps all thirteen milestone keys unique and distinct from every activity key', () => {
    const allMilestoneKeys = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
      s.activities.flatMap((a) => a.milestones.map((m) => m.key))
    );
    expect(allMilestoneKeys).toHaveLength(13);
    expect(new Set(allMilestoneKeys).size).toBe(13);
    const activityKeys = new Set(
      PROGRAMME_TEMPLATE.stages.flatMap((s) => s.activities.map((a) => a.key))
    );
    for (const key of allMilestoneKeys) expect(activityKeys.has(key)).toBe(false);
  });

  it('excludes the drill-downs from stageMilestones (the developer-facing headline list)', () => {
    const headlineKeys = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
      stageMilestones(s).map((m) => m.key)
    );
    expect(headlineKeys).toHaveLength(9);
    for (const [, , key] of DRILLDOWNS) {
      expect(headlineKeys).not.toContain(key);
    }
    // Everything stageMilestones returns is a headline milestone.
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const m of stageMilestones(stage)) {
        expect(m.tier).not.toBe(MILESTONE_TIER.DRILLDOWN);
      }
    }
  });

  it('exports the MILESTONE_TIER vocabulary, frozen', () => {
    expect(MILESTONE_TIER).toEqual({ HEADLINE: 'headline', DRILLDOWN: 'drilldown' });
    expect(Object.isFrozen(MILESTONE_TIER)).toBe(true);
  });
});

describe('stageMilestones flattens the activities into one ordered list', () => {
  it('walks activity order then milestone order, preserving the one-level order', () => {
    // Construction is the telling case: 5a has none, 5b then 5c each one.
    expect(stageMilestones(stageOf(5)).map((m) => m.name)).toEqual([
      'Superstructure complete',
      'Finishing complete',
    ]);
  });

  it('holds the same nine milestones the one-level template held, in stage order', () => {
    const all = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
      stageMilestones(s).map((m) => m.key)
    );
    expect(all).toEqual([
      'heads_of_terms',
      'finance_committed',
      'lead_consultant',
      'planning_validated',
      'tenders_returned',
      'superstructure',
      'finishing',
      'completion_certificate',
      'first_exchange',
    ]);
  });

  it('reads a legacy one-level stage shape too (flat milestones, no activities)', () => {
    const legacy = { stage: 9, milestones: [{ key: 'x', name: 'X' }] };
    expect(stageMilestones(legacy)).toEqual([{ key: 'x', name: 'X' }]);
    expect(stageMilestones({ stage: 9 })).toEqual([]);
  });
});

describe('milestones serve the framework objectives', () => {
  it('every milestone serves one of the five objectives, with a numeric offset', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const milestone of stageMilestones(stage)) {
        expect(SERVED_VALUES).toContain(milestone.serves);
        expect(typeof milestone.offsetWeeks).toBe('number');
      }
    }
  });

  it('encodes each named milestone against the objective it serves, by the kernel identifier', () => {
    expect(milestoneOf(stageOf(0), 'Heads of terms agreed').serves).toBe('cost');
    expect(milestoneOf(stageOf(1), 'Development finance committed').serves).toBe(
      'funding'
    );
    expect(milestoneOf(stageOf(2), 'Lead consultant appointed').serves).toBe(
      'quality'
    );
    expect(milestoneOf(stageOf(3), 'Planning application validated').serves).toBe(
      'time'
    );
    expect(milestoneOf(stageOf(4), 'Tenders returned').serves).toBe('cost');
    expect(
      milestoneOf(
        stageOf(6),
        'Building Regulations completion certificate issued'
      ).serves
    ).toBe('quality');
    expect(milestoneOf(stageOf(7), 'First unit exchanged').serves).toBe('funding');
  });

  it('gives Construction (stage 5) its two milestones', () => {
    const construction = stageOf(5);
    expect(stageMilestones(construction).map((m) => m.name)).toEqual([
      'Superstructure complete',
      'Finishing complete',
    ]);
    expect(milestoneOf(construction, 'Superstructure complete').serves).toBe(
      'time'
    );
    expect(milestoneOf(construction, 'Finishing complete').serves).toBe('quality');
  });
});

describe('location-sensitive checkpoints are flags only', () => {
  it('carry a non-empty label and prompt and no numeric value', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const point of stage.locationSensitive) {
        expect(typeof point.label).toBe('string');
        expect(point.label.length).toBeGreaterThan(0);
        expect(typeof point.prompt).toBe('string');
        expect(point.prompt.length).toBeGreaterThan(0);
        // A checkpoint asserts no duration: nothing on it is a number, and it
        // carries exactly a label and a prompt.
        expect(Object.values(point).some((v) => typeof v === 'number')).toBe(
          false
        );
        expect(Object.keys(point).sort()).toEqual(['label', 'prompt']);
      }
    }
  });

  it('flags the location-sensitive stages and leaves the others clear', () => {
    const flagged = PROGRAMME_TEMPLATE.stages
      .filter((s) => s.locationSensitive.length > 0)
      .map((s) => s.stage);
    expect(flagged).toEqual([3, 4, 5, 6]);
    for (const n of [0, 1, 2, 7]) {
      expect(stageOf(n).locationSensitive).toEqual([]);
    }
  });
});

describe('the gate-timing divergence is held for later reconciliation, not papered over', () => {
  // The summed activity span per stage on the first-draft durations. The target
  // model puts the gate at the end of the final activity, so this is what the
  // gate would reconcile to. It is held as a derived figure here, not wired into
  // the gate position, so the locked Brief stays byte-stable.
  const EXPECTED_ACTIVITY_WEEKS = { 0: 20, 1: 9, 2: 8, 3: 20, 4: 12, 5: 54, 6: 10, 7: 32 };

  it('sums each stage activity span from its activities', () => {
    for (const [stage, weeks] of Object.entries(EXPECTED_ACTIVITY_WEEKS)) {
      expect(stageActivityWeeks(stageOf(Number(stage)))).toBe(weeks);
    }
  });

  it('diverges from the shipped gateWeeks for every stage but stage 4', () => {
    const diverging = PROGRAMME_TEMPLATE.stages
      .filter((s) => stageActivityWeeks(s) !== s.gateWeeks)
      .map((s) => s.stage);
    expect(diverging).toEqual([0, 1, 2, 3, 5, 6, 7]);
    // Stage 4 is the one that already agrees (12 weeks either way).
    expect(stageActivityWeeks(stageOf(4))).toBe(stageOf(4).gateWeeks);
  });
});

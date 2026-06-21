import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE, PROGRAMME_TEMPLATE_VERSION } from '../lib/engine/programmeTemplate.js';
import {
  deriveAdvisedDates,
  deriveRollingGateDates,
} from '../lib/engine/programmeSchedule.js';

/**
 * Programme schedule derivation (Step 7, sub-step 1a). Proves the cumulative
 * gate chain, the milestone offsets measured from each stage start, the two
 * Construction milestones, N/A stages skipped and carried forward, and that the
 * derivation is pure and deterministic. A fixed UTC anchor keeps every
 * assertion independent of the test runner's timezone, and distances are
 * checked in whole weeks from that anchor rather than hand-computed calendar
 * dates.
 */

const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const weeksFromStart = (date) => (date.getTime() - START.getTime()) / MS_PER_WEEK;

const stageOf = (result, n) => result.stages.find((s) => s.stage === n);
const milestoneOf = (stage, name) =>
  stage.milestones.find((m) => m.name === name);

describe('cumulative gate chain', () => {
  const result = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);

  it('starts stage 0 at the project start', () => {
    expect(stageOf(result, 0).stageStart.getTime()).toBe(START.getTime());
    expect(result.projectStart.getTime()).toBe(START.getTime());
  });

  it('runs each gate as the running sum of gate durations', () => {
    const expected = { 0: 12, 1: 20, 2: 26, 3: 56, 4: 68, 5: 120, 6: 126, 7: 146 };
    for (const [stage, weeks] of Object.entries(expected)) {
      expect(
        weeksFromStart(stageOf(result, Number(stage)).gateAdvisedDate)
      ).toBe(weeks);
    }
  });

  it('starts each stage at the previous stage gate advised date', () => {
    for (let n = 1; n <= 7; n += 1) {
      expect(stageOf(result, n).stageStart.getTime()).toBe(
        stageOf(result, n - 1).gateAdvisedDate.getTime()
      );
    }
  });

  it('returns midnight UTC instants, so nothing drifts across a daylight-saving boundary', () => {
    for (const stage of result.stages) {
      expect(stage.gateAdvisedDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
      for (const milestone of stage.milestones) {
        expect(milestone.advisedDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
      }
    }
  });

  it('echoes the template version', () => {
    expect(result.version).toBe(PROGRAMME_TEMPLATE_VERSION);
  });
});

describe('milestone offsets', () => {
  const result = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);

  it('places each milestone at its stage start plus the offset', () => {
    const expected = [
      [0, 'Heads of terms agreed', 6],
      [1, 'Development finance committed', 18],
      [2, 'Lead consultant appointed', 24],
      [3, 'Planning application validated', 40],
      [4, 'Tenders returned', 64],
      [6, 'Building Regulations completion certificate issued', 124],
      [7, 'First unit exchanged', 134],
    ];
    for (const [stage, name, weeks] of expected) {
      const milestone = milestoneOf(stageOf(result, stage), name);
      expect(weeksFromStart(milestone.advisedDate)).toBe(weeks);
    }
  });

  it('measures the offset from the stage start, not the project start', () => {
    const stage3 = stageOf(result, 3);
    const milestone = milestoneOf(stage3, 'Planning application validated');
    const offsetWeeks =
      (milestone.advisedDate.getTime() - stage3.stageStart.getTime()) /
      MS_PER_WEEK;
    expect(offsetWeeks).toBe(14);
  });
});

describe('the two Construction milestones (stage 5)', () => {
  const result = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
  const stage5 = stageOf(result, 5);

  it('derives both milestones from the one stage 5 start', () => {
    expect(stage5.milestones).toHaveLength(2);
    expect(weeksFromStart(stage5.stageStart)).toBe(68);
  });

  it('places Superstructure complete at the stage start plus 26 weeks, serving Time', () => {
    const milestone = milestoneOf(stage5, 'Superstructure complete');
    expect(milestone.serves).toBe('time');
    expect(weeksFromStart(milestone.advisedDate)).toBe(94);
  });

  it('places Finishing complete at the stage start plus 44 weeks, serving Quality', () => {
    const milestone = milestoneOf(stage5, 'Finishing complete');
    expect(milestone.serves).toBe('quality');
    expect(weeksFromStart(milestone.advisedDate)).toBe(112);
  });
});

describe('N/A stages skipped and carried forward', () => {
  const result = deriveAdvisedDates(START, PROGRAMME_TEMPLATE, [1, 4]);

  it('marks the skipped stages not applicable with no advised dates', () => {
    for (const n of [1, 4]) {
      const stage = stageOf(result, n);
      expect(stage.applicable).toBe(false);
      expect(stage.stageStart).toBeNull();
      expect(stage.gateAdvisedDate).toBeNull();
      expect(stage.milestones).toEqual([]);
    }
  });

  it('carries the running gate date forward across a skipped stage', () => {
    // Stage 1 is skipped, so stage 2 starts where stage 0 gate left off (week 12).
    expect(stageOf(result, 2).stageStart.getTime()).toBe(
      stageOf(result, 0).gateAdvisedDate.getTime()
    );
    expect(weeksFromStart(stageOf(result, 2).stageStart)).toBe(12);
  });

  it('drops the skipped gate durations from the rest of the chain', () => {
    // 0:12, [1 skipped], 2:12+6=18, 3:18+30=48, [4 skipped], 5:48+52=100,
    // 6:100+6=106, 7:106+20=126.
    const expected = { 0: 12, 2: 18, 3: 48, 5: 100, 6: 106, 7: 126 };
    for (const [stage, weeks] of Object.entries(expected)) {
      expect(
        weeksFromStart(stageOf(result, Number(stage)).gateAdvisedDate)
      ).toBe(weeks);
    }
  });

  it('recomputes the stage 5 milestones from the carried-forward start', () => {
    const stage5 = stageOf(result, 5);
    expect(weeksFromStart(stage5.stageStart)).toBe(48);
    expect(
      weeksFromStart(milestoneOf(stage5, 'Superstructure complete').advisedDate)
    ).toBe(74);
    expect(
      weeksFromStart(milestoneOf(stage5, 'Finishing complete').advisedDate)
    ).toBe(92);
  });

  it('accepts the N/A stages as a Set as well as an array', () => {
    const viaSet = deriveAdvisedDates(START, PROGRAMME_TEMPLATE, new Set([1, 4]));
    expect(weeksFromStart(stageOf(viaSet, 5).gateAdvisedDate)).toBe(100);
  });
});

describe('pure and deterministic', () => {
  it('gives identical dates on repeated calls', () => {
    const a = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    const b = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(a, n).gateAdvisedDate.getTime()).toBe(
        stageOf(b, n).gateAdvisedDate.getTime()
      );
    }
  });

  it('does not mutate the template', () => {
    deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    // The derivation writes advisedDate onto its own output, never the template.
    expect(PROGRAMME_TEMPLATE.stages[0].milestones[0].advisedDate).toBeUndefined();
    expect(PROGRAMME_TEMPLATE.stages[0].stageStart).toBeUndefined();
  });

  it('parses a plain ISO date string start as UTC', () => {
    const result = deriveAdvisedDates('2026-01-05', PROGRAMME_TEMPLATE);
    expect(result.stages[0].stageStart.toISOString()).toBe(
      '2026-01-05T00:00:00.000Z'
    );
  });
});

/**
 * Rolling advised gate dates (Step 7, sub-step 1c). Proves the gate-by-gate
 * rule: gate 0 anchors on the project start, each later gate anchors on the
 * previous applicable gate's effective date (its chosen date if set, otherwise
 * its own advised date), an override shifts only the gates after it, an N/A gate
 * is skipped with the anchor carried forward, and with no overrides the result
 * equals deriveAdvisedDates gate for gate. Plus the no-start-date case, where an
 * undated gate advises nothing until a chosen date seeds the chain.
 */

// An ISO date input value (YYYY-MM-DD) for a UTC date, as the date input gives.
const iso = (date) => date.toISOString().slice(0, 10);

// A date a whole number of weeks after the fixed anchor, in UTC.
const weeksAfterStart = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);

// The empty per-gate choices: one entry per template stage, nothing chosen.
const emptyGates = () =>
  PROGRAMME_TEMPLATE.stages.map((s) => ({
    stage: s.stage,
    target_date: '',
    target_na: false,
  }));

describe('rolling advised gate dates: anchoring', () => {
  it('advises gate 0 at the project start plus its gate duration', () => {
    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    expect(weeksFromStart(stageOf(result, 0).advisedDate)).toBe(12);
    expect(result.projectStart.getTime()).toBe(START.getTime());
  });

  it('anchors a later gate on the previous gate chosen date, not its advised date', () => {
    const gates = emptyGates();
    // Choose gate 0 at week 20 from the start, later than its advised week 12.
    const chosen0 = weeksAfterStart(20);
    gates[0].target_date = iso(chosen0);

    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, gates);
    const gate0 = stageOf(result, 0);

    // Gate 0's own advised date still anchors on the project start (week 12),
    // independent of the date the developer chose for it.
    expect(weeksFromStart(gate0.advisedDate)).toBe(12);
    expect(gate0.chosenDate.getTime()).toBe(chosen0.getTime());
    // The effective date carried forward is the chosen date, not the advised.
    expect(gate0.effectiveDate.getTime()).toBe(chosen0.getTime());
    // Gate 1 rolls from the chosen gate 0 date plus stage 1's 8 weeks: week 28.
    expect(weeksFromStart(stageOf(result, 1).advisedDate)).toBe(28);
  });

  it('returns midnight UTC instants for every advised date', () => {
    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    for (const stage of result.stages) {
      expect(stage.advisedDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
  });

  it('echoes the template version', () => {
    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    expect(result.version).toBe(PROGRAMME_TEMPLATE_VERSION);
  });
});

describe('rolling advised gate dates: an override shifts only later gates', () => {
  const base = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());

  it('leaves the overridden gate and the gates before it on their advised dates', () => {
    const gates = emptyGates();
    // Push gate 2 four weeks past its advised date.
    const advised2 = stageOf(base, 2).advisedDate;
    gates[2].target_date = iso(new Date(advised2.getTime() + 4 * MS_PER_WEEK));

    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, gates);
    // Gate 2's own advised date is unchanged: it still anchors on gate 1's
    // effective date, which the override does not touch.
    for (const n of [0, 1, 2]) {
      expect(stageOf(result, n).advisedDate.getTime()).toBe(
        stageOf(base, n).advisedDate.getTime()
      );
    }
  });

  it('shifts every gate after the override by the same amount', () => {
    const gates = emptyGates();
    const advised2 = stageOf(base, 2).advisedDate;
    gates[2].target_date = iso(new Date(advised2.getTime() + 4 * MS_PER_WEEK));

    const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, gates);
    for (const n of [3, 4, 5, 6, 7]) {
      const deltaWeeks =
        (stageOf(result, n).advisedDate.getTime() -
          stageOf(base, n).advisedDate.getTime()) /
        MS_PER_WEEK;
      expect(deltaWeeks).toBe(4);
    }
  });
});

describe('rolling advised gate dates: an N/A gate is skipped', () => {
  const gates = emptyGates();
  gates[1].target_na = true; // stage 1 not applicable
  const result = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, gates);

  it('marks the skipped gate not applicable with no advised date', () => {
    const stage1 = stageOf(result, 1);
    expect(stage1.applicable).toBe(false);
    expect(stage1.advisedDate).toBeNull();
    expect(stage1.chosenDate).toBeNull();
    expect(stage1.effectiveDate).toBeNull();
  });

  it('carries the anchor forward, not adding the skipped gate duration', () => {
    // Stage 0 stays at week 12; stage 2 rolls from there plus stage 2's 6
    // weeks, stage 1's 8 weeks not added: week 18.
    expect(weeksFromStart(stageOf(result, 0).advisedDate)).toBe(12);
    expect(weeksFromStart(stageOf(result, 2).advisedDate)).toBe(18);
  });
});

describe('rolling advised gate dates: equals deriveAdvisedDates with no overrides', () => {
  it('matches gate for gate when the choices are empty', () => {
    const rolling = deriveRollingGateDates(
      START,
      PROGRAMME_TEMPLATE,
      emptyGates()
    );
    const derived = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(rolling, n).advisedDate.getTime()).toBe(
        stageOf(derived, n).gateAdvisedDate.getTime()
      );
    }
  });

  it('matches gate for gate when no choices are supplied at all', () => {
    const rolling = deriveRollingGateDates(START, PROGRAMME_TEMPLATE);
    const derived = deriveAdvisedDates(START, PROGRAMME_TEMPLATE);
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(rolling, n).advisedDate.getTime()).toBe(
        stageOf(derived, n).gateAdvisedDate.getTime()
      );
    }
  });

  it('still matches across an N/A stage, with both sides skipping it', () => {
    const gates = emptyGates();
    gates[4].target_na = true;
    const rolling = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, gates);
    const derived = deriveAdvisedDates(START, PROGRAMME_TEMPLATE, [4]);
    for (const n of [0, 1, 2, 3, 5, 6, 7]) {
      expect(stageOf(rolling, n).advisedDate.getTime()).toBe(
        stageOf(derived, n).gateAdvisedDate.getTime()
      );
    }
    expect(stageOf(rolling, 4).advisedDate).toBeNull();
    expect(stageOf(derived, 4).gateAdvisedDate).toBeNull();
  });
});

describe('rolling advised gate dates: without a project start date', () => {
  it('advises nothing for undated gates while no anchor is held', () => {
    const result = deriveRollingGateDates('', PROGRAMME_TEMPLATE, emptyGates());
    expect(result.projectStart).toBeNull();
    expect(stageOf(result, 0).advisedDate).toBeNull();
    expect(stageOf(result, 1).advisedDate).toBeNull();
  });

  it('rolls later gates from a manually entered gate 0 date', () => {
    const gates = emptyGates();
    const chosen0 = new Date(Date.UTC(2026, 2, 2)); // 2026-03-02
    gates[0].target_date = iso(chosen0);

    const result = deriveRollingGateDates('', PROGRAMME_TEMPLATE, gates);
    // Gate 0 still has no advised date (no anchor), but its chosen date seeds
    // the chain: gate 1 advises that date plus stage 1's 8 weeks.
    expect(stageOf(result, 0).advisedDate).toBeNull();
    const weeksFromChosen0 =
      (stageOf(result, 1).advisedDate.getTime() - chosen0.getTime()) /
      MS_PER_WEEK;
    expect(weeksFromChosen0).toBe(8);
  });
});

describe('rolling advised gate dates: pure and forgiving of input shape', () => {
  it('accepts the choices as a plain array as well as the { stages } object', () => {
    const arr = emptyGates();
    const viaArray = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, arr);
    const viaObject = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, {
      stages: arr,
    });
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(viaArray, n).advisedDate.getTime()).toBe(
        stageOf(viaObject, n).advisedDate.getTime()
      );
    }
  });

  it('does not mutate the template', () => {
    deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    expect(PROGRAMME_TEMPLATE.stages[0].advisedDate).toBeUndefined();
    expect(PROGRAMME_TEMPLATE.stages[0].milestones[0].advisedDate).toBeUndefined();
  });

  it('gives identical dates on repeated calls', () => {
    const a = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    const b = deriveRollingGateDates(START, PROGRAMME_TEMPLATE, emptyGates());
    for (let n = 0; n <= 7; n += 1) {
      expect(stageOf(a, n).advisedDate.getTime()).toBe(
        stageOf(b, n).advisedDate.getTime()
      );
    }
  });
});

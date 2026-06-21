import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE, PROGRAMME_TEMPLATE_VERSION } from '../lib/engine/programmeTemplate.js';
import { deriveAdvisedDates } from '../lib/engine/programmeSchedule.js';

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
    expect(milestone.serves).toBe('Time');
    expect(weeksFromStart(milestone.advisedDate)).toBe(94);
  });

  it('places Finishing complete at the stage start plus 44 weeks, serving Quality', () => {
    const milestone = milestoneOf(stage5, 'Finishing complete');
    expect(milestone.serves).toBe('Quality');
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

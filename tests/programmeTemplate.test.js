import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  PROGRAMME_TEMPLATE_VERSION,
  SERVED_OBJECTIVES,
} from '../lib/engine/programmeTemplate.js';

/**
 * The curated programme template (Step 7, sub-step 1a). Proves the template is
 * versioned, marked as curated estimates, covers the eight lifecycle stages,
 * serves only the five framework objectives, and that its location-sensitive
 * checkpoints are flags only: a label and a prompt, never a numeric value.
 */

const SERVED_VALUES = Object.values(SERVED_OBJECTIVES);
const stageOf = (n) => PROGRAMME_TEMPLATE.stages.find((s) => s.stage === n);
const milestoneOf = (stage, name) =>
  stage.milestones.find((m) => m.name === name);

describe('PROGRAMME_TEMPLATE shape', () => {
  it('is versioned and marks its durations as curated estimates in weeks', () => {
    expect(PROGRAMME_TEMPLATE.version).toBe(PROGRAMME_TEMPLATE_VERSION);
    expect(PROGRAMME_TEMPLATE.version).toBeTruthy();
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
      expect(stage.milestones.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('is read-only (deep frozen) so the derivation cannot mutate it', () => {
    expect(Object.isFrozen(PROGRAMME_TEMPLATE)).toBe(true);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE.stages)).toBe(true);
    expect(Object.isFrozen(PROGRAMME_TEMPLATE.stages[0].milestones[0])).toBe(true);
  });
});

describe('milestones serve the framework objectives', () => {
  it('every milestone serves one of the five objectives, with a numeric offset', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const milestone of stage.milestones) {
        expect(SERVED_VALUES).toContain(milestone.serves);
        expect(typeof milestone.offsetWeeks).toBe('number');
      }
    }
  });

  it('encodes each named milestone against the objective it serves, by the kernel identifier', () => {
    expect(milestoneOf(stageOf(0), 'Heads of terms agreed').serves).toBe('cost');
    expect(
      milestoneOf(stageOf(1), 'Development finance committed').serves
    ).toBe('funding');
    expect(milestoneOf(stageOf(2), 'Lead consultant appointed').serves).toBe(
      'quality'
    );
    expect(
      milestoneOf(stageOf(3), 'Planning application validated').serves
    ).toBe('time');
    expect(milestoneOf(stageOf(4), 'Tenders returned').serves).toBe('cost');
    expect(
      milestoneOf(stageOf(6), 'Building Regulations completion certificate issued')
        .serves
    ).toBe('quality');
    expect(milestoneOf(stageOf(7), 'First unit exchanged').serves).toBe(
      'funding'
    );
  });

  it('gives Construction (stage 5) its two milestones', () => {
    const construction = stageOf(5);
    expect(construction.milestones.map((m) => m.name)).toEqual([
      'Superstructure complete',
      'Finishing complete',
    ]);
    expect(milestoneOf(construction, 'Superstructure complete').serves).toBe(
      'time'
    );
    expect(milestoneOf(construction, 'Finishing complete').serves).toBe(
      'quality'
    );
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

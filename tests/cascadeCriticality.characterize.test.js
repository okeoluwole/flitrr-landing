import { describe, it, expect } from 'vitest';
import { cascadeCriticality } from '../app/pulse/app/components/listStepConfig.js';

/**
 * Characterization net (A1) for the write-time cascade, captured at its current
 * home in listStepConfig before Step A4 re-expresses it through the kernel's
 * toStoredCriticality. The cascade stamps the stored criticality_level snapshot
 * when the wizard and the Action Log create an item, so an unlinked item stores
 * 'standard' (the column has no 'unlinked' value). These assertions pin that.
 */

// The wizard's live objective state: an array of rows, one non-negotiable and
// one flexible. cascadeCriticality resolves an item's link against this array.
const OBJECTIVES = [
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
];

describe('cascadeCriticality stamps the stored snapshot', () => {
  it('is critical for a link to a non-negotiable objective', () => {
    expect(cascadeCriticality('obj-cost', OBJECTIVES)).toBe('critical');
  });

  it('is standard for a link to a flexible objective', () => {
    expect(cascadeCriticality('obj-time', OBJECTIVES)).toBe('standard');
  });

  it('is standard with no link', () => {
    expect(cascadeCriticality('', OBJECTIVES)).toBe('standard');
    expect(cascadeCriticality(null, OBJECTIVES)).toBe('standard');
    expect(cascadeCriticality(undefined, OBJECTIVES)).toBe('standard');
  });

  it('is standard when the link does not resolve', () => {
    expect(cascadeCriticality('obj-gone', OBJECTIVES)).toBe('standard');
  });

  it('is standard when there are no objectives to resolve against', () => {
    expect(cascadeCriticality('obj-cost', [])).toBe('standard');
    expect(cascadeCriticality('obj-cost', undefined)).toBe('standard');
  });
});

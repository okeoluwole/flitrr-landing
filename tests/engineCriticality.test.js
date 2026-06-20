import { describe, it, expect } from 'vitest';
import {
  CRITICALITY,
  CRITICALITY_RANK,
  buildObjectiveIndex,
  deriveCriticality,
  applyDownwardOverride,
  effectiveCriticality,
  toStoredCriticality,
  classifyByType,
} from '../lib/engine/criticality.js';

/**
 * The criticality kernel (A2). Proves the single live derivation, the
 * downward-only override, the write-time stamp, the by-type playbook
 * derivation, the one objective-index builder, and the shared constants. These
 * are the behaviours the later steps route the modules onto, so the assertions
 * here are the contract the migrations must preserve.
 */

// A project posture: Cost and Quality non-negotiable, the rest flexible.
const OBJECTIVE_ROWS = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'non_negotiable' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
];

const NAME_BY_TYPE = {
  scope: 'Scope',
  cost: 'Cost',
  time: 'Time',
  quality: 'Quality',
  funding: 'Funding',
};

describe('buildObjectiveIndex', () => {
  it('indexes the same entry by id and by type, with the name resolved', () => {
    const { byId, byType } = buildObjectiveIndex(OBJECTIVE_ROWS, NAME_BY_TYPE);
    expect(byId['obj-cost']).toEqual({
      id: 'obj-cost',
      type: 'cost',
      classification: 'non_negotiable',
      name: 'Cost',
    });
    // The id entry and the type entry are the very same object.
    expect(byType.cost).toBe(byId['obj-cost']);
  });

  it('leaves the name null when no nameByType is supplied', () => {
    const { byId } = buildObjectiveIndex(OBJECTIVE_ROWS);
    expect(byId['obj-cost'].name).toBeNull();
  });

  it('skips rows without an id and tolerates an empty or nullish input', () => {
    const { byId, byType } = buildObjectiveIndex([
      { objective_type: 'cost', classification: 'non_negotiable' },
      null,
    ]);
    expect(byId).toEqual({});
    expect(byType).toEqual({});
    expect(buildObjectiveIndex(undefined)).toEqual({ byId: {}, byType: {} });
  });
});

describe('deriveCriticality reads the linked objective live', () => {
  const { byId } = buildObjectiveIndex(OBJECTIVE_ROWS);

  it('is critical when the linked objective is non-negotiable', () => {
    expect(deriveCriticality('obj-cost', byId)).toBe(CRITICALITY.CRITICAL);
  });

  it('is standard when the linked objective is flexible', () => {
    expect(deriveCriticality('obj-time', byId)).toBe(CRITICALITY.STANDARD);
  });

  it('is unlinked with no link', () => {
    expect(deriveCriticality(null, byId)).toBe(CRITICALITY.UNLINKED);
    expect(deriveCriticality(undefined, byId)).toBe(CRITICALITY.UNLINKED);
    expect(deriveCriticality('', byId)).toBe(CRITICALITY.UNLINKED);
  });

  it('is unlinked when the link does not resolve', () => {
    expect(deriveCriticality('obj-gone', byId)).toBe(CRITICALITY.UNLINKED);
    expect(deriveCriticality('obj-cost', undefined)).toBe(CRITICALITY.UNLINKED);
  });
});

describe('the downward-only override', () => {
  const { byId } = buildObjectiveIndex(OBJECTIVE_ROWS);

  it('lowers a derived-critical value to standard', () => {
    expect(applyDownwardOverride(CRITICALITY.CRITICAL, 'standard')).toBe(
      CRITICALITY.STANDARD
    );
    expect(effectiveCriticality('obj-cost', byId, 'standard')).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('never raises a derived-standard value (a critical override is inert)', () => {
    expect(applyDownwardOverride(CRITICALITY.STANDARD, 'critical')).toBe(
      CRITICALITY.STANDARD
    );
    expect(effectiveCriticality('obj-time', byId, 'critical')).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('never lifts an unlinked value', () => {
    expect(effectiveCriticality(null, byId, 'critical')).toBe(
      CRITICALITY.UNLINKED
    );
  });

  it('falls inert when the derivation is no longer critical', () => {
    // A standard override left on an item whose link moved to a flexible
    // objective: the value follows the derivation, not the stale override.
    expect(effectiveCriticality('obj-time', byId, 'standard')).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('returns the derivation unchanged when there is no override', () => {
    expect(effectiveCriticality('obj-cost', byId, null)).toBe(
      CRITICALITY.CRITICAL
    );
    expect(effectiveCriticality('obj-cost', byId, undefined)).toBe(
      CRITICALITY.CRITICAL
    );
  });
});

describe('toStoredCriticality collapses to the binary enum', () => {
  const { byId } = buildObjectiveIndex(OBJECTIVE_ROWS);

  it('stores critical for a non-negotiable link', () => {
    expect(toStoredCriticality('obj-cost', byId)).toBe(CRITICALITY.CRITICAL);
  });

  it('stores standard for a flexible link', () => {
    expect(toStoredCriticality('obj-time', byId)).toBe(CRITICALITY.STANDARD);
  });

  it('stores standard for no link or an unresolved link (never unlinked)', () => {
    expect(toStoredCriticality(null, byId)).toBe(CRITICALITY.STANDARD);
    expect(toStoredCriticality('obj-gone', byId)).toBe(CRITICALITY.STANDARD);
  });
});

describe('classifyByType derives a playbook play by objective_type', () => {
  const { byType } = buildObjectiveIndex(OBJECTIVE_ROWS);

  it('is critical when always_critical, whatever the classification', () => {
    expect(classifyByType('time', byType, { alwaysCritical: true })).toBe(
      CRITICALITY.CRITICAL
    );
    expect(classifyByType('missing', byType, { alwaysCritical: true })).toBe(
      CRITICALITY.CRITICAL
    );
  });

  it('is critical for a non-negotiable objective type', () => {
    expect(classifyByType('cost', byType)).toBe(CRITICALITY.CRITICAL);
  });

  it('is standard for a flexible objective type', () => {
    expect(classifyByType('time', byType)).toBe(CRITICALITY.STANDARD);
  });

  it('is standard for a type the project has no row for (never unlinked)', () => {
    expect(classifyByType('missing', byType)).toBe(CRITICALITY.STANDARD);
    expect(classifyByType(undefined, byType)).toBe(CRITICALITY.STANDARD);
  });
});

describe('the shared constants', () => {
  it('expose the three criticality values', () => {
    expect(CRITICALITY).toEqual({
      CRITICAL: 'critical',
      STANDARD: 'standard',
      UNLINKED: 'unlinked',
    });
  });

  it('rank critical above unlinked above standard', () => {
    expect(CRITICALITY_RANK[CRITICALITY.CRITICAL]).toBe(0);
    expect(CRITICALITY_RANK[CRITICALITY.UNLINKED]).toBe(1);
    expect(CRITICALITY_RANK[CRITICALITY.STANDARD]).toBe(2);
  });
});

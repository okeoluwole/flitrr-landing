import { describe, it, expect } from 'vitest';
import {
  CRITICALITY,
  objectivesById,
  derivedCriticality,
  hasDownwardOverride,
  effectiveCriticality,
  isCritical,
  isDone,
  sortActions,
} from '../app/pulse/app/actions/actionModel.js';

/**
 * Phase 2 A2: live criticality and the constrained, downward-only override.
 * Pure-logic coverage, the same discipline as the risk monitor truth table.
 */

// Two objectives to link against: one non-negotiable, one flexible.
const OBJECTIVES = [
  { id: 'obj-cost', name: 'Cost', classification: 'non_negotiable' },
  { id: 'obj-time', name: 'Time', classification: 'flexible' },
];
const byId = objectivesById(OBJECTIVES);

function action(overrides = {}) {
  return {
    id: 'a1',
    linked_objective_id: null,
    criticality: 'standard',
    criticality_override: null,
    override_reason: null,
    status: 'to_do',
    created_at: '2026-06-10T10:00:00+00:00',
    ...overrides,
  };
}

describe('derivedCriticality reads the linked objective live', () => {
  it('is critical when linked to a non-negotiable objective', () => {
    expect(
      derivedCriticality(action({ linked_objective_id: 'obj-cost' }), byId)
    ).toBe(CRITICALITY.CRITICAL);
  });

  it('is standard when linked to a flexible objective', () => {
    expect(
      derivedCriticality(action({ linked_objective_id: 'obj-time' }), byId)
    ).toBe(CRITICALITY.STANDARD);
  });

  it('is unlinked with no link', () => {
    expect(derivedCriticality(action(), byId)).toBe(CRITICALITY.UNLINKED);
  });

  it('is unlinked when the link does not resolve', () => {
    expect(
      derivedCriticality(action({ linked_objective_id: 'obj-gone' }), byId)
    ).toBe(CRITICALITY.UNLINKED);
  });

  it('ignores the stored snapshot column entirely', () => {
    // A stale snapshot of critical does not make an unlinked action critical.
    expect(derivedCriticality(action({ criticality: 'critical' }), byId)).toBe(
      CRITICALITY.UNLINKED
    );
  });
});

describe('the override is downward only', () => {
  it('lowers a derived-critical action to standard', () => {
    const a = action({
      linked_objective_id: 'obj-cost',
      criticality_override: 'standard',
      override_reason: 'Owner accepts the lower bar here',
    });
    expect(hasDownwardOverride(a, byId)).toBe(true);
    expect(effectiveCriticality(a, byId)).toBe(CRITICALITY.STANDARD);
  });

  it('never raises a derived-standard action (a critical override is inert)', () => {
    const a = action({
      linked_objective_id: 'obj-time',
      criticality_override: 'critical',
      override_reason: 'should be ignored',
    });
    expect(hasDownwardOverride(a, byId)).toBe(false);
    expect(effectiveCriticality(a, byId)).toBe(CRITICALITY.STANDARD);
  });

  it('never lifts an unlinked action', () => {
    const a = action({ criticality_override: 'critical' });
    expect(effectiveCriticality(a, byId)).toBe(CRITICALITY.UNLINKED);
  });

  it('falls inert when the link is no longer critical', () => {
    // Override set while critical, link later changed to a flexible objective:
    // the value follows the derivation (standard), not the stale override.
    const a = action({
      linked_objective_id: 'obj-time',
      criticality_override: 'standard',
      override_reason: 'set while it was critical',
    });
    expect(hasDownwardOverride(a, byId)).toBe(false);
    expect(effectiveCriticality(a, byId)).toBe(CRITICALITY.STANDARD);
  });

  it('keeps the derivation visible alongside an active override', () => {
    const a = action({
      linked_objective_id: 'obj-cost',
      criticality_override: 'standard',
      override_reason: 'reason',
    });
    expect(derivedCriticality(a, byId)).toBe(CRITICALITY.CRITICAL);
    expect(effectiveCriticality(a, byId)).toBe(CRITICALITY.STANDARD);
  });
});

describe('isCritical reads the effective value', () => {
  it('is true for derived critical with no override', () => {
    expect(isCritical(action({ linked_objective_id: 'obj-cost' }), byId)).toBe(
      true
    );
  });

  it('is false once reduced to standard', () => {
    expect(
      isCritical(
        action({
          linked_objective_id: 'obj-cost',
          criticality_override: 'standard',
          override_reason: 'reason',
        }),
        byId
      )
    ).toBe(false);
  });

  it('is false for unlinked (a governance gap, not a criticality)', () => {
    expect(isCritical(action(), byId)).toBe(false);
  });
});

describe('sortActions orders by live criticality band then recency', () => {
  it('critical, then unlinked, then standard; newest first within a band', () => {
    const actions = [
      action({
        id: 'std',
        linked_objective_id: 'obj-time',
        created_at: '2026-06-09T10:00:00+00:00',
      }),
      action({ id: 'unlinked', created_at: '2026-06-08T10:00:00+00:00' }),
      action({
        id: 'crit-old',
        linked_objective_id: 'obj-cost',
        created_at: '2026-06-01T10:00:00+00:00',
      }),
      action({
        id: 'crit-new',
        linked_objective_id: 'obj-cost',
        created_at: '2026-06-05T10:00:00+00:00',
      }),
      action({
        id: 'demoted',
        linked_objective_id: 'obj-cost',
        criticality_override: 'standard',
        override_reason: 'reason',
        created_at: '2026-06-12T10:00:00+00:00',
      }),
    ];
    // 'demoted' is newest but reads standard, so it sits in the standard band.
    expect(sortActions(actions, byId).map((a) => a.id)).toEqual([
      'crit-new',
      'crit-old',
      'unlinked',
      'demoted',
      'std',
    ]);
  });
});

describe('isDone is unchanged', () => {
  it('reads the status column', () => {
    expect(isDone(action({ status: 'done' }))).toBe(true);
    expect(isDone(action())).toBe(false);
  });
});

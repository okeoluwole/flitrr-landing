import { describe, it, expect } from 'vitest';
import {
  isBaselineCritical,
  isLiveCritical,
  sortRisks,
} from '../app/pulse/app/risk/riskModel.js';

/**
 * B1: a risk's critical state moves from the stored snapshot to a live read of
 * the objective it threatens. These cover the mechanism and, above all, the
 * drift case that is the whole point of the change: a risk whose stored column
 * still says standard but whose linked objective is now non-negotiable reads
 * critical live, without re-running the wizard.
 */

// The objective index the live read consumes: id -> { classification }, the
// shape buildObjectiveIndex produces and the register page already passes.
const OBJECTIVES = {
  'obj-critical': { id: 'obj-critical', classification: 'non_negotiable' },
  'obj-flexible': { id: 'obj-flexible', classification: 'flexible' },
};

function risk(overrides = {}) {
  return {
    id: 'risk-1',
    description: 'Planning approval is refused',
    linked_objective_id: 'obj-flexible',
    criticality: 'standard',
    likelihood: 'medium',
    impact: 'medium',
    status: 'watching',
    ...overrides,
  };
}

describe('isBaselineCritical reads the stored column', () => {
  it('is true only when the stored criticality is critical', () => {
    expect(isBaselineCritical(risk({ criticality: 'critical' }))).toBe(true);
    expect(isBaselineCritical(risk({ criticality: 'standard' }))).toBe(false);
  });
});

describe('isLiveCritical derives from the linked objective', () => {
  it('non-drift: live equals the stored value when the column matches the link', () => {
    // Stored critical, linked to a non-negotiable objective: both read critical.
    const c = risk({
      criticality: 'critical',
      linked_objective_id: 'obj-critical',
    });
    expect(isLiveCritical(c, OBJECTIVES)).toBe(true);
    expect(isLiveCritical(c, OBJECTIVES)).toBe(isBaselineCritical(c));

    // Stored standard, linked to a flexible objective: both read standard.
    const s = risk({
      criticality: 'standard',
      linked_objective_id: 'obj-flexible',
    });
    expect(isLiveCritical(s, OBJECTIVES)).toBe(false);
    expect(isLiveCritical(s, OBJECTIVES)).toBe(isBaselineCritical(s));
  });

  it('DRIFT: stored standard, but the linked objective is now non-negotiable, reads critical', () => {
    // The objective was reclassified to non-negotiable after the wizard stamped
    // the risk standard. The baseline still says standard; the live read, which
    // is what the register monitors on, correctly returns critical. This is the
    // behaviour B1 exists to produce.
    const drifted = risk({
      criticality: 'standard',
      linked_objective_id: 'obj-critical',
    });
    expect(isBaselineCritical(drifted)).toBe(false);
    expect(isLiveCritical(drifted, OBJECTIVES)).toBe(true);
  });

  it('an unlinked risk is never critical live, whatever the stored column says', () => {
    expect(
      isLiveCritical(
        risk({ criticality: 'critical', linked_objective_id: null }),
        OBJECTIVES
      )
    ).toBe(false);
  });
});

describe('sortRisks orders by the live value, not the stored snapshot', () => {
  it('puts a drifted (live-critical) risk above a stored-critical-only risk', () => {
    // a: stored standard, linked to a now-non-negotiable objective -> live critical.
    // b: stored critical, but linked to a flexible objective -> live standard.
    // Live ordering must put a first, even though only b's stored column says
    // critical. Same severity, so criticality alone decides.
    const a = risk({
      id: 'a',
      criticality: 'standard',
      linked_objective_id: 'obj-critical',
    });
    const b = risk({
      id: 'b',
      criticality: 'critical',
      linked_objective_id: 'obj-flexible',
    });
    const order = sortRisks([b, a], OBJECTIVES).map((r) => r.id);
    expect(order).toEqual(['a', 'b']);
  });
});

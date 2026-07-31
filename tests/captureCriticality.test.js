import { describe, it, expect } from 'vitest';
import {
  CRITICALITY,
  buildObjectiveIndex,
  deriveCriticality,
  toStoredCriticality,
  deriveCaptureStamp,
  exceedsLinkedObjective,
  classifyByType,
  effectiveCriticality,
} from '../lib/engine/criticality.js';
import { LIST_CONFIG, cascadeCriticality } from '../app/pulse/app/components/listStepConfig.js';
import {
  captureStamp,
  basisLine,
  rowToItem,
  itemToRow,
  makeEmptyItem,
} from '../app/pulse/app/components/listItemModel.js';

/**
 * Note 2: criticality derived at the point of capture. The objective link is
 * the only control; the criticality an item carries is read from that link
 * through the one engine kernel, at load, at render and at write, with the
 * basis recorded beside the value. These tests pin the derivation, the
 * write-path cap, the basis record, the pre-lock recompute, and the
 * regressions proving the pre-existing consumers derive exactly as before.
 */

// A project's live objective rows: Funding non-negotiable, Time flexible.
const OBJECTIVES = [
  { id: 'obj-funding', objective_type: 'funding', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
];

const makeKey = (() => {
  let n = 0;
  return () => `k${n++}`;
})();

describe('the one derivation (task 1)', () => {
  it('a non-negotiable link gives Critical', () => {
    expect(captureStamp('obj-funding', OBJECTIVES).criticality).toBe(
      CRITICALITY.CRITICAL
    );
  });

  it('a flexible link gives Standard', () => {
    expect(captureStamp('obj-time', OBJECTIVES).criticality).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('no link gives Standard', () => {
    expect(captureStamp('', OBJECTIVES).criticality).toBe(CRITICALITY.STANDARD);
    expect(captureStamp(null, OBJECTIVES).criticality).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('the capture stamp and the stored derivation agree on every input', () => {
    const { byId } = buildObjectiveIndex(OBJECTIVES);
    for (const link of ['obj-funding', 'obj-time', 'obj-gone', '', null]) {
      expect(deriveCaptureStamp(link, byId).criticality).toBe(
        toStoredCriticality(link, byId)
      );
    }
  });
});

describe('the write-path cap (task 3)', () => {
  const { byId } = buildObjectiveIndex(OBJECTIVES);

  it('Critical is rejected on a flexible link', () => {
    expect(exceedsLinkedObjective('critical', 'obj-time', byId)).toBe(true);
  });

  it('Critical is rejected on no link', () => {
    expect(exceedsLinkedObjective('critical', null, byId)).toBe(true);
    expect(exceedsLinkedObjective('critical', '', byId)).toBe(true);
  });

  it('Critical is allowed on a non-negotiable link', () => {
    expect(exceedsLinkedObjective('critical', 'obj-funding', byId)).toBe(false);
  });

  it('Standard never exceeds any link', () => {
    expect(exceedsLinkedObjective('standard', 'obj-funding', byId)).toBe(false);
    expect(exceedsLinkedObjective('standard', 'obj-time', byId)).toBe(false);
    expect(exceedsLinkedObjective('standard', null, byId)).toBe(false);
  });

  it('the write payload carries the derivation, never a manual value', () => {
    // A screen item holding a contradicting manual Critical on a flexible
    // link: the derivation is the only writer of the field.
    const item = {
      ...makeEmptyItem(LIST_CONFIG.workstreams, makeKey),
      name: 'Sales and marketing',
      linked_objective_id: 'obj-time',
      criticality: 'critical',
    };
    const row = itemToRow(LIST_CONFIG.workstreams, item, OBJECTIVES);
    expect(row.criticality).toBe(CRITICALITY.STANDARD);
  });
});

describe('the basis recorded with the value (task 4)', () => {
  it('a linked write records the deriving objective and its classification', () => {
    const item = {
      ...makeEmptyItem(LIST_CONFIG.risks, makeKey),
      description: 'Funding delayed or falls through',
      linked_objective_id: 'obj-funding',
    };
    const row = itemToRow(LIST_CONFIG.risks, item, OBJECTIVES);
    expect(row.criticality).toBe(CRITICALITY.CRITICAL);
    expect(row.criticality_basis_type).toBe('funding');
    expect(row.criticality_basis_classification).toBe('non_negotiable');
  });

  it('an unlinked write records a null basis, an honest nothing', () => {
    const item = {
      ...makeEmptyItem(LIST_CONFIG.risks, makeKey),
      description: 'Sales slower than forecast',
    };
    const row = itemToRow(LIST_CONFIG.risks, item, OBJECTIVES);
    expect(row.criticality).toBe(CRITICALITY.STANDARD);
    expect(row.criticality_basis_type).toBe(null);
    expect(row.criticality_basis_classification).toBe(null);
  });

  it('the basis renders as inherited from the objective by name', () => {
    expect(basisLine(captureStamp('obj-funding', OBJECTIVES))).toBe(
      'Inherited from Funding (non-negotiable).'
    );
    expect(basisLine(captureStamp('obj-time', OBJECTIVES))).toBe(
      'Inherited from Time (flexible).'
    );
  });

  it('no link renders the honest Standard line, not a blank', () => {
    expect(basisLine(captureStamp('', OBJECTIVES))).toBe(
      'No objective linked, so this holds at Standard.'
    );
  });
});

describe('reclassification before lock recomputes dependents (task 5)', () => {
  it('every dependent workstream and risk recomputes from the same function', () => {
    const workstreams = [
      { linked_objective_id: 'obj-time', criticality: 'standard' },
      { linked_objective_id: 'obj-funding', criticality: 'critical' },
    ];
    const risks = [{ linked_objective_id: 'obj-time', criticality: 'standard' }];

    // Time reclassifies to non-negotiable, Funding relaxes to flexible.
    const reclassified = [
      { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
      { id: 'obj-time', objective_type: 'time', classification: 'non_negotiable' },
    ];

    const after = [...workstreams, ...risks].map((it) =>
      captureStamp(it.linked_objective_id, reclassified).criticality
    );
    // Time-linked items rise to Critical; the Funding-linked one falls to
    // Standard, never left hanging off an objective that became flexible.
    expect(after).toEqual([
      CRITICALITY.CRITICAL,
      CRITICALITY.STANDARD,
      CRITICALITY.CRITICAL,
    ]);
  });

  it('the recompute never mutates what it reads, so a locked snapshot stays as it is', () => {
    // A locked snapshot is evidence: the derivation reads, it never writes
    // back. Freezing the inputs proves no code path mutates them.
    const snapshot = Object.freeze({
      criticality: 'critical',
      linked_objective_id: 'obj-funding',
    });
    const frozenObjectives = Object.freeze(
      OBJECTIVES.map((o) => Object.freeze({ ...o }))
    );
    expect(() =>
      captureStamp(snapshot.linked_objective_id, frozenObjectives)
    ).not.toThrow();
    expect(snapshot.criticality).toBe('critical');
  });
});

describe('draft records recompute on load (task 6)', () => {
  it('a stale manual Critical on a flexible link loads as Standard', () => {
    const row = {
      id: 'ws-1',
      name: 'Sales and marketing',
      linked_objective_id: 'obj-time',
      criticality: 'critical',
    };
    const item = rowToItem(LIST_CONFIG.workstreams, row, OBJECTIVES, makeKey);
    expect(item.criticality).toBe(CRITICALITY.STANDARD);
  });

  it('a stale manual Standard on a non-negotiable link loads as Critical', () => {
    const row = {
      id: 'r-1',
      description: 'Funding delayed or falls through',
      linked_objective_id: 'obj-funding',
      criticality: 'standard',
    };
    const item = rowToItem(LIST_CONFIG.risks, row, OBJECTIVES, makeKey);
    expect(item.criticality).toBe(CRITICALITY.CRITICAL);
  });
});

describe('regressions: the pre-existing consumers derive exactly as before', () => {
  const { byId, byType } = buildObjectiveIndex(OBJECTIVES);

  it('Step 7 milestones (classifyByType) are unchanged', () => {
    expect(classifyByType('funding', byType)).toBe(CRITICALITY.CRITICAL);
    expect(classifyByType('time', byType)).toBe(CRITICALITY.STANDARD);
    expect(classifyByType('scope', byType)).toBe(CRITICALITY.STANDARD);
    expect(
      classifyByType('time', byType, { alwaysCritical: true })
    ).toBe(CRITICALITY.CRITICAL);
  });

  it('the Action Log derivation (effectiveCriticality) is unchanged', () => {
    expect(effectiveCriticality('obj-funding', byId, null)).toBe(
      CRITICALITY.CRITICAL
    );
    expect(effectiveCriticality('obj-funding', byId, 'standard')).toBe(
      CRITICALITY.STANDARD
    );
    expect(effectiveCriticality('obj-time', byId, null)).toBe(
      CRITICALITY.STANDARD
    );
    expect(effectiveCriticality(null, byId, null)).toBe(CRITICALITY.UNLINKED);
  });

  it('the Risk register derivation (deriveCriticality) is unchanged', () => {
    expect(deriveCriticality('obj-funding', byId)).toBe(CRITICALITY.CRITICAL);
    expect(deriveCriticality('obj-time', byId)).toBe(CRITICALITY.STANDARD);
    expect(deriveCriticality('obj-gone', byId)).toBe(CRITICALITY.UNLINKED);
  });

  it('the write-time stamp (cascadeCriticality) is unchanged', () => {
    expect(cascadeCriticality('obj-funding', OBJECTIVES)).toBe('critical');
    expect(cascadeCriticality('obj-time', OBJECTIVES)).toBe('standard');
    expect(cascadeCriticality('', OBJECTIVES)).toBe('standard');
  });
});

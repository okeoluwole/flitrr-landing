import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';

/**
 * B3: the Brief's live preview derives each item's criticality from the linked
 * objective, while a locked Brief keeps the exact values frozen into its
 * snapshot. These two facts are the heart of Principle 4 (the locked baseline),
 * so they are tested together: assemble at lock time, capture the snapshot as
 * project_briefs.content holds it, then reclassify the objective and assemble a
 * fresh preview. The snapshot must not move; the preview must.
 *
 * The Brief renders these flags directly: BriefDocument reads model.*.critical
 * with no further derivation, so equality at the model level is equality at the
 * rendered document. A locked snapshot is read back from jsonb, so a JSON
 * round-trip of the assembled model is the faithful stand-in for it here.
 */

// One objective that everything links to, so a single reclassification
// exercises every item type at once. The stored criticality columns are left
// 'standard' deliberately: the live derivation drives the flag, not the column.
function stateWith(classification) {
  return {
    def: {
      name: 'Harbour Yard',
      project_type: 'residential',
      currency: 'GBP',
      budget: '5000000',
    },
    ctx: {},
    objectives: [
      { id: 'obj-quality', objective_type: 'quality', classification },
    ],
    lists: {
      risks: [
        {
          description: 'Defective cladding',
          linked_objective_id: 'obj-quality',
          criticality: 'standard',
          likelihood: 'high',
          impact: 'high',
        },
      ],
      milestones: [
        {
          name: 'Quality plan signed',
          target_date: '2026-08-01',
          linked_objective_id: 'obj-quality',
          criticality: 'standard',
        },
      ],
      workstreams: [
        {
          name: 'Quality assurance',
          lead: 'A. Lead',
          linked_objective_id: 'obj-quality',
          criticality: 'standard',
        },
      ],
      assumptions: [
        {
          description: 'Materials certified to spec',
          linked_objective_id: 'obj-quality',
          criticality: 'standard',
        },
      ],
    },
  };
}

const kpiOf = (model, key) => model.kpis.find((k) => k.key === key)?.value;

// The brief assembled while the objective is non-negotiable: every linked item
// is critical. This is the model that gets snapshotted at lock.
const atLock = assembleBrief(stateWith('non_negotiable'));

// The snapshot persisted to project_briefs.content (jsonb) and read back by a
// locked Brief: a JSON round-trip of the model assembled at lock.
const lockedSnapshot = JSON.parse(JSON.stringify(atLock));

// Later, the objective is reclassified to flexible. A fresh preview re-derives
// from the current classification.
const preview = assembleBrief(stateWith('flexible'));

describe('a fresh preview follows the current objective classification', () => {
  it('marks every linked item critical while the objective is non-negotiable', () => {
    expect(atLock.risks.list[0].critical).toBe(true);
    expect(atLock.milestones[0].critical).toBe(true);
    expect(atLock.workstreams[0].critical).toBe(true);
    expect(atLock.raid.assumptions[0].critical).toBe(true);
    expect(atLock.risks.criticalCount).toBe(1);
    expect(kpiOf(atLock, 'risks')).toBe('1');
  });

  it('marks every linked item standard once the objective is flexible', () => {
    expect(preview.risks.list[0].critical).toBe(false);
    expect(preview.milestones[0].critical).toBe(false);
    expect(preview.workstreams[0].critical).toBe(false);
    expect(preview.raid.assumptions[0].critical).toBe(false);
    expect(preview.risks.criticalCount).toBe(0);
    expect(kpiOf(preview, 'risks')).toBe('0');
  });
});

describe('a locked Brief keeps the values frozen at lock (Principle 4)', () => {
  it('the snapshot stays critical after the objective is reclassified flexible', () => {
    // The world has moved (see `preview` above), but the locked snapshot is the
    // agreed record at the moment it was locked, and must not move with it.
    expect(lockedSnapshot.risks.list[0].critical).toBe(true);
    expect(lockedSnapshot.milestones[0].critical).toBe(true);
    expect(lockedSnapshot.workstreams[0].critical).toBe(true);
    expect(lockedSnapshot.raid.assumptions[0].critical).toBe(true);
    expect(lockedSnapshot.risks.criticalCount).toBe(1);
    expect(kpiOf(lockedSnapshot, 'risks')).toBe('1');
  });

  it('renders byte-identical: a later preview does not touch the snapshot', () => {
    // Assembling the reclassified preview must not mutate the captured snapshot
    // in any way; it stays equal to the model as it was at lock.
    expect(lockedSnapshot).toEqual(JSON.parse(JSON.stringify(atLock)));
  });

  it('the snapshot carries no objective link, so it can only be read as frozen', () => {
    // The structural reason the baseline holds: the assembled model keeps the
    // derived boolean and the objective's display name, never the link or the
    // classification, so a locked Brief has nothing to re-derive from and can
    // only render the value it was locked with.
    const risk = lockedSnapshot.risks.list[0];
    expect(risk).toHaveProperty('critical', true);
    expect(risk).not.toHaveProperty('linked_objective_id');
    expect(risk).not.toHaveProperty('classification');
    expect(lockedSnapshot.milestones[0]).not.toHaveProperty('linked_objective_id');
    expect(lockedSnapshot.workstreams[0]).not.toHaveProperty('linked_objective_id');
  });
});

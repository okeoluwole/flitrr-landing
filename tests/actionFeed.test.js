import { describe, it, expect } from 'vitest';
import {
  deriveRiskItems,
  trackedRiskIds,
  buildTrackedActionFromRisk,
  formatActionLogSummary,
} from '../app/pulse/app/actions/actionFeed.js';
import { deriveSeverity } from '../app/pulse/app/risk/riskModel.js';

/**
 * Part A (M7.2) pure logic: the trigger rule with its edges, the dedupe
 * round trip in both directions, severity reused from the risk model (no
 * parallel mapping), promote-to-track row construction, and the tile
 * summary line.
 */

// A register row with sensible defaults, overridable per case.
function risk(overrides = {}) {
  return {
    id: 'risk-1',
    description: 'Planning approval is refused',
    linked_objective_id: 'obj-cost',
    criticality: 'standard',
    likelihood: 'medium',
    impact: 'medium',
    status: 'watching',
    updated_at: '2026-06-01T10:00:00+00:00',
    ...overrides,
  };
}

// A tracked action promoted from risk-1, overridable per case.
function trackedAction(overrides = {}) {
  return {
    id: 'action-1',
    status: 'to_do',
    criticality: 'critical',
    source: 'risk',
    source_id: 'risk-1',
    ...overrides,
  };
}

describe('the trigger rule', () => {
  it('surfaces a critical watching risk, with the Critical chip', () => {
    const items = deriveRiskItems([risk({ criticality: 'critical' })], []);
    expect(items).toHaveLength(1);
    expect(items[0].reasons).toEqual({ critical: true, serious: false });
  });

  it('surfaces a standard risk whose derived severity is Serious', () => {
    const items = deriveRiskItems(
      [risk({ likelihood: 'high', impact: 'high' })],
      []
    );
    expect(items).toHaveLength(1);
    expect(items[0].reasons).toEqual({ critical: false, serious: true });
  });

  it('shows both chips when a risk is critical and Serious', () => {
    const items = deriveRiskItems(
      [risk({ criticality: 'critical', likelihood: 'high', impact: 'high' })],
      []
    );
    expect(items[0].reasons).toEqual({ critical: true, serious: true });
  });

  it('does not surface a standard Minor risk', () => {
    const items = deriveRiskItems(
      [risk({ likelihood: 'low', impact: 'low' })],
      []
    );
    expect(items).toHaveLength(0);
  });

  it('does not surface a standard Worth watching risk', () => {
    // medium x medium scores 4: Worth watching, below the Serious bar.
    const items = deriveRiskItems([risk()], []);
    expect(items).toHaveLength(0);
  });

  it('keeps the item for a risk set to acting with nothing tracked', () => {
    const items = deriveRiskItems(
      [risk({ criticality: 'critical', status: 'acting' })],
      []
    );
    expect(items).toHaveLength(1);
  });

  it('clears the item when the risk is accepted', () => {
    const items = deriveRiskItems(
      [risk({ criticality: 'critical', status: 'accepted' })],
      []
    );
    expect(items).toHaveLength(0);
  });

  it('clears the item when the risk is closed', () => {
    const items = deriveRiskItems(
      [risk({ criticality: 'critical', status: 'closed' })],
      []
    );
    expect(items).toHaveLength(0);
  });
});

describe('the dedupe, both directions', () => {
  const qualifying = risk({ criticality: 'critical' });

  it('suppresses the item while an open tracked action exists', () => {
    expect(deriveRiskItems([qualifying], [trackedAction()])).toHaveLength(0);
    expect(
      deriveRiskItems([qualifying], [trackedAction({ status: 'doing' })])
    ).toHaveLength(0);
  });

  it('returns the item when the tracked action is marked done', () => {
    const items = deriveRiskItems(
      [qualifying],
      [trackedAction({ status: 'done' })]
    );
    expect(items).toHaveLength(1);
  });

  it('returns the item when the tracked action is deleted', () => {
    expect(deriveRiskItems([qualifying], [])).toHaveLength(1);
  });

  it('only a source = risk action with the matching id suppresses', () => {
    // A manual action that happens to carry the id does not count, and
    // neither does a risk action tracking a different risk.
    expect(
      deriveRiskItems([qualifying], [trackedAction({ source: 'manual' })])
    ).toHaveLength(1);
    expect(
      deriveRiskItems([qualifying], [trackedAction({ source_id: 'risk-2' })])
    ).toHaveLength(1);
  });

  it('trackedRiskIds collects only open risk-sourced links', () => {
    const ids = trackedRiskIds([
      trackedAction(),
      trackedAction({ id: 'a2', source_id: 'risk-2', status: 'done' }),
      trackedAction({ id: 'a3', source: 'manual', source_id: 'risk-3' }),
      trackedAction({ id: 'a4', source: 'risk', source_id: null }),
    ]);
    expect(ids).toEqual(new Set(['risk-1']));
  });
});

describe('severity comes from the risk model, not a parallel mapping', () => {
  it('carries deriveSeverity output verbatim on each item', () => {
    const r = risk({ likelihood: 'medium', impact: 'high' });
    const [item] = deriveRiskItems([r], []);
    expect(item.severity).toEqual(deriveSeverity('medium', 'high'));
    expect(item.severity.key).toBe('serious');
  });

  it('agrees with the register across the severity bands', () => {
    // Each band, judged by the same derivation the register renders.
    const bands = [
      { likelihood: 'low', impact: 'low', surfaced: false },
      { likelihood: 'medium', impact: 'medium', surfaced: false },
      { likelihood: 'high', impact: 'medium', surfaced: true },
      { likelihood: 'high', impact: 'high', surfaced: true },
    ];
    for (const band of bands) {
      const surfaced =
        deriveRiskItems([risk(band)], []).length === 1;
      expect(surfaced).toBe(band.surfaced);
      expect(surfaced).toBe(
        deriveSeverity(band.likelihood, band.impact).key === 'serious'
      );
    }
  });
});

describe('band ordering', () => {
  it('sorts critical first, then Serious, then most recently flagged', () => {
    const risks = [
      risk({
        id: 'serious-old',
        likelihood: 'high',
        impact: 'high',
        updated_at: '2026-06-01T10:00:00+00:00',
      }),
      risk({
        id: 'serious-new',
        likelihood: 'high',
        impact: 'high',
        updated_at: '2026-06-10T10:00:00+00:00',
      }),
      risk({
        id: 'critical-plain',
        criticality: 'critical',
        likelihood: 'low',
        impact: 'low',
        updated_at: '2026-06-02T10:00:00+00:00',
      }),
      risk({
        id: 'critical-serious',
        criticality: 'critical',
        likelihood: 'high',
        impact: 'high',
        updated_at: '2026-06-03T10:00:00+00:00',
      }),
    ];
    const order = deriveRiskItems(risks, []).map((i) => i.risk.id);
    expect(order).toEqual([
      'critical-serious',
      'critical-plain',
      'serious-new',
      'serious-old',
    ]);
  });
});

describe('promote-to-track row construction', () => {
  it('builds the pre-filled row: template, inheritance, source link, stage', () => {
    const r = risk({
      id: 'risk-9',
      description: 'Main contractor insolvency',
      linked_objective_id: 'obj-time',
      criticality: 'critical',
    });
    expect(buildTrackedActionFromRisk(r, 'project-1', 2)).toEqual({
      project_id: 'project-1',
      description: 'Mitigate: Main contractor insolvency',
      linked_objective_id: 'obj-time',
      criticality: 'critical',
      stage: 2,
      source: 'risk',
      source_id: 'risk-9',
    });
  });

  it('inherits a standard criticality and a missing objective as null, and stamps the stage', () => {
    const row = buildTrackedActionFromRisk(
      risk({ linked_objective_id: null, criticality: 'standard' }),
      'project-1',
      3
    );
    expect(row.linked_objective_id).toBeNull();
    expect(row.criticality).toBe('standard');
    expect(row.stage).toBe(3);
  });
});

describe('the tile summary line', () => {
  it('composes counts with correct plurals', () => {
    expect(formatActionLogSummary(2, 3)).toBe(
      '2 need your response, 3 critical actions open'
    );
    expect(formatActionLogSummary(1, 1)).toBe(
      '1 needs your response, 1 critical action open'
    );
  });

  it('drops a zero part', () => {
    expect(formatActionLogSummary(2, 0)).toBe('2 need your response');
    expect(formatActionLogSummary(0, 3)).toBe('3 critical actions open');
  });

  it('reads all quiet when both are zero', () => {
    expect(formatActionLogSummary(0, 0)).toBe(
      'All quiet. Nothing needs you right now.'
    );
  });
});

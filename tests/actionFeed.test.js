import { describe, it, expect } from 'vitest';
import {
  deriveRiskItems,
  trackedRiskIds,
  buildTrackedActionFromRisk,
  riskRaiseReason,
  deriveRaidItems,
  deriveResponseFeed,
  buildTrackedActionFromRaid,
  raidRaiseReason,
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

// A small objectives map for the RAID must-hold test, and a RAID row (the
// assumption/constraint/dependency tables share this shape).
const RAID_OBJECTIVES = {
  'obj-cost': { id: 'obj-cost', classification: 'non_negotiable' },
  'obj-time': { id: 'obj-time', classification: 'flexible' },
};

function raid(overrides = {}) {
  return {
    id: 'raid-1',
    description: 'Planning approval lands by Q3',
    linked_objective_id: 'obj-cost',
    criticality: 'standard',
    updated_at: '2026-06-05T10:00:00+00:00',
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
  it('builds the pre-filled row: template, inheritance, source link, stage, reason', () => {
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
      reason: 'Raised from a critical risk.',
      source: 'risk',
      source_id: 'risk-9',
    });
  });

  it('inherits a standard criticality and a missing objective as null, and stamps the stage and reason', () => {
    const row = buildTrackedActionFromRisk(
      risk({ linked_objective_id: null, criticality: 'standard' }),
      'project-1',
      3
    );
    expect(row.linked_objective_id).toBeNull();
    expect(row.criticality).toBe('standard');
    expect(row.stage).toBe(3);
    expect(row.reason).toBe('Raised from your risk register.');
  });
});

describe('riskRaiseReason (A4): the citable why', () => {
  it('names a critical risk', () => {
    expect(riskRaiseReason(risk({ criticality: 'critical' }))).toBe(
      'Raised from a critical risk.'
    );
  });

  it('names a serious score', () => {
    expect(riskRaiseReason(risk({ likelihood: 'high', impact: 'high' }))).toBe(
      'Raised from a risk scored serious.'
    );
  });

  it('names both when critical and serious', () => {
    expect(
      riskRaiseReason(
        risk({ criticality: 'critical', likelihood: 'high', impact: 'high' })
      )
    ).toBe('Raised from a critical risk scored serious.');
  });

  it('falls back to the register when neither', () => {
    expect(riskRaiseReason(risk())).toBe('Raised from your risk register.');
  });
});

describe('the RAID feed (A5)', () => {
  it('surfaces an item linked to a non-negotiable objective', () => {
    const items = deriveRaidItems([raid()], [], RAID_OBJECTIVES, 'assumption');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'assumption',
      reasons: { critical: true, serious: false },
      severity: null,
    });
    expect(items[0].row.id).toBe('raid-1');
  });

  it('does not surface an item on a flexible objective', () => {
    const items = deriveRaidItems(
      [raid({ linked_objective_id: 'obj-time' })],
      [],
      RAID_OBJECTIVES,
      'constraint'
    );
    expect(items).toHaveLength(0);
  });

  it('does not surface an unlinked item', () => {
    const items = deriveRaidItems(
      [raid({ linked_objective_id: null })],
      [],
      RAID_OBJECTIVES,
      'dependency'
    );
    expect(items).toHaveLength(0);
  });

  it('suppresses an item with an open tracked action of its kind, returns when done', () => {
    const open = [{ id: 'a1', status: 'to_do', source: 'assumption', source_id: 'raid-1' }];
    expect(deriveRaidItems([raid()], open, RAID_OBJECTIVES, 'assumption')).toHaveLength(0);
    const done = [{ id: 'a1', status: 'done', source: 'assumption', source_id: 'raid-1' }];
    expect(deriveRaidItems([raid()], done, RAID_OBJECTIVES, 'assumption')).toHaveLength(1);
  });

  it('keys the dedupe by kind: a risk action does not suppress an assumption', () => {
    const tracked = [{ id: 'a1', status: 'to_do', source: 'risk', source_id: 'raid-1' }];
    expect(deriveRaidItems([raid()], tracked, RAID_OBJECTIVES, 'assumption')).toHaveLength(1);
  });
});

describe('the unified response feed (A5)', () => {
  it('critical first: a critical RAID item outranks a serious-but-not-critical risk', () => {
    const feed = deriveResponseFeed({
      risks: [risk({ id: 'r-serious', likelihood: 'high', impact: 'high' })],
      assumptions: [raid({ id: 'a-crit' })],
      constraints: [],
      dependencies: [],
      actions: [],
      objectivesById: RAID_OBJECTIVES,
    });
    expect(feed.map((e) => [e.kind, e.row.id])).toEqual([
      ['assumption', 'a-crit'],
      ['risk', 'r-serious'],
    ]);
  });

  it('within the critical band a serious risk outranks a RAID item (no severity)', () => {
    const feed = deriveResponseFeed({
      risks: [
        risk({ id: 'r-crit-serious', criticality: 'critical', likelihood: 'high', impact: 'high' }),
      ],
      assumptions: [raid({ id: 'a-crit' })],
      constraints: [],
      dependencies: [],
      actions: [],
      objectivesById: RAID_OBJECTIVES,
    });
    expect(feed[0].kind).toBe('risk');
    expect(feed[1].kind).toBe('assumption');
  });

  it('draws RAID from all three tables', () => {
    const feed = deriveResponseFeed({
      risks: [],
      assumptions: [raid({ id: 'a1' })],
      constraints: [raid({ id: 'c1' })],
      dependencies: [raid({ id: 'd1' })],
      actions: [],
      objectivesById: RAID_OBJECTIVES,
    });
    expect(feed.map((e) => e.kind).sort()).toEqual([
      'assumption',
      'constraint',
      'dependency',
    ]);
  });
});

describe('RAID promotion (A5)', () => {
  it('raidRaiseReason names the kind and the non-negotiable objective', () => {
    expect(raidRaiseReason('assumption')).toBe(
      'Raised from an assumption on a non-negotiable objective.'
    );
    expect(raidRaiseReason('constraint')).toBe(
      'Raised from a constraint on a non-negotiable objective.'
    );
    expect(raidRaiseReason('dependency')).toBe(
      'Raised from a dependency on a non-negotiable objective.'
    );
  });

  it('builds the tracked action with the kind verb, source link, stage, reason', () => {
    const item = raid({
      id: 'raid-9',
      description: 'Main access road is adopted',
      linked_objective_id: 'obj-cost',
    });
    expect(buildTrackedActionFromRaid(item, 'project-1', 3, 'dependency')).toEqual({
      project_id: 'project-1',
      description: 'Secure: Main access road is adopted',
      linked_objective_id: 'obj-cost',
      criticality: 'standard',
      stage: 3,
      reason: 'Raised from a dependency on a non-negotiable objective.',
      source: 'dependency',
      source_id: 'raid-9',
    });
  });

  it('leads the description with the verb for each kind', () => {
    expect(buildTrackedActionFromRaid(raid(), 'p', 2, 'assumption').description).toMatch(
      /^Validate: /
    );
    expect(buildTrackedActionFromRaid(raid(), 'p', 2, 'constraint').description).toMatch(
      /^Plan around: /
    );
    expect(buildTrackedActionFromRaid(raid(), 'p', 2, 'dependency').description).toMatch(
      /^Secure: /
    );
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

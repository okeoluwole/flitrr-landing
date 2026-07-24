import { describe, it, expect } from 'vitest';
import {
  itemKey,
  latestDecisionsByItem,
  dismissedItemKeys,
  triageDecisionRowFrom,
  TRIAGE_DECISIONS,
  TRIAGE_SURFACES,
} from '../app/pulse/app/actions/triageDecisionStore.js';
import {
  deriveResponseFeed,
  formatActionLogSummary,
} from '../app/pulse/app/actions/actionFeed.js';
import { provenanceLabel, objectiveRelation } from '../app/pulse/app/actions/actionModel.js';

/**
 * Note 18.5: every queued item ends in a recorded decision.
 *
 * The queue had two responses, Track this and Review in register, and no way to
 * say no. An item the developer had read, considered and rejected looked
 * exactly like one they had never opened. These tests hold the decline path and
 * the record it leaves: what, by whom, when, and why.
 */

const objectives = {
  'obj-cost': { classification: 'non_negotiable' },
  'obj-scope': { classification: 'flexible' },
};

describe('the recorded triage decision', () => {
  it('records the item, the surface, the decision and who decided', () => {
    const row = triageDecisionRowFrom({
      projectId: 'p1',
      itemKind: 'dependency',
      itemId: 'dep-1',
      itemName: 'Utilities connection by the network operator',
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.DISMISSED,
      reason: 'The operator has already confirmed the connection date.',
      decidedBy: 'user-1',
    });
    expect(row).toEqual({
      project_id: 'p1',
      item_kind: 'dependency',
      item_id: 'dep-1',
      item_name: 'Utilities connection by the network operator',
      surface: 'action_log',
      decision: 'dismissed',
      reason: 'The operator has already confirmed the connection date.',
      created_action_id: null,
      created_risk_id: null,
      decided_by: 'user-1',
    });
  });

  // The "when" is the database's NOW() default, the same convention
  // reconcileDecisionStore.decisionRowFrom follows: the store invents no clock.
  it('invents no timestamp of its own', () => {
    const row = triageDecisionRowFrom({
      projectId: 'p1',
      itemKind: 'risk',
      itemId: 'risk-1',
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.TRACKED,
      createdActionId: 'action-1',
      decidedBy: 'user-1',
    });
    expect('decided_at' in row).toBe(false);
    expect(row.created_action_id).toBe('action-1');
  });

  // Saying no is a judgement, and a judgement with no reason recorded is
  // indistinguishable from neglect. The database enforces this too.
  it('refuses a dismiss with no reason', () => {
    const attempt = () =>
      triageDecisionRowFrom({
        projectId: 'p1',
        itemKind: 'risk',
        itemId: 'risk-1',
        surface: TRIAGE_SURFACES.ACTION_LOG,
        decision: TRIAGE_DECISIONS.DISMISSED,
        decidedBy: 'user-1',
      });
    expect(attempt).toThrow(/needs a reason/i);
  });

  it('refuses a dismiss whose reason is only whitespace', () => {
    expect(() =>
      triageDecisionRowFrom({
        projectId: 'p1',
        itemKind: 'risk',
        itemId: 'risk-1',
        surface: TRIAGE_SURFACES.ACTION_LOG,
        decision: TRIAGE_DECISIONS.DISMISSED,
        reason: '   ',
        decidedBy: 'user-1',
      })
    ).toThrow(/needs a reason/i);
  });

  it('trims the reason it records', () => {
    const row = triageDecisionRowFrom({
      projectId: 'p1',
      itemKind: 'risk',
      itemId: 'risk-1',
      surface: TRIAGE_SURFACES.ACTION_LOG,
      decision: TRIAGE_DECISIONS.DISMISSED,
      reason: '  Already covered by the contingency.  ',
    });
    expect(row.reason).toBe('Already covered by the contingency.');
  });

  it('records a suggestion decision against the surface it was taken on', () => {
    const row = triageDecisionRowFrom({
      projectId: 'p1',
      itemKind: 'play',
      itemId: 'play-9',
      itemName: 'Confirm professional indemnity insurance',
      surface: TRIAGE_SURFACES.RISK_REGISTER,
      decision: TRIAGE_DECISIONS.ADDED,
      createdRiskId: 'risk-new',
      decidedBy: 'user-1',
    });
    expect(row.surface).toBe('risk_register');
    expect(row.created_risk_id).toBe('risk-new');
  });
});

describe('the current decision on an item is its latest row', () => {
  const rows = [
    {
      item_kind: 'risk',
      item_id: 'risk-1',
      decision: 'dismissed',
      reason: 'Not a live concern.',
      decided_at: '2026-07-01T09:00:00.000Z',
    },
    {
      item_kind: 'risk',
      item_id: 'risk-1',
      decision: 'tracked',
      decided_at: '2026-07-10T09:00:00.000Z',
    },
    {
      item_kind: 'assumption',
      item_id: 'asm-1',
      decision: 'dismissed',
      reason: 'Verified with the funder.',
      decided_at: '2026-07-05T09:00:00.000Z',
    },
  ];

  it('takes the newest row per item', () => {
    const latest = latestDecisionsByItem(rows);
    expect(latest.get(itemKey('risk', 'risk-1')).decision).toBe('tracked');
    expect(latest.get(itemKey('assumption', 'asm-1')).decision).toBe('dismissed');
  });

  // An item dismissed and later tracked returns to being tracked, rather than
  // staying suppressed by its own history.
  it('drops an item from the declined set once a later decision supersedes it', () => {
    const declined = dismissedItemKeys(rows);
    expect(declined.has(itemKey('risk', 'risk-1'))).toBe(false);
    expect(declined.has(itemKey('assumption', 'asm-1'))).toBe(true);
  });

  it('keys by kind as well as id, because ids only span one table', () => {
    const clash = [
      { item_kind: 'risk', item_id: 'same', decision: 'dismissed', reason: 'x', decided_at: '1' },
      { item_kind: 'assumption', item_id: 'same', decision: 'tracked', decided_at: '2' },
    ];
    const declined = dismissedItemKeys(clash);
    expect(declined.has(itemKey('risk', 'same'))).toBe(true);
    expect(declined.has(itemKey('assumption', 'same'))).toBe(false);
  });
});

describe('a declined item leaves the queue', () => {
  const risks = [
    {
      id: 'risk-1',
      description: 'Construction costs exceed budget',
      linked_objective_id: 'obj-cost',
      likelihood: 'medium',
      impact: 'medium',
      status: 'watching',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ];
  const dependencies = [
    {
      id: 'dep-1',
      description: 'Utilities connection by the network operator',
      linked_objective_id: 'obj-cost',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ];
  const feed = (dismissed) =>
    deriveResponseFeed({
      risks,
      assumptions: [],
      constraints: [],
      dependencies,
      actions: [],
      objectivesById: objectives,
      dismissed,
    });

  it('queues both when nothing has been declined', () => {
    expect(feed().map((e) => e.kind).sort()).toEqual(['dependency', 'risk']);
  });

  it('drops only the declined item', () => {
    const declined = new Set([itemKey('dependency', 'dep-1')]);
    const kept = feed(declined);
    expect(kept).toHaveLength(1);
    expect(kept[0].kind).toBe('risk');
  });

  // Selection is untouched: the decline is the developer's recorded judgement,
  // not a change to what qualifies.
  it('behaves exactly as before when no declined set is passed', () => {
    expect(feed(undefined)).toHaveLength(2);
    expect(feed(new Set())).toHaveLength(2);
  });
});

describe('the queue reads as triage, not alarm', () => {
  it('never tells the developer their own brief needs a response', () => {
    const line = formatActionLogSummary(14, 0);
    expect(line).toBe('14 to triage from your brief');
    expect(line).not.toContain('need your response');
  });

  it('stays quiet when there is nothing at all', () => {
    expect(formatActionLogSummary(0, 0)).toBe(
      'All quiet. Nothing needs you right now.'
    );
  });
});

describe('provenance and relation on every queued card', () => {
  // "This project" was true of everything on the screen, so it told the
  // developer nothing. Every origin now names the document to go and read.
  it('states an origin and its document for every queued kind', () => {
    for (const kind of ['risk', 'assumption', 'constraint', 'dependency']) {
      const label = provenanceLabel(kind);
      expect(label).toBeTruthy();
      expect(label).not.toBe('This project');
      expect(label.toLowerCase()).toContain('brief');
    }
  });

  it('names the kind in its own label', () => {
    expect(provenanceLabel('risk')).toContain('Risk');
    expect(provenanceLabel('dependency')).toContain('Dependency');
  });

  // Note 7 and Note 18.4: a risk THREATENS, a RAID item BEARS ON. "vs Cost"
  // said neither.
  it('says how each kind relates to the objective it is linked to', () => {
    expect(objectiveRelation('risk', 'Cost')).toBe('threatens Cost');
    expect(objectiveRelation('assumption', 'Cost')).toBe('bears on Cost');
    expect(objectiveRelation('constraint', 'Cost')).toBe('bears on Cost');
    expect(objectiveRelation('dependency', 'Cost')).toBe('bears on Cost');
  });

  it('never falls back to the uninformative "vs"', () => {
    for (const kind of ['risk', 'assumption', 'constraint', 'dependency']) {
      expect(objectiveRelation(kind, 'Cost')).not.toContain('vs ');
    }
  });

  it('states the gap when the item has no objective', () => {
    expect(objectiveRelation('risk', null)).toBe('Needs a link');
  });
});

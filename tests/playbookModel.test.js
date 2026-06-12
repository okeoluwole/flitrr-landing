import { describe, it, expect } from 'vitest';
import {
  derivePlayCriticality,
  deriveProposals,
  splitProposals,
  buildActionFromPlay,
  buildRiskFromPlay,
  PROPOSAL_CAP,
} from '../lib/playbook/playbookModel.js';

/**
 * Part C (M7.4) model: criticality derivation across postures
 * (always_critical, protected objective, flexible objective), proposal
 * filtering (stage keying, accepted and dismissed excluded, top-five
 * ordering), and accepted-play row construction for both actions and risks.
 */

// A project posture: Cost protected, Quality flexible.
const OBJECTIVES_BY_TYPE = {
  scope: { id: 'obj-scope', classification: 'flexible' },
  cost: { id: 'obj-cost', classification: 'non_negotiable' },
  time: { id: 'obj-time', classification: 'flexible' },
  quality: { id: 'obj-quality', classification: 'flexible' },
  funding: { id: 'obj-funding', classification: 'flexible' },
};

function play(overrides = {}) {
  return {
    id: 'play-1',
    slug: 'sample-play',
    type: 'action',
    stage: 2,
    title: 'A sample title',
    why: 'A sample why line.',
    objective: 'cost',
    always_critical: false,
    ...overrides,
  };
}

describe('criticality derivation across postures', () => {
  it('always_critical is critical whatever the classification', () => {
    const p = play({ objective: 'quality', always_critical: true });
    expect(derivePlayCriticality(p, OBJECTIVES_BY_TYPE)).toBe('critical');
  });

  it('a play serving a protected objective is critical', () => {
    expect(derivePlayCriticality(play(), OBJECTIVES_BY_TYPE)).toBe('critical');
  });

  it('the same play on a flexible objective is standard', () => {
    const p = play({ objective: 'quality' });
    expect(derivePlayCriticality(p, OBJECTIVES_BY_TYPE)).toBe('standard');
  });

  it('a missing objective row derives standard unless always critical', () => {
    expect(derivePlayCriticality(play(), {})).toBe('standard');
    expect(
      derivePlayCriticality(play({ always_critical: true }), {})
    ).toBe('critical');
  });
});

describe('proposal filtering', () => {
  const plays = [
    play({ id: 'p1', slug: 'a-standard', objective: 'quality' }),
    play({ id: 'p2', slug: 'b-critical', objective: 'cost' }),
    play({ id: 'p3', slug: 'c-stage3', stage: 3 }),
    play({ id: 'p4', slug: 'd-risk', type: 'risk' }),
    play({ id: 'p5', slug: 'e-accepted' }),
    play({ id: 'p6', slug: 'f-dismissed' }),
  ];
  const states = [
    { play_id: 'p5', state: 'accepted' },
    { play_id: 'p6', state: 'dismissed' },
  ];

  const proposals = deriveProposals({
    plays,
    states,
    currentStage: 2,
    type: 'action',
    objectivesByType: OBJECTIVES_BY_TYPE,
  });

  it('keys to the current stage only (Stage 3 stays dormant)', () => {
    expect(proposals.map((s) => s.playId)).not.toContain('p3');
  });

  it('filters to the surface type', () => {
    expect(proposals.map((s) => s.playId)).not.toContain('p4');
  });

  it('excludes accepted and dismissed pairs', () => {
    const ids = proposals.map((s) => s.playId);
    expect(ids).not.toContain('p5');
    expect(ids).not.toContain('p6');
  });

  it('sorts derived-criticality first and maps the objective id', () => {
    expect(proposals.map((s) => s.playId)).toEqual(['p2', 'p1']);
    expect(proposals[0].criticality).toBe('critical');
    expect(proposals[0].linkedObjectiveId).toBe('obj-cost');
    expect(proposals[1].criticality).toBe('standard');
    expect(proposals[1].linkedObjectiveId).toBe('obj-quality');
  });

  it('keeps incoming order within a criticality band (stable sort)', () => {
    const many = deriveProposals({
      plays: [
        play({ id: 'x1', slug: 'a', objective: 'time' }),
        play({ id: 'x2', slug: 'b', objective: 'scope' }),
        play({ id: 'x3', slug: 'c', objective: 'cost' }),
      ],
      states: [],
      currentStage: 2,
      type: 'action',
      objectivesByType: OBJECTIVES_BY_TYPE,
    });
    expect(many.map((s) => s.playId)).toEqual(['x3', 'x1', 'x2']);
  });
});

describe('the top-five split', () => {
  it('shows five and holds the rest behind Show all', () => {
    const proposals = Array.from({ length: 8 }, (_, i) => ({
      playId: `p${i}`,
    }));
    const { top, rest } = splitProposals(proposals);
    expect(PROPOSAL_CAP).toBe(5);
    expect(top).toHaveLength(5);
    expect(rest).toHaveLength(3);
    expect(top[0].playId).toBe('p0');
    expect(rest[0].playId).toBe('p5');
  });

  it('has no rest at five or fewer', () => {
    const { top, rest } = splitProposals([{ playId: 'p1' }]);
    expect(top).toHaveLength(1);
    expect(rest).toHaveLength(0);
  });
});

describe('accepted-play row construction', () => {
  const suggestion = {
    playId: 'play-9',
    slug: 'pi-insurance-check',
    title: 'Confirm professional indemnity insurance for every consultant',
    why: 'The why line.',
    objective: 'quality',
    criticality: 'critical',
    linkedObjectiveId: 'obj-quality',
  };

  it('builds the tracked action: title, mapped objective, derived criticality, playbook source', () => {
    expect(buildActionFromPlay(suggestion, 'project-1')).toEqual({
      project_id: 'project-1',
      description:
        'Confirm professional indemnity insurance for every consultant',
      linked_objective_id: 'obj-quality',
      criticality: 'critical',
      source: 'playbook',
      source_id: 'play-9',
    });
  });

  it('builds the register row: medium and medium, no review stamp, no source columns', () => {
    const row = buildRiskFromPlay(suggestion, 'project-1');
    expect(row).toEqual({
      project_id: 'project-1',
      description:
        'Confirm professional indemnity insurance for every consultant',
      linked_objective_id: 'obj-quality',
      criticality: 'critical',
      likelihood: 'medium',
      impact: 'medium',
    });
    // last_reviewed_at and status are deliberately absent: the row takes
    // the table defaults (null, watching) so it surfaces as not yet
    // reviewed and behaves as any risk.
    expect('last_reviewed_at' in row).toBe(false);
    expect('status' in row).toBe(false);
  });
});

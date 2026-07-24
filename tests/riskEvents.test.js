import { describe, it, expect } from 'vitest';
import {
  isBandRaise,
  deriveEscalation,
  escalationsByRisk,
  eventsByRisk,
  buildScoredEvent,
  RISK_EVENT_TYPES,
} from '../lib/engine/riskEvents.js';

/**
 * Note 19.1: the escalation narrative is event-sourced.
 *
 * The register was telling five of six risks "Severity has escalated." on a
 * register that had never been reviewed and recorded no change at all. These
 * tests hold the rule that replaced it: an escalation is a RECORDED EVENT, and
 * the sentence exists only where the data can show the band was raised.
 */

const scored = (over = {}) => ({
  id: 'e1',
  risk_id: 'risk-1',
  event_type: RISK_EVENT_TYPES.SCORED,
  from_value: 'moderate',
  to_value: 'serious',
  occurred_at: '2026-07-20T09:00:00.000Z',
  actor_id: 'user-1',
  ...over,
});

describe('what counts as a band raise', () => {
  it('counts a move to a more urgent band', () => {
    expect(isBandRaise('minor', 'moderate')).toBe(true);
    expect(isBandRaise('moderate', 'serious')).toBe(true);
    expect(isBandRaise('minor', 'serious')).toBe(true);
  });

  it('does not count a move to a less urgent band', () => {
    expect(isBandRaise('serious', 'moderate')).toBe(false);
    expect(isBandRaise('moderate', 'minor')).toBe(false);
  });

  it('does not count standing still', () => {
    expect(isBandRaise('serious', 'serious')).toBe(false);
  });

  // Arriving somewhere is not escalating to it. A risk scored for the first
  // time has not moved; it has only been measured.
  it('does not count a first score as a raise', () => {
    expect(isBandRaise(null, 'serious')).toBe(false);
    expect(isBandRaise(undefined, 'serious')).toBe(false);
  });

  it('does not count a band it cannot rank', () => {
    expect(isBandRaise('catastrophic', 'serious')).toBe(false);
    expect(isBandRaise('moderate', 'apocalyptic')).toBe(false);
  });
});

describe('deriving the escalation for one risk', () => {
  it('returns nothing when there are no events at all', () => {
    expect(deriveEscalation([], 'risk-1')).toBeNull();
    expect(deriveEscalation(null, 'risk-1')).toBeNull();
    expect(deriveEscalation(undefined, 'risk-1')).toBeNull();
  });

  it('returns from, to, when and who from a recorded raise', () => {
    expect(deriveEscalation([scored()], 'risk-1')).toEqual({
      from: 'moderate',
      to: 'serious',
      at: '2026-07-20T09:00:00.000Z',
      by: 'user-1',
    });
  });

  it('ignores a recorded de-escalation', () => {
    const down = scored({ from_value: 'serious', to_value: 'minor' });
    expect(deriveEscalation([down], 'risk-1')).toBeNull();
  });

  it('ignores events of other kinds', () => {
    const reviewed = scored({
      event_type: RISK_EVENT_TYPES.REVIEWED,
      from_value: 'minor',
      to_value: 'serious',
    });
    expect(deriveEscalation([reviewed], 'risk-1')).toBeNull();
  });

  it('ignores the events of another risk', () => {
    expect(deriveEscalation([scored({ risk_id: 'risk-2' })], 'risk-1')).toBeNull();
  });

  it('takes the most recent raise when there are several', () => {
    const older = scored({
      id: 'e-old',
      from_value: 'minor',
      to_value: 'moderate',
      occurred_at: '2026-06-01T09:00:00.000Z',
    });
    const newer = scored({
      id: 'e-new',
      from_value: 'moderate',
      to_value: 'serious',
      occurred_at: '2026-07-20T09:00:00.000Z',
    });
    expect(deriveEscalation([older, newer], 'risk-1').to).toBe('serious');
    expect(deriveEscalation([newer, older], 'risk-1').to).toBe('serious');
  });
});

describe('the seeded register records no escalation anywhere', () => {
  // The exact state the end-to-end test found: six Brief risks, seeded at
  // medium by medium, never reviewed, never rescored. Five of them used to
  // claim "Severity has escalated.". Nothing had moved.
  const seededRisks = Array.from({ length: 6 }, (_, i) => ({
    id: `risk-${i + 1}`,
    likelihood: 'medium',
    impact: 'medium',
    last_reviewed_at: null,
  }));

  it('derives no escalation for any of the six, because no event exists', () => {
    for (const risk of seededRisks) {
      expect(deriveEscalation([], risk.id)).toBeNull();
    }
  });

  it('returns an empty escalation map for a register with no events', () => {
    expect(escalationsByRisk([]).size).toBe(0);
  });
});

describe('grouping and mapping events', () => {
  it('groups by risk, newest first', () => {
    const a = scored({ id: 'a', risk_id: 'r1', occurred_at: '2026-01-01T00:00:00.000Z' });
    const b = scored({ id: 'b', risk_id: 'r1', occurred_at: '2026-03-01T00:00:00.000Z' });
    const c = scored({ id: 'c', risk_id: 'r2' });
    const grouped = eventsByRisk([a, b, c]);
    expect(grouped.get('r1').map((e) => e.id)).toEqual(['b', 'a']);
    expect(grouped.get('r2').map((e) => e.id)).toEqual(['c']);
  });

  it('maps only the risks that actually escalated', () => {
    const raised = scored({ risk_id: 'r1', from_value: 'minor', to_value: 'serious' });
    const lowered = scored({ risk_id: 'r2', from_value: 'serious', to_value: 'minor' });
    const map = escalationsByRisk([raised, lowered]);
    expect(map.has('r1')).toBe(true);
    expect(map.has('r2')).toBe(false);
  });
});

describe('the event a rescore writes', () => {
  it('records the band transition with the actor', () => {
    const event = buildScoredEvent({
      projectId: 'p1',
      riskId: 'risk-1',
      before: { likelihood: 'medium', impact: 'medium' },
      after: { likelihood: 'high', impact: 'high' },
      actorId: 'user-1',
    });
    expect(event).toEqual({
      project_id: 'p1',
      risk_id: 'risk-1',
      event_type: 'scored',
      from_value: 'moderate',
      to_value: 'serious',
      actor_id: 'user-1',
    });
  });

  // No clock and no id: occurred_at takes the database default, the same
  // convention reconcileDecisionStore.decisionRowFrom follows.
  it('invents no timestamp and no id', () => {
    const event = buildScoredEvent({
      projectId: 'p1',
      riskId: 'risk-1',
      before: { likelihood: 'low', impact: 'low' },
      after: { likelihood: 'high', impact: 'high' },
    });
    expect('occurred_at' in event).toBe(false);
    expect('id' in event).toBe(false);
  });

  // A rescore that leaves the band where it was is not a change worth
  // recording, and a log full of non-events would mislead exactly as the old
  // sentence did.
  it('writes nothing when the band did not move', () => {
    expect(
      buildScoredEvent({
        projectId: 'p1',
        riskId: 'risk-1',
        // low x high = 3 and medium x medium = 4: both Worth watching.
        before: { likelihood: 'low', impact: 'high' },
        after: { likelihood: 'medium', impact: 'medium' },
      })
    ).toBeNull();
  });

  it('records a de-escalation too, which simply never reads as a raise', () => {
    const event = buildScoredEvent({
      projectId: 'p1',
      riskId: 'risk-1',
      before: { likelihood: 'high', impact: 'high' },
      after: { likelihood: 'low', impact: 'low' },
    });
    expect(event.from_value).toBe('serious');
    expect(event.to_value).toBe('minor');
    expect(deriveEscalation([{ ...event, risk_id: 'risk-1' }], 'risk-1')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  statusLine,
  escalationLine,
  queueHeading,
  riskProvenance,
  isFromBrief,
  objectiveRelation,
} from '../app/pulse/app/risk/registerRead.js';
import { assessRisks, assessRisk } from '../lib/engine/monitor.js';
import { severityLegend, SEVERITY_BANDS } from '../lib/engine/severity.js';

/**
 * Note 19.2: the queue is a first-review queue with provenance, and each card
 * carries ONE accurate status line instead of three boilerplate ones.
 *
 * The register used to stack every fired trigger as its own bullet, so a seeded
 * risk read "Not yet reviewed." and "Critical, with no response yet." and
 * "Severity has escalated." at once. Three lines saying one thing is noise, and
 * one of the three was not even true.
 */

const NOW = Date.parse('2026-07-24T12:00:00.000Z');

// The Brief's classification: Cost is non-negotiable, Scope is flexible.
const objectives = {
  'obj-cost': { name: 'Cost', classification: 'non_negotiable' },
  'obj-scope': { name: 'Scope', classification: 'flexible' },
};

const risk = (over = {}) => ({
  id: 'risk-1',
  description: 'Construction costs exceed budget',
  linked_objective_id: 'obj-cost',
  likelihood: 'medium',
  impact: 'medium',
  status: 'watching',
  last_reviewed_at: null,
  response_note: null,
  source: null,
  ...over,
});

const verdict = (r) => assessRisk(r, objectives, NOW);

describe('one accurate status line per card', () => {
  // The seeded case: critical, medium by medium, never reviewed, no response.
  // Three triggers fire at once. Exactly one sentence comes out.
  it('says awaiting first review, not three things at once', () => {
    const r = risk();
    const a = verdict(r);
    expect(a.firedTriggers.length).toBeGreaterThan(1);
    expect(statusLine(a, r, NOW)).toBe('Awaiting first review.');
  });

  it('never claims a severity movement on a risk that has not moved', () => {
    const r = risk();
    expect(statusLine(verdict(r), r, NOW)).not.toContain('escalated');
  });

  it('puts the governance gap first, above everything else', () => {
    const r = risk({ linked_objective_id: null });
    expect(statusLine(verdict(r), r, NOW)).toBe('Needs a link to an objective.');
  });

  it('says how overdue a reviewed risk is, in days', () => {
    // Critical, so the review window is 14 days; reviewed 20 days ago.
    const r = risk({ last_reviewed_at: '2026-07-04T12:00:00.000Z' });
    expect(statusLine(verdict(r), r, NOW)).toBe('Overdue for review by 6 days.');
  });

  it('says critical with no response once it has been reviewed and is in window', () => {
    const r = risk({ last_reviewed_at: '2026-07-22T12:00:00.000Z' });
    expect(statusLine(verdict(r), r, NOW)).toBe(
      'Critical, with no response recorded yet.'
    );
  });

  // The escalated-severity trigger is a LEVEL test, so it is now stated as a
  // level. The proportional threshold is named, because that is the part the
  // developer can act on.
  it('states the escalation threshold as a level, never as a movement', () => {
    const r = risk({
      last_reviewed_at: '2026-07-22T12:00:00.000Z',
      response_note: 'Contingency held at 8 percent.',
    });
    const line = statusLine(verdict(r), r, NOW);
    expect(line).toBe('Scored Worth watching, which escalates on a critical risk.');
    expect(line).not.toContain('has escalated');
  });

  it('says nothing about a risk the monitor did not flag', () => {
    const r = risk({
      linked_objective_id: 'obj-scope',
      likelihood: 'low',
      impact: 'low',
      last_reviewed_at: '2026-07-22T12:00:00.000Z',
    });
    const a = verdict(r);
    expect(a.needsAttention).toBe(false);
    expect(statusLine(a, r, NOW)).toBeNull();
  });
});

describe('the escalation line renders only from a recorded event', () => {
  const labels = {
    serious: 'Serious',
    moderate: 'Worth watching',
    minor: 'Minor',
  };
  const opts = {
    bandLabel: (k) => labels[k] ?? k,
    actorName: (id) => (id === 'user-1' ? 'Olu' : null),
    formatDate: () => '20 Jul 2026',
  };

  it('renders nothing without an escalation', () => {
    expect(escalationLine(null, opts)).toBeNull();
    expect(escalationLine(undefined, opts)).toBeNull();
  });

  it('cites from, to, when and who', () => {
    expect(
      escalationLine(
        { from: 'moderate', to: 'serious', at: '2026-07-20T09:00:00.000Z', by: 'user-1' },
        opts
      )
    ).toBe('Raised from Worth watching to Serious on 20 Jul 2026, by Olu.');
  });

  it('names an unknown actor honestly rather than dropping the who', () => {
    const line = escalationLine(
      { from: 'minor', to: 'serious', at: '2026-07-20T09:00:00.000Z', by: 'ghost' },
      opts
    );
    expect(line).toContain('by a team member.');
  });
});

describe('the queue heading states what is queued and where it came from', () => {
  it('reads as a first-review queue when every item is awaiting one', () => {
    expect(
      queueHeading({ total: 6, awaitingFirstReview: 6, fromBrief: 6 })
    ).toBe('6 risks from your brief await first review.');
  });

  it('splits out the brief provenance when the queue is mixed in origin', () => {
    expect(
      queueHeading({ total: 6, awaitingFirstReview: 6, fromBrief: 4 })
    ).toBe('6 risks await first review, 4 of them from your brief.');
  });

  it('claims no brief provenance when none of the queue came from it', () => {
    const line = queueHeading({ total: 2, awaitingFirstReview: 2, fromBrief: 0 });
    expect(line).toBe('2 risks await first review.');
    expect(line).not.toContain('brief');
  });

  it('reframes to a look when the queue is not all first reviews', () => {
    expect(
      queueHeading({ total: 6, awaitingFirstReview: 2, fromBrief: 6 })
    ).toBe('6 risks need a look, 2 of them awaiting first review.');
    expect(
      queueHeading({ total: 3, awaitingFirstReview: 0, fromBrief: 3 })
    ).toBe('3 risks need a look.');
  });

  it('handles one', () => {
    expect(
      queueHeading({ total: 1, awaitingFirstReview: 1, fromBrief: 1 })
    ).toBe('1 risk from your brief awaits first review.');
  });

  it('returns nothing for an empty queue', () => {
    expect(queueHeading({ total: 0 })).toBeNull();
  });
});

describe('provenance and the objective relation on every risk card', () => {
  it('reads a wizard-captured risk as coming from the brief', () => {
    expect(riskProvenance(risk())).toBe('From your brief');
    expect(isFromBrief(risk())).toBe(true);
  });

  it('reads a play-accepted risk as coming from the playbook', () => {
    const r = risk({ source: 'playbook', source_id: 'play-9' });
    expect(riskProvenance(r)).toBe("From PULSE's playbook");
    expect(isFromBrief(r)).toBe(false);
  });

  // Note 7: a risk THREATENS the objective it is linked to. "vs Cost" stated
  // that the two were connected without saying how.
  it('says a risk threatens its objective, never "vs"', () => {
    expect(objectiveRelation('Cost')).toBe('threatens Cost');
    expect(objectiveRelation('Cost')).not.toContain('vs');
  });

  it('states the gap when there is no objective', () => {
    expect(objectiveRelation(null)).toBe('Needs a link');
  });
});

describe('the six seeded risks, end to end', () => {
  // The exact state the end-to-end test found on the 12-unit Lagos project:
  // six Brief risks at medium by medium, never reviewed.
  const seeded = Array.from({ length: 6 }, (_, i) =>
    risk({
      id: `risk-${i + 1}`,
      description: `Seeded risk ${i + 1}`,
      // Five threaten a non-negotiable objective; the sixth is flexible.
      linked_objective_id: i < 5 ? 'obj-cost' : 'obj-scope',
    })
  );

  it('queues all six and gives each exactly one status line', () => {
    const flagged = assessRisks(seeded, objectives, NOW).filter(
      (v) => v.assessment.needsAttention
    );
    expect(flagged).toHaveLength(6);
    for (const { risk: r, assessment } of flagged) {
      const line = statusLine(assessment, r, NOW);
      expect(line).toBe('Awaiting first review.');
    }
  });

  it('shows no escalation line on any of the six, because none is recorded', () => {
    for (const r of seeded) {
      expect(escalationLine(null)).toBeNull();
      expect(r.last_reviewed_at).toBeNull();
    }
  });

  it('heads the queue as six brief risks awaiting first review', () => {
    const flagged = assessRisks(seeded, objectives, NOW).filter(
      (v) => v.assessment.needsAttention
    );
    expect(
      queueHeading({
        total: flagged.length,
        awaitingFirstReview: flagged.filter((v) => !v.risk.last_reviewed_at).length,
        fromBrief: flagged.filter((v) => isFromBrief(v.risk)).length,
      })
    ).toBe('6 risks from your brief await first review.');
  });
});

describe('the severity legend', () => {
  it('states the derivation and every scored band with its range', () => {
    const legend = severityLegend();
    expect(legend.lead).toBe('Severity is likelihood times impact.');
    expect(legend.bands).toEqual([
      { key: 'serious', label: 'Serious', range: '6 to 9' },
      { key: 'moderate', label: 'Worth watching', range: '3 to 4' },
      { key: 'minor', label: 'Minor', range: '1 to 2' },
    ]);
  });

  // The legend is built from the bands, so it cannot drift from the rule it
  // explains.
  it('covers exactly the bands the derivation defines', () => {
    expect(severityLegend().bands.map((b) => b.key)).toEqual(
      SEVERITY_BANDS.map((b) => b.key)
    );
  });
});

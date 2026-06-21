import { describe, it, expect } from 'vitest';
import { computeInsights } from '../app/pulse/app/components/pulseRead.js';

/**
 * The PULSE read, after sub-step 1f retired Rule 3 (coverage) and Rule 5 (funding
 * governance). With milestones now the curated template, every protected
 * objective except Scope is served by a template milestone and Funding always is,
 * so the gaps those two rules detected can no longer occur. This suite proves the
 * two rules no longer fire even in the scenarios that used to trigger them, and
 * that the remaining rules (1 posture, 2 risk concentration, 4 tolerance gaps)
 * are unaffected.
 *
 * Pure, via the public computeInsights, in the node env. facts is built in the
 * shape briefModel.normalizeFacts produces.
 */

function mkFacts({ objectives, milestones = [], workstreams = [], risks = [] }) {
  return {
    objectives,
    protected: objectives.filter((o) => o.classification === 'non_negotiable'),
    flexible: objectives.filter((o) => o.classification === 'flexible'),
    objectiveById: Object.fromEntries(objectives.map((o) => [o.id, o])),
    milestones,
    workstreams,
    risks,
  };
}

const titlesOf = (facts) => computeInsights(facts).map((i) => i.title);

// The titles the retired rules used to emit (Rule 3's two cards, Rule 5's card).
const RETIRED_TITLES = [
  'Coverage gaps in the protected set',
  'Every protected objective is owned',
  'Funding is not yet trackable',
];

describe('the retired coverage and funding-governance rules no longer fire', () => {
  // The scenario the old Rule 3 and Rule 5 both fired on: protected objectives
  // (including Funding non-negotiable) with no milestones and no workstream leads.
  const objectives = [
    { id: 'obj-cost', type: 'cost', name: 'Cost', classification: 'non_negotiable', tolerance: null },
    { id: 'obj-funding', type: 'funding', name: 'Funding', classification: 'non_negotiable', tolerance: null },
    { id: 'obj-scope', type: 'scope', name: 'Scope', classification: 'flexible', tolerance: 'Down to 10 units' },
    { id: 'obj-time', type: 'time', name: 'Time', classification: 'flexible', tolerance: 'Up to 8 weeks' },
    { id: 'obj-quality', type: 'quality', name: 'Quality', classification: 'flexible', tolerance: 'BS spec' },
  ];
  const titles = titlesOf(mkFacts({ objectives, milestones: [], workstreams: [], risks: [] }));

  it('emits no coverage card, even with protected objectives wholly unlinked', () => {
    expect(titles).not.toContain('Coverage gaps in the protected set');
    expect(titles).not.toContain('Every protected objective is owned');
  });

  it('emits no funding-governance card, even with Funding non-negotiable and no milestone', () => {
    expect(titles).not.toContain('Funding is not yet trackable');
  });

  it('still emits the surviving rules (posture, risk concentration)', () => {
    expect(titles).toContain('A balanced posture'); // nn = 2
    expect(titles).toContain('No critical risks flagged'); // no critical risks, nn >= 1
  });
});

describe('the surviving rules are unaffected by the removal', () => {
  it('fires posture (first), risk concentration and tolerance gaps, contiguously numbered', () => {
    const objectives = [
      { id: 'obj-cost', type: 'cost', name: 'Cost', classification: 'non_negotiable', tolerance: null },
      { id: 'obj-scope', type: 'scope', name: 'Scope', classification: 'flexible', tolerance: null }, // no tolerance -> Rule 4
      { id: 'obj-time', type: 'time', name: 'Time', classification: 'flexible', tolerance: 'Up to 8 weeks' },
      { id: 'obj-quality', type: 'quality', name: 'Quality', classification: 'flexible', tolerance: 'BS spec' },
      { id: 'obj-funding', type: 'funding', name: 'Funding', classification: 'flexible', tolerance: 'Bridge available' },
    ];
    // A critical risk aligned to the one non-negotiable objective -> Rule 2 positive.
    const risks = [
      { num: 1, description: 'Overrun', critical: true, linkedId: 'obj-cost', likelihood: 'high', impact: 'high' },
    ];
    const insights = computeInsights(mkFacts({ objectives, risks }));
    const titles = insights.map((i) => i.title);

    expect(insights[0].title).toBe('A balanced posture'); // posture always first
    expect(titles).toContain('Risk concentrates where it should'); // Rule 2
    expect(titles).toContain('Flexibility without a limit'); // Rule 4
    for (const t of RETIRED_TITLES) expect(titles).not.toContain(t);
    // Numbering stays a contiguous 1..n after the removals.
    expect(insights.map((i) => i.n)).toEqual(insights.map((_, idx) => idx + 1));
  });

  it('posture still flags the over-constrained case, with no retired card', () => {
    const objectives = ['scope', 'cost', 'time', 'quality', 'funding'].map((type) => ({
      id: `obj-${type}`,
      type,
      name: type,
      classification: 'non_negotiable',
      tolerance: null,
    }));
    const titles = titlesOf(mkFacts({ objectives }));
    expect(titles).toContain('Every objective is non-negotiable');
    for (const t of RETIRED_TITLES) expect(titles).not.toContain(t);
  });
});

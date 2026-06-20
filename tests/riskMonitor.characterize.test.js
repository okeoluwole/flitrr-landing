import { describe, it, expect } from 'vitest';
import {
  assessRisk,
  assessRisks,
  TRIGGERS,
  EFFECTIVE_CRITICALITY,
} from '../app/pulse/app/risk/riskMonitor.js';

/**
 * Characterization net (A1) for the risk monitoring engine, captured at its
 * current home in riskMonitor before Step A7 relocates it to lib/engine/monitor
 * and rewires it onto the criticality kernel and the lifted severity module.
 * These assertions pin the four triggers, the proportional windows (critical at
 * 14 days, standard at 30), the closed short-circuit, and the attention
 * ordering, so the relocation can be proven identical. The module takes `now`
 * as an argument and never reads the clock, so a fixed NOW makes every case
 * deterministic.
 */

const NOW = Date.UTC(2026, 5, 20, 12, 0, 0); // 2026-06-20T12:00:00Z
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(NOW - n * MS_PER_DAY).toISOString();

// One non-negotiable objective and one flexible, by id.
const objectivesById = {
  nn: { classification: 'non_negotiable' },
  flex: { classification: 'flexible' },
};

function risk(overrides = {}) {
  return {
    id: 'r',
    linked_objective_id: null,
    likelihood: 'medium',
    impact: 'medium',
    status: 'watching',
    last_reviewed_at: null,
    response_note: null,
    ...overrides,
  };
}

// The part of the verdict the net pins.
function verdict(r) {
  const a = assessRisk(r, objectivesById, NOW);
  return {
    effectiveCriticality: a.effectiveCriticality,
    needsLink: a.needsLink,
    severityKey: a.severity.key,
    firedTriggers: a.firedTriggers,
    needsAttention: a.needsAttention,
  };
}

describe('the four triggers, proportional by criticality', () => {
  it('critical and serious, watching, unanswered, never reviewed: escalated, unmanaged, not yet engaged', () => {
    expect(
      verdict(
        risk({ linked_objective_id: 'nn', likelihood: 'high', impact: 'high' })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'serious',
      firedTriggers: [
        TRIGGERS.ESCALATED_SEVERITY,
        TRIGGERS.CRITICAL_UNMANAGED,
        TRIGGERS.NOT_YET_ENGAGED,
      ],
      needsAttention: true,
    });
  });

  it('critical escalates at Worth watching, while acting with a note and a fresh review', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'nn',
          status: 'acting',
          response_note: 'In hand',
          last_reviewed_at: daysAgo(5),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'moderate',
      firedTriggers: [TRIGGERS.ESCALATED_SEVERITY],
      needsAttention: true,
    });
  });

  it('critical and Minor in watching with no note: unmanaged only', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'nn',
          likelihood: 'low',
          impact: 'low',
          last_reviewed_at: daysAgo(5),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'minor',
      firedTriggers: [TRIGGERS.CRITICAL_UNMANAGED],
      needsAttention: true,
    });
  });

  it('critical goes stale at 14 days: unmanaged and went stale', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'nn',
          likelihood: 'low',
          impact: 'low',
          last_reviewed_at: daysAgo(20),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'minor',
      firedTriggers: [TRIGGERS.CRITICAL_UNMANAGED, TRIGGERS.WENT_STALE],
      needsAttention: true,
    });
  });

  it('standard escalates only at Serious', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'flex',
          likelihood: 'high',
          impact: 'high',
          last_reviewed_at: daysAgo(5),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.STANDARD,
      needsLink: false,
      severityKey: 'serious',
      firedTriggers: [TRIGGERS.ESCALATED_SEVERITY],
      needsAttention: true,
    });
  });

  it('standard and Worth watching, freshly reviewed: nothing fires', () => {
    expect(
      verdict(
        risk({ linked_objective_id: 'flex', last_reviewed_at: daysAgo(5) })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.STANDARD,
      needsLink: false,
      severityKey: 'moderate',
      firedTriggers: [],
      needsAttention: false,
    });
  });

  it('standard goes stale only at 30 days', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'flex',
          likelihood: 'low',
          impact: 'low',
          status: 'acting',
          response_note: 'noted',
          last_reviewed_at: daysAgo(40),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.STANDARD,
      needsLink: false,
      severityKey: 'minor',
      firedTriggers: [TRIGGERS.WENT_STALE],
      needsAttention: true,
    });
  });

  it('a standard risk at 20 days is not yet stale (the 30-day window holds)', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'flex',
          status: 'acting',
          response_note: 'noted',
          last_reviewed_at: daysAgo(20),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.STANDARD,
      needsLink: false,
      severityKey: 'moderate',
      firedTriggers: [],
      needsAttention: false,
    });
  });
});

describe('unlinked risks need a link, never a silent standard', () => {
  it('an unlinked, never-reviewed risk needs a link and is not yet engaged', () => {
    expect(verdict(risk({ likelihood: 'high', impact: 'high' }))).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.UNLINKED,
      needsLink: true,
      severityKey: 'serious',
      firedTriggers: [TRIGGERS.NOT_YET_ENGAGED],
      needsAttention: true,
    });
  });

  it('an unlinked but reviewed risk still needs a link (no severity threshold applies)', () => {
    expect(
      verdict(
        risk({
          likelihood: 'low',
          impact: 'low',
          status: 'acting',
          response_note: 'noted',
          last_reviewed_at: daysAgo(5),
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.UNLINKED,
      needsLink: true,
      severityKey: 'minor',
      firedTriggers: [],
      needsAttention: true,
    });
  });
});

describe('a closed risk has left the active register', () => {
  it('carries its criticality and severity but never an attention flag', () => {
    expect(
      verdict(
        risk({
          linked_objective_id: 'nn',
          likelihood: 'high',
          impact: 'high',
          status: 'closed',
        })
      )
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'serious',
      firedTriggers: [],
      needsAttention: false,
    });
  });
});

describe('an unscored critical risk', () => {
  it('does not escalate on severity but is still unmanaged and not yet engaged', () => {
    expect(
      verdict(risk({ linked_objective_id: 'nn', likelihood: undefined }))
    ).toEqual({
      effectiveCriticality: EFFECTIVE_CRITICALITY.CRITICAL,
      needsLink: false,
      severityKey: 'unscored',
      firedTriggers: [TRIGGERS.CRITICAL_UNMANAGED, TRIGGERS.NOT_YET_ENGAGED],
      needsAttention: true,
    });
  });
});

describe('assessRisks orders the attention list', () => {
  it('critical first, then unlinked, then standard; within a band most severe first', () => {
    const risks = [
      risk({ id: 'std-serious', linked_objective_id: 'flex', likelihood: 'high', impact: 'high' }),
      risk({ id: 'crit-minor', linked_objective_id: 'nn', likelihood: 'low', impact: 'low' }),
      risk({ id: 'unlinked' }),
      risk({ id: 'crit-serious', linked_objective_id: 'nn', likelihood: 'high', impact: 'high' }),
    ];
    expect(
      assessRisks(risks, objectivesById, NOW).map((x) => x.risk.id)
    ).toEqual(['crit-serious', 'crit-minor', 'unlinked', 'std-serious']);
  });
});

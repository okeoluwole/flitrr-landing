import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';

/**
 * Characterization net (A1) for the Brief's criticality reads, captured before
 * Step B3 moves them from the stored snapshot to the live derivation. Today the
 * Brief flags an item critical by its stored criticality column; these
 * assertions pin that. The items whose stored value disagrees with the
 * objective they serve (the drift cases below) are the ones B3 will change, so
 * they are called out: the net makes the intended B3 diff legible rather than
 * silent.
 */

const OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible', tolerance: 'Down to 10 units' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible', tolerance: 'Up to 8 weeks' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'non_negotiable' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible', tolerance: 'Bridge available' },
];

const state = {
  def: {
    name: 'Riverside Mews',
    project_type: 'residential',
    currency: 'GBP',
    budget: '6400000',
  },
  ctx: {},
  objectives: OBJECTIVES,
  lists: {
    risks: [
      // Aligned: stored critical, linked to a non-negotiable objective.
      { description: 'Budget overrun', linked_objective_id: 'obj-cost', criticality: 'critical', likelihood: 'high', impact: 'high' },
      { description: 'Weather delay', linked_objective_id: 'obj-time', criticality: 'standard', likelihood: 'low', impact: 'low' },
      // Drift down: stored critical on a flexible objective. B3 reads this standard.
      { description: 'Scope flagged critical', linked_objective_id: 'obj-scope', criticality: 'critical', likelihood: 'medium', impact: 'medium' },
    ],
    milestones: [
      { name: 'Cost plan signed', target_date: '2026-08-01', linked_objective_id: 'obj-cost', criticality: 'critical' },
      { name: 'Funding close', target_date: '2026-09-01', linked_objective_id: 'obj-funding', criticality: 'standard' },
    ],
    workstreams: [
      { name: 'Cost control', lead: 'A. Developer', linked_objective_id: 'obj-cost', criticality: 'critical' },
      { name: 'Programme', lead: 'B. Manager', linked_objective_id: 'obj-time', criticality: 'standard' },
    ],
    assumptions: [
      { description: 'Planning granted', linked_objective_id: 'obj-quality', criticality: 'critical' },
    ],
    constraints: [
      // Drift down: stored critical on a flexible objective. B3 reads this standard.
      { description: 'Site access window', linked_objective_id: 'obj-scope', criticality: 'critical' },
    ],
    dependencies: [
      // Drift up: stored standard on a non-negotiable objective. B3 reads this critical.
      { description: 'Grid connection', linked_objective_id: 'obj-quality', criticality: 'standard' },
    ],
  },
};

const brief = assembleBrief(state);
const riskByDesc = (d) => brief.risks.list.find((r) => r.description === d);
const milestoneByName = (n) => brief.milestones.find((m) => m.name === n);
const workstreamByName = (n) => brief.workstreams.find((w) => w.name === n);
const kpi = (key) => brief.kpis.find((k) => k.key === key)?.value;

describe('the Brief counts risks critical by the stored snapshot (pre-B3)', () => {
  it('counts the two stored-critical risks, including the drift case', () => {
    expect(brief.risks.criticalCount).toBe(2);
    expect(kpi('risks')).toBe('2');
  });

  it('flags each risk by its stored column', () => {
    expect(riskByDesc('Budget overrun').critical).toBe(true);
    expect(riskByDesc('Weather delay').critical).toBe(false);
    // Drift: stored critical on a flexible objective. B3 will read this false.
    expect(riskByDesc('Scope flagged critical').critical).toBe(true);
  });
});

describe('milestones and workstreams flag critical by the stored snapshot', () => {
  it('reads the stored milestone criticality', () => {
    expect(milestoneByName('Cost plan signed').critical).toBe(true);
    expect(milestoneByName('Funding close').critical).toBe(false);
  });

  it('reads the stored workstream criticality', () => {
    expect(workstreamByName('Cost control').critical).toBe(true);
    expect(workstreamByName('Programme').critical).toBe(false);
  });
});

describe('RAID items flag critical by the stored snapshot', () => {
  it('reads each RAID sibling by its stored column, including both drift cases', () => {
    expect(brief.raid.assumptions[0].critical).toBe(true);
    // Drift down: stored critical on a flexible objective. B3 reads this false.
    expect(brief.raid.constraints[0].critical).toBe(true);
    // Drift up: stored standard on a non-negotiable objective. B3 reads this true.
    expect(brief.raid.dependencies[0].critical).toBe(false);
  });
});

describe('objective counts come straight from the classifications', () => {
  it('counts two non-negotiable and three flexible (unchanged by B3)', () => {
    expect(brief.objectives.counts).toEqual({
      nonNegotiable: 2,
      flexible: 3,
      total: 5,
    });
    expect(kpi('protected')).toBe('2 of 5');
  });
});

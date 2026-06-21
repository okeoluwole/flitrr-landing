import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';

/**
 * The Brief's criticality reads, after Step B3 moved them from the stored
 * criticality column to a live derivation from the linked objective (the kernel
 * rule the risk register and the Action Log read on). This began life as the A1
 * characterization net that pinned the old stored reading; B3 is the one step
 * its assertions were always meant to move, and they now pin the live
 * expectation. The drift cases (an item whose stored column disagrees with the
 * objective it serves) are the proof the preview follows the classification,
 * not the frozen column.
 *
 * This covers the live PREVIEW only. A locked Brief renders its frozen snapshot
 * and never re-runs this assembler, so its values do not move; that guarantee
 * is covered in briefLiveCriticality.test.js.
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
      // Drift down: stored critical on a flexible objective; the live read is standard.
      { description: 'Scope flagged critical', linked_objective_id: 'obj-scope', criticality: 'critical', likelihood: 'medium', impact: 'medium' },
    ],
    // Milestones now come from the curated programme template (sub-step 1e),
    // keyed to an objective by the type each serves, so they are not listed here.
    // Their live criticality is asserted below by template milestone name.
    workstreams: [
      { name: 'Cost control', lead: 'A. Developer', linked_objective_id: 'obj-cost', criticality: 'critical' },
      { name: 'Programme', lead: 'B. Manager', linked_objective_id: 'obj-time', criticality: 'standard' },
    ],
    assumptions: [
      { description: 'Planning granted', linked_objective_id: 'obj-quality', criticality: 'critical' },
    ],
    constraints: [
      // Drift down: stored critical on a flexible objective; the live read is standard.
      { description: 'Site access window', linked_objective_id: 'obj-scope', criticality: 'critical' },
    ],
    dependencies: [
      // Drift up: stored standard on a non-negotiable objective; the live read is critical.
      { description: 'Grid connection', linked_objective_id: 'obj-quality', criticality: 'standard' },
    ],
  },
};

const brief = assembleBrief(state);
const riskByDesc = (d) => brief.risks.list.find((r) => r.description === d);
const milestoneByName = (n) => brief.milestones.find((m) => m.name === n);
const workstreamByName = (n) => brief.workstreams.find((w) => w.name === n);
const kpi = (key) => brief.kpis.find((k) => k.key === key)?.value;

describe('the Brief counts risks critical by the live objective link', () => {
  it('counts only the risks whose linked objective is non-negotiable', () => {
    // Budget overrun (cost, non-negotiable) is the only live-critical risk.
    // Scope flagged critical drifts down: stored critical, but scope is flexible.
    expect(brief.risks.criticalCount).toBe(1);
    expect(kpi('risks')).toBe('1');
  });

  it('flags each risk by its linked objective, not its stored column', () => {
    expect(riskByDesc('Budget overrun').critical).toBe(true);
    expect(riskByDesc('Weather delay').critical).toBe(false);
    // Drift down: stored critical on a flexible objective now reads false.
    expect(riskByDesc('Scope flagged critical').critical).toBe(false);
  });
});

describe('milestones and workstreams flag critical by the live objective link', () => {
  it('derives the milestone criticality from its served objective (template)', () => {
    // Heads of terms agreed serves Cost (non-negotiable here); Development
    // finance committed serves Funding (flexible here).
    expect(milestoneByName('Heads of terms agreed').critical).toBe(true);
    expect(milestoneByName('Development finance committed').critical).toBe(false);
  });

  it('derives the workstream criticality from its objective', () => {
    expect(workstreamByName('Cost control').critical).toBe(true);
    expect(workstreamByName('Programme').critical).toBe(false);
  });
});

describe('RAID items flag critical by the live objective link', () => {
  it('derives each RAID sibling from its objective, including both drift cases', () => {
    expect(brief.raid.assumptions[0].critical).toBe(true);
    // Drift down: stored critical on a flexible objective now reads false.
    expect(brief.raid.constraints[0].critical).toBe(false);
    // Drift up: stored standard on a non-negotiable objective now reads true.
    expect(brief.raid.dependencies[0].critical).toBe(true);
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

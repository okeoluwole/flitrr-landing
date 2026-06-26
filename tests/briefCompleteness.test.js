import { describe, it, expect } from 'vitest';
import { checkCompleteness } from '../app/pulse/app/components/briefCompleteness.js';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';
import {
  emptyProgrammeChoices,
  setMilestoneChoice,
} from '../app/pulse/app/components/programmeChoices.js';

/**
 * Brief completeness, milestone rules (Step 7, sub-step 1f). 1d/1e moved Step 7's
 * milestones to the curated template, with each chosen date in the gate rows'
 * milestone_choices. 1f re-points the completeness gate's two milestone rules off
 * the legacy project_milestones list and onto the template plus the gate choices,
 * so a fresh project with no legacy rows is assessed on exactly what Step 7 shows.
 * This suite proves:
 *   - the required existence rule passes for a fresh project (template milestones
 *     are always present);
 *   - the recommended dates rule flags undated milestones and clears once every
 *     template milestone has a gate-choice date, counting applicable stages only;
 *   - the non-milestone rules are unaffected.
 *
 * Pure, via the public checkCompleteness, in the node env (no component testing).
 */

const OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'non_negotiable' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
];

// Total template milestones across the eight stages (stage 5 has two): 9.
// Milestones sit under each stage's activities now, read through stageMilestones.
const TEMPLATE_MILESTONE_COUNT = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
  stageMilestones(s)
).length;

const emptyGates = () => emptyProgrammeChoices().stages;

// Gates with a chosen date on every template milestone, keyed by stable key.
const allDatedGates = () =>
  emptyProgrammeChoices().stages.map((g) => {
    const tmpl = PROGRAMME_TEMPLATE.stages.find((s) => s.stage === g.stage);
    let next = g;
    for (const m of stageMilestones(tmpl)) {
      next = setMilestoneChoice(next, m.key, {
        target_date: '2026-06-01',
        note: '',
      });
    }
    return next;
  });

// A state with no legacy project_milestones rows: milestones come from the
// template and the gate choices.
function stateWith(gates, overrides = {}) {
  return {
    def: { name: 'Test Project', start_date: '2026-01-05' },
    ctx: {},
    objectives: OBJECTIVES,
    rankOrder: ['scope', 'cost', 'time', 'quality', 'funding'],
    lists: { milestones: [], workstreams: [], risks: [] },
    gates,
    ...overrides,
  };
}

const required = (res, key) => res.required.find((r) => r.key === key);
const recommended = (res, key) => res.recommended.find((r) => r.key === key);

describe('the required milestone rule reflects the template, not legacy rows', () => {
  it('passes for a fresh project with no project_milestones rows', () => {
    const res = checkCompleteness(stateWith(emptyGates()));
    expect(required(res, 'milestone').ok).toBe(true);
  });

  it('passes even with no gate choices supplied at all (template still applies)', () => {
    const res = checkCompleteness(stateWith(undefined));
    expect(required(res, 'milestone').ok).toBe(true);
  });
});

describe('the recommended milestone-dates rule reads the gate choices', () => {
  it('flags every milestone as undated when no gate dates are set', () => {
    const rule = recommended(checkCompleteness(stateWith(emptyGates())), 'milestoneDates');
    expect(rule.ok).toBe(false);
    expect(rule.detail).toBe(`0 of ${TEMPLATE_MILESTONE_COUNT} set`);
  });

  it('still flags when only some milestones are dated', () => {
    let gates = emptyGates();
    gates[0] = setMilestoneChoice(gates[0], 'heads_of_terms', {
      target_date: '2026-02-10',
      note: '',
    });
    const rule = recommended(checkCompleteness(stateWith(gates)), 'milestoneDates');
    expect(rule.ok).toBe(false);
    expect(rule.detail).toBe(`1 of ${TEMPLATE_MILESTONE_COUNT} set`);
  });

  it('clears once every template milestone has a gate-choice date', () => {
    const rule = recommended(checkCompleteness(stateWith(allDatedGates())), 'milestoneDates');
    expect(rule.ok).toBe(true);
    expect(rule.detail).toBe(
      `${TEMPLATE_MILESTONE_COUNT} of ${TEMPLATE_MILESTONE_COUNT} set`
    );
  });

  it('counts applicable stages only: a not-applicable stage drops its milestone from the tally', () => {
    let gates = allDatedGates();
    gates[3] = { ...gates[3], target_na: true }; // stage 3 (one milestone) not applicable
    const rule = recommended(checkCompleteness(stateWith(gates)), 'milestoneDates');
    expect(rule.ok).toBe(true);
    expect(rule.detail).toBe(
      `${TEMPLATE_MILESTONE_COUNT - 1} of ${TEMPLATE_MILESTONE_COUNT - 1} set`
    );
  });
});

describe('the non-milestone completeness rules are unaffected', () => {
  it('the workstream and risk required rules still read the lists', () => {
    const res = checkCompleteness(
      stateWith(emptyGates(), {
        lists: {
          milestones: [],
          workstreams: [{ name: 'Delivery' }],
          risks: [{ description: 'Overrun' }],
        },
      })
    );
    expect(required(res, 'workstream').ok).toBe(true);
    expect(required(res, 'risk').ok).toBe(true);
  });

  it('a milestone-date change does not move a non-milestone rule', () => {
    const base = checkCompleteness(stateWith(emptyGates()));
    const dated = checkCompleteness(stateWith(allDatedGates()));
    expect(required(dated, 'name').ok).toBe(required(base, 'name').ok);
    expect(required(dated, 'funding').ok).toBe(required(base, 'funding').ok);
  });
});

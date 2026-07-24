import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';
import {
  buildObjectiveIndex,
  classifyByType,
  CRITICALITY,
} from '../lib/engine/criticality.js';
import {
  emptyProgrammeChoices,
  setMilestoneChoice,
} from '../app/pulse/app/components/programmeChoices.js';

/**
 * Brief milestones (Step 7, sub-step 1e). After 1d made Step 7's milestones the
 * curated template (with each developer's date and note stored in the gate rows'
 * milestone_choices, keyed by the stable key, and criticality derived live from
 * the served objective), the Brief still sourced its Critical milestones from the
 * legacy project_milestones list and so diverged from Step 7. This suite proves
 * the Brief now renders the same milestones as Step 7:
 *   - the milestone list is the template, with criticality from the kernel;
 *   - a chosen date and note flow through from milestone_choices, by stable key;
 *   - ordering is by stage (lifecycle), with undated milestones kept in place and
 *     a not-applicable stage dropped;
 *   - a locked Brief renders its frozen snapshot, never a re-derivation.
 *
 * Pure, via the public assembleBrief, in the node env (no component testing in
 * this repo). The Brief renders model.milestones directly, so equality at the
 * model level is equality at the rendered document.
 */

// Full objective set with known classifications: Cost and Quality non-negotiable,
// the rest flexible. So template milestones serving Cost or Quality are critical;
// those serving Scope, Time or Funding are standard.
const OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'non_negotiable' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
];

// Every template milestone, flattened in stage (lifecycle) order: the exact set,
// in the exact order, the Brief must reproduce. Milestones sit under each stage's
// activities now, so read them through stageMilestones.
const templateMilestones = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
  stageMilestones(s).map((m) => ({
    stage: s.stage,
    key: m.key,
    name: m.name,
    serves: m.serves,
  }))
);

const emptyGates = () => emptyProgrammeChoices().stages;

function stateWith(gates, objectives = OBJECTIVES) {
  return {
    def: {
      name: 'Test Project',
      project_type: 'residential',
      currency: 'GBP',
      start_date: '2026-01-05',
    },
    ctx: {},
    objectives,
    // The legacy list is left empty on purpose: the Brief must take its
    // milestones from the template and the gate choices, not from here.
    lists: {
      milestones: [],
      workstreams: [],
      risks: [],
      assumptions: [],
      constraints: [],
      dependencies: [],
    },
    gates,
  };
}

const byName = (model, name) => model.milestones.find((m) => m.name === name);

describe('the Brief milestone list is the curated template, not project_milestones', () => {
  const brief = assembleBrief(stateWith(emptyGates()));

  it('lists every template milestone, by name, with nothing else', () => {
    expect(brief.milestones.map((m) => m.name)).toEqual(
      templateMilestones.map((m) => m.name)
    );
  });

  it('derives each milestone criticality from the objective it serves, via the kernel', () => {
    const { byType } = buildObjectiveIndex(OBJECTIVES);
    brief.milestones.forEach((m, i) => {
      const expected =
        classifyByType(templateMilestones[i].serves, byType) ===
        CRITICALITY.CRITICAL;
      expect(m.critical).toBe(expected);
    });
    // Concretely: Heads of terms (Cost, non-negotiable) is critical; Planning
    // application validated (Time, flexible) is not.
    expect(byName(brief, 'Heads of terms agreed').critical).toBe(true);
    expect(byName(brief, 'Planning application validated').critical).toBe(false);
  });

  it('tracks the live classification: relaxing Cost drops its milestones to standard', () => {
    const relaxed = OBJECTIVES.map((o) =>
      o.objective_type === 'cost' ? { ...o, classification: 'flexible' } : o
    );
    const preview = assembleBrief(stateWith(emptyGates(), relaxed));
    expect(byName(preview, 'Heads of terms agreed').critical).toBe(false);
    expect(byName(preview, 'Tenders returned').critical).toBe(false);
  });

  it('never renders the four drill-down milestones (only headline milestones surface)', () => {
    // The drill-down milestones are not developer-facing, so no Brief render shows
    // them: the Brief lists exactly the nine headline template milestones.
    const brief = assembleBrief(stateWith(emptyGates()));
    const names = brief.milestones.map((m) => m.name);
    for (const name of [
      'Brief and feasibility confirmed',
      'Consultant scope agreed',
      'Developed design complete',
      'Substructure complete',
    ]) {
      expect(names).not.toContain(name);
    }
    expect(names).toEqual(templateMilestones.map((m) => m.name));
    expect(names).toHaveLength(9);
  });
});

describe("a milestone's chosen date and note flow through to the Brief, by stable key", () => {
  it('carries the chosen date (day-precise) and the note onto the right milestone', () => {
    let gates = emptyGates();
    // Stage 0, heads_of_terms: a date and a note, keyed by the stable key.
    gates[0] = setMilestoneChoice(gates[0], 'heads_of_terms', {
      target_date: '2026-02-10',
      note: 'Subject to survey',
    });
    const brief = assembleBrief(stateWith(gates));

    const heads = byName(brief, 'Heads of terms agreed');
    expect(heads.dateDisplay).toBe('10 Feb 2026');
    expect(heads.note).toBe('Subject to survey');

    // An untouched milestone carries neither a date nor a note.
    const planning = byName(brief, 'Planning application validated');
    expect(planning.dateDisplay).toBeNull();
    expect(planning.note).toBeNull();
  });

  it('binds the choice by key, not position, across a stage with two milestones', () => {
    let gates = emptyGates();
    // Stage 5 has two milestones; record a note against "finishing" only.
    gates[5] = setMilestoneChoice(gates[5], 'finishing', {
      target_date: '2027-09-01',
      note: 'Snagging window agreed',
    });
    const brief = assembleBrief(stateWith(gates));

    const finishing = byName(brief, 'Finishing complete');
    const superstructure = byName(brief, 'Superstructure complete');
    expect(finishing.dateDisplay).toBe('1 Sep 2027');
    expect(finishing.note).toBe('Snagging window agreed');
    // The other stage 5 milestone is untouched: nothing bled across by position.
    expect(superstructure.dateDisplay).toBeNull();
    expect(superstructure.note).toBeNull();
  });
});

describe('ordering is by stage (lifecycle), with undated milestones kept in place', () => {
  it('keeps lifecycle order even when a late milestone is dated and earlier ones are not', () => {
    let gates = emptyGates();
    // Date a LATE milestone (stage 7) but leave the stage 0 one undated. A
    // date-first sort would pull stage 7 to the front; stage order must not.
    gates[7] = setMilestoneChoice(gates[7], 'first_exchange', {
      target_date: '2027-06-01',
      note: '',
    });
    const brief = assembleBrief(stateWith(gates));

    expect(brief.milestones.map((m) => m.name)).toEqual(
      templateMilestones.map((m) => m.name)
    );
    // The undated stage 0 milestone leads; the dated stage 7 milestone is last.
    expect(brief.milestones[0].name).toBe('Heads of terms agreed');
    expect(brief.milestones[0].dateDisplay).toBeNull();
    const last = brief.milestones[brief.milestones.length - 1];
    expect(last.name).toBe('First unit exchanged');
    expect(last.dateDisplay).toBe('1 Jun 2027');
  });

  it('drops a not-applicable stage milestones, keeping the rest in order', () => {
    let gates = emptyGates();
    gates[3].target_na = true; // stage 3 (Design and Planning Approvals) not applicable
    const brief = assembleBrief(stateWith(gates));

    const names = brief.milestones.map((m) => m.name);
    expect(names).not.toContain('Planning application validated');
    expect(names).toEqual(
      templateMilestones.filter((m) => m.stage !== 3).map((m) => m.name)
    );
  });
});

describe('a locked Brief renders the frozen milestone snapshot, never a re-derivation', () => {
  it('keeps the snapshot milestones after the objectives are reclassified', () => {
    const gates = emptyGates();
    // Assembled at lock: Cost non-negotiable, so its milestones are critical.
    const atLock = assembleBrief(stateWith(gates, OBJECTIVES));
    // The snapshot persisted to project_briefs.content (jsonb) and read back.
    const snapshot = JSON.parse(JSON.stringify(atLock));
    expect(byName(atLock, 'Heads of terms agreed').critical).toBe(true);

    // Later, Cost is reclassified flexible. A fresh preview re-derives.
    const relaxed = OBJECTIVES.map((o) =>
      o.objective_type === 'cost' ? { ...o, classification: 'flexible' } : o
    );
    const preview = assembleBrief(stateWith(gates, relaxed));
    expect(byName(preview, 'Heads of terms agreed').critical).toBe(false);

    // The locked snapshot does not move with the world: it is rendered as-is.
    expect(byName(snapshot, 'Heads of terms agreed').critical).toBe(true);
  });

  it('the snapshot milestone carries no objective link, so it can only be read as frozen', () => {
    const atLock = assembleBrief(stateWith(emptyGates(), OBJECTIVES));
    const snapshot = JSON.parse(JSON.stringify(atLock));
    const heads = byName(snapshot, 'Heads of terms agreed');
    expect(heads).toHaveProperty('critical');
    expect(heads).not.toHaveProperty('linkedId');
    expect(heads).not.toHaveProperty('serves');
    expect(heads).not.toHaveProperty('linked_objective_id');
  });
});

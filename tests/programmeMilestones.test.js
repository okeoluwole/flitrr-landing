import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';
import { deriveMilestoneView } from '../lib/engine/programmeMilestones.js';
import {
  buildObjectiveIndex,
  classifyByType,
  CRITICALITY,
} from '../lib/engine/criticality.js';
import {
  emptyProgrammeChoices,
  setMilestoneChoice,
  gateRowPatch,
  programmeChoicesFromRows,
} from '../app/pulse/app/components/programmeChoices.js';

/**
 * Programme milestone view (Step 7, sub-step 1d). Proves the locked template set
 * with no free milestones, the criticality derived live from the served
 * objective via the kernel (the same rule risks derive on), a not-applicable
 * stage hiding its milestones, the chosen date and note round-tripping by the
 * stable key, and the date window following the surrounding chosen gate dates.
 *
 * Pure throughout, like the 1a and 1b suites: the persistence is taken out of
 * the loop by the 1b mappers (gateRowPatch then programmeChoicesFromRows), so a
 * round-trip is exactly what saveProgrammeChoices writes and loadProgrammeChoices
 * reads, fed straight into the view.
 */

// The project's five objective rows, each with an id and a classification. The
// view joins a milestone's served objective_type to these. KNOWN below makes
// Cost and Quality non-negotiable, the rest flexible.
const KNOWN = { cost: 'non_negotiable', quality: 'non_negotiable' };
const objectivesWith = (overrides = {}) =>
  ['scope', 'cost', 'time', 'quality', 'funding'].map((type) => ({
    id: `obj-${type}`,
    objective_type: type,
    classification: overrides[type] ?? 'flexible',
  }));

// Every template milestone, flattened to { stage, key, name, serves }, the
// canonical set the view must reproduce exactly. Milestones now sit under each
// stage's activities, so read them through stageMilestones (the same flatten the
// view uses), which preserves the one-level order.
const templateMilestones = PROGRAMME_TEMPLATE.stages.flatMap((s) =>
  stageMilestones(s).map((m) => ({
    stage: s.stage,
    key: m.key,
    name: m.name,
    serves: m.serves,
  }))
);

const viewStage = (view, n) => view.stages.find((s) => s.stage === n);
const allViewMilestones = (view) =>
  view.stages.flatMap((s) => s.milestones.map((m) => ({ stage: s.stage, ...m })));

// Persist the choices through the 1b mappers and read them back, Supabase out of
// the loop, mirroring the round-trip helper in programmeChoices.test.js.
const persistAndReload = (choices) => {
  const rows = choices.stages.map((s) => ({
    id: s.id,
    stage: s.stage,
    ...gateRowPatch(s),
  }));
  return programmeChoicesFromRows(rows);
};

describe('the locked milestone set matches the template, with no free milestones', () => {
  const view = deriveMilestoneView(
    PROGRAMME_TEMPLATE,
    emptyProgrammeChoices(),
    objectivesWith(KNOWN),
    ''
  );

  it('reproduces every template milestone, by key, name and served objective', () => {
    const got = allViewMilestones(view).map((m) => ({
      stage: m.stage,
      key: m.key,
      name: m.name,
      serves: m.serves,
    }));
    expect(got).toEqual(templateMilestones);
  });

  it('adds no milestone the template does not define (no free milestones)', () => {
    // Same count and the exact same keys per stage: nothing free can creep in,
    // since the view is built straight from the template's milestones.
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      const vs = viewStage(view, stage.stage);
      expect(vs.milestones.map((m) => m.key)).toEqual(
        stageMilestones(stage).map((m) => m.key)
      );
    }
    expect(allViewMilestones(view)).toHaveLength(templateMilestones.length);
  });

  it('gives Construction (stage 5) its two milestones, in order', () => {
    expect(viewStage(view, 5).milestones.map((m) => m.name)).toEqual([
      'Superstructure complete',
      'Finishing complete',
    ]);
  });
});

describe('criticality is derived live from the served objective via the kernel', () => {
  const objectives = objectivesWith(KNOWN);
  const { byType } = buildObjectiveIndex(objectives);
  const view = deriveMilestoneView(
    PROGRAMME_TEMPLATE,
    emptyProgrammeChoices(),
    objectives,
    ''
  );

  it('equals the kernel applied to each milestone served objective', () => {
    for (const m of allViewMilestones(view)) {
      expect(m.criticality).toBe(classifyByType(m.serves, byType));
    }
  });

  it('is critical for a milestone serving a non-negotiable objective', () => {
    // Heads of terms serves Cost (non-negotiable here); Finishing serves Quality.
    expect(viewStage(view, 0).milestones[0].criticality).toBe(
      CRITICALITY.CRITICAL
    );
    const finishing = viewStage(view, 5).milestones.find(
      (m) => m.key === 'finishing'
    );
    expect(finishing.criticality).toBe(CRITICALITY.CRITICAL);
  });

  it('is standard for a milestone serving a flexible objective', () => {
    // Planning application validated serves Time (flexible here).
    expect(viewStage(view, 3).milestones[0].criticality).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('tracks the current classification (live, not a stored snapshot)', () => {
    // Reclassify Cost to flexible: the Cost-serving milestone follows it down.
    const relaxed = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      emptyProgrammeChoices(),
      objectivesWith({ quality: 'non_negotiable' }),
      ''
    );
    expect(relaxed.stages[0].milestones[0].serves).toBe('cost');
    expect(relaxed.stages[0].milestones[0].criticality).toBe(
      CRITICALITY.STANDARD
    );
  });

  it('never stores criticality: the persisted choice carries only date and note', () => {
    let choices = emptyProgrammeChoices();
    choices.stages[0] = setMilestoneChoice(choices.stages[0], 'heads_of_terms', {
      target_date: '2026-02-10',
      note: 'Critical one',
    });
    const patch = gateRowPatch(choices.stages[0]);
    for (const key of Object.keys(patch.milestone_choices)) {
      expect(Object.keys(patch.milestone_choices[key]).sort()).toEqual([
        'note',
        'target_date',
      ]);
    }
  });
});

describe('a not-applicable stage hides its milestones', () => {
  const choices = emptyProgrammeChoices();
  choices.stages[3].target_na = true; // stage 3 marked not applicable at the gate

  const view = deriveMilestoneView(
    PROGRAMME_TEMPLATE,
    choices,
    objectivesWith(KNOWN),
    ''
  );

  it('marks the stage not applicable and surfaces no milestones or flags', () => {
    const stage3 = viewStage(view, 3);
    expect(stage3.applicable).toBe(false);
    expect(stage3.milestones).toEqual([]);
    expect(stage3.locationSensitive).toEqual([]);
  });

  it('leaves the applicable stages with their milestones', () => {
    expect(viewStage(view, 5).applicable).toBe(true);
    expect(viewStage(view, 5).milestones).toHaveLength(2);
  });
});

describe('the chosen date and note round-trip by the stable key', () => {
  it('binds a stored date and note to the right milestone, never by position', () => {
    let choices = emptyProgrammeChoices();
    choices.stages.forEach((s, i) => {
      s.id = `row-${i}`;
    });
    // Stage 5 has two milestones; record a choice against "finishing" only.
    choices.stages[5] = setMilestoneChoice(choices.stages[5], 'finishing', {
      target_date: '2027-01-15',
      note: 'After superstructure',
    });

    const reloaded = persistAndReload(choices);
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      reloaded,
      objectivesWith(KNOWN),
      ''
    );

    const stage5 = viewStage(view, 5);
    const finishing = stage5.milestones.find((m) => m.key === 'finishing');
    const superstructure = stage5.milestones.find(
      (m) => m.key === 'superstructure'
    );
    expect(finishing.date).toBe('2027-01-15');
    expect(finishing.note).toBe('After superstructure');
    // Nothing bled across to the untouched milestone by position.
    expect(superstructure.date).toBe('');
    expect(superstructure.note).toBe('');
  });

  it('round-trips a note with no date, and a date with no note', () => {
    let choices = emptyProgrammeChoices();
    choices.stages.forEach((s, i) => {
      s.id = `row-${i}`;
    });
    choices.stages[2] = setMilestoneChoice(choices.stages[2], 'lead_consultant', {
      target_date: '',
      note: 'Interviews scheduled',
    });
    choices.stages[0] = setMilestoneChoice(choices.stages[0], 'heads_of_terms', {
      target_date: '2026-02-10',
      note: '',
    });

    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      persistAndReload(choices),
      objectivesWith(KNOWN),
      ''
    );
    const lead = viewStage(view, 2).milestones[0];
    const heads = viewStage(view, 0).milestones[0];
    expect(lead.note).toBe('Interviews scheduled');
    expect(lead.date).toBe('');
    expect(heads.date).toBe('2026-02-10');
    expect(heads.note).toBe('');
  });
});

describe('the date window follows the surrounding chosen gate dates', () => {
  it('bounds a milestone below by the previous gate and above by its own gate', () => {
    const choices = emptyProgrammeChoices();
    choices.stages[2].target_date = '2026-06-01'; // stage 2 gate chosen
    choices.stages[3].target_date = '2026-09-01'; // stage 3 gate chosen

    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      choices,
      objectivesWith(KNOWN),
      '2026-01-05' // project start
    );

    // Stage 0 (first applicable): lower bound is the project start; its own gate
    // is undated, so the upper bound is open.
    expect(viewStage(view, 0).milestones[0].minDate).toBe('2026-01-05');
    expect(viewStage(view, 0).milestones[0].maxDate).toBeNull();

    // Stage 3: lower bound is stage 2's chosen gate, upper bound is its own.
    expect(viewStage(view, 3).milestones[0].minDate).toBe('2026-06-01');
    expect(viewStage(view, 3).milestones[0].maxDate).toBe('2026-09-01');

    // Stage 2: its previous gate (stage 1) is undated, so the lower bound is
    // open; its own chosen gate is the upper bound.
    expect(viewStage(view, 2).milestones[0].minDate).toBeNull();
    expect(viewStage(view, 2).milestones[0].maxDate).toBe('2026-06-01');
  });

  it('skips a not-applicable stage when finding the previous gate', () => {
    const choices = emptyProgrammeChoices();
    choices.stages[1].target_date = '2026-04-01'; // stage 1 gate chosen
    choices.stages[2].target_na = true; // stage 2 not applicable

    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      choices,
      objectivesWith(KNOWN),
      '2026-01-05'
    );

    // Stage 3's lower bound is stage 1's gate, the nearest applicable gate below,
    // since stage 2 is skipped and carries no date.
    expect(viewStage(view, 3).milestones[0].minDate).toBe('2026-04-01');
  });

  it('leaves both bounds open when no surrounding gate is dated', () => {
    const view = deriveMilestoneView(
      PROGRAMME_TEMPLATE,
      emptyProgrammeChoices(),
      objectivesWith(KNOWN),
      '' // no project start either
    );
    const heads = viewStage(view, 0).milestones[0];
    expect(heads.minDate).toBeNull();
    expect(heads.maxDate).toBeNull();
  });
});

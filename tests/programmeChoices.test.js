import { describe, it, expect } from 'vitest';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';
import { deriveAdvisedDates } from '../lib/engine/programmeSchedule.js';
import {
  emptyProgrammeChoices,
  programmeChoicesFromRows,
  gateChoiceFromRow,
  gateRowPatch,
  serializeMilestoneChoices,
  deserializeMilestoneChoices,
  getMilestoneChoice,
  setMilestoneChoice,
} from '../app/pulse/app/components/programmeChoices.js';

/**
 * Programme choices persistence (Step 7, sub-step 1b). Proves the round-trip
 * through the stored shape, the empty default, an N/A flag on a gate, a note on
 * a milestone, that milestone choices are keyed by the stable key and survive a
 * reorder of the template array, and that no advised date is ever stored.
 *
 * Supabase is taken out of the loop: the pure mappers carry the round-trip, so
 * a write is gateRowPatch (plus the id and stage the row already holds) and a
 * read is programmeChoicesFromRows, exactly what saveProgrammeChoices writes and
 * loadProgrammeChoices reads.
 */
function roundTrip(choices) {
  const rows = choices.stages.map((s) => ({
    id: s.id,
    stage: s.stage,
    ...gateRowPatch(s),
  }));
  return programmeChoicesFromRows(rows);
}

describe('the empty default state', () => {
  const empty = emptyProgrammeChoices();

  it('has one entry per template stage, 0 to 7, with nothing chosen', () => {
    expect(empty.stages.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const s of empty.stages) {
      expect(s.id).toBeNull();
      expect(s.target_date).toBe('');
      expect(s.target_na).toBe(false);
      expect(s.milestones).toEqual({});
    }
  });

  it('stores nothing for an untouched stage: every field is null or false', () => {
    expect(gateRowPatch(empty.stages[0])).toEqual({
      target_date: null,
      target_na: false,
      milestone_choices: null,
    });
  });

  it('round-trips back to the empty default unchanged', () => {
    expect(roundTrip(empty)).toEqual(empty);
  });
});

describe('write then read round-trip', () => {
  it('preserves chosen gate dates, the N/A flag and milestone choices', () => {
    const choices = emptyProgrammeChoices();
    // Stage 0: a chosen gate date, plus a milestone date keyed by stable key.
    choices.stages[0].target_date = '2026-03-01';
    choices.stages[0] = setMilestoneChoice(choices.stages[0], 'heads_of_terms', {
      target_date: '2026-02-10',
      note: '',
    });
    // Stage 1: marked not applicable.
    choices.stages[1].target_na = true;
    // Stage 5: a milestone note with no date.
    choices.stages[5] = setMilestoneChoice(choices.stages[5], 'finishing', {
      target_date: '',
      note: 'Snagging window agreed with the contractor',
    });
    // Ids as a loaded project would carry on its seeded rows.
    choices.stages.forEach((s, i) => {
      s.id = `row-${i}`;
    });

    expect(roundTrip(choices)).toEqual(choices);
  });
});

describe('N/A persisted on a gate', () => {
  it('writes the N/A flag, stores no date, and reads both back', () => {
    const stage = {
      id: 'g3',
      stage: 3,
      target_date: '',
      target_na: true,
      milestones: {},
    };
    const patch = gateRowPatch(stage);
    expect(patch.target_na).toBe(true);
    expect(patch.target_date).toBeNull();

    const back = gateChoiceFromRow({ ...patch, id: 'g3', stage: 3 });
    expect(back.target_na).toBe(true);
    expect(back.target_date).toBe('');
  });
});

describe('a note persisted on a milestone', () => {
  it('stores the note (with a null date) and reads it back as a string', () => {
    const stage = setMilestoneChoice(
      { id: 'g2', stage: 2, target_date: '', target_na: false, milestones: {} },
      'lead_consultant',
      { target_date: '', note: 'Interviews scheduled' }
    );

    const stored = serializeMilestoneChoices(stage.milestones);
    expect(stored).toEqual({
      lead_consultant: { target_date: null, note: 'Interviews scheduled' },
    });

    const back = deserializeMilestoneChoices(stored);
    expect(back.lead_consultant.note).toBe('Interviews scheduled');
    expect(back.lead_consultant.target_date).toBe('');
  });
});

describe('milestone choices are keyed by the stable key', () => {
  it('gives every template milestone a non-empty key, unique within its stage', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      const keys = stageMilestones(stage).map((m) => m.key);
      for (const k of keys) {
        expect(typeof k).toBe('string');
        expect(k.length).toBeGreaterThan(0);
      }
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('keeps a choice bound to its milestone when the template array is reordered', () => {
    // Stage 5 has two milestones. Record a choice against "finishing".
    let stage5 = {
      id: 'g5',
      stage: 5,
      target_date: '',
      target_na: false,
      milestones: {},
    };
    stage5 = setMilestoneChoice(stage5, 'finishing', {
      target_date: '2027-01-15',
      note: 'After superstructure',
    });

    const templateStage5 = PROGRAMME_TEMPLATE.stages.find((s) => s.stage === 5);
    // Reverse a copy of the template milestones, as a later template edit might.
    // The position changes; the stable keys do not. Milestones sit under the
    // stage's activities now, read through stageMilestones.
    const reordered = [...stageMilestones(templateStage5)].reverse();
    expect(reordered[0].key).toBe('finishing'); // was last, now first

    // Look every milestone up by its key, never by index.
    const finishing = getMilestoneChoice(stage5, reordered[0].key);
    const superstructure = getMilestoneChoice(stage5, reordered[1].key);
    expect(finishing).toEqual({
      target_date: '2027-01-15',
      note: 'After superstructure',
    });
    // The untouched milestone still reads empty, so nothing bled across by position.
    expect(superstructure).toEqual({ target_date: '', note: '' });
  });
});

describe('no advised date is ever stored', () => {
  it('a stored gate patch carries only the three choice fields', () => {
    const stage = setMilestoneChoice(
      {
        id: 'g0',
        stage: 0,
        target_date: '2026-03-01',
        target_na: false,
        milestones: {},
      },
      'heads_of_terms',
      { target_date: '2026-02-10', note: 'note' }
    );
    const patch = gateRowPatch(stage);
    expect(Object.keys(patch).sort()).toEqual([
      'milestone_choices',
      'target_date',
      'target_na',
    ]);
    // Each milestone choice carries only the chosen date and the note.
    for (const key of Object.keys(patch.milestone_choices)) {
      expect(Object.keys(patch.milestone_choices[key]).sort()).toEqual([
        'note',
        'target_date',
      ]);
    }
  });

  it('keeps every advised-date or template-derived field out of storage', () => {
    const choices = emptyProgrammeChoices();
    choices.stages[0].target_date = '2026-03-01';
    choices.stages.forEach((s, i) => {
      s.id = `row-${i}`;
    });
    const stored = JSON.stringify(
      choices.stages.map((s) => ({ id: s.id, stage: s.stage, ...gateRowPatch(s) }))
    );
    expect(stored).not.toMatch(/advis/i);
    expect(stored).not.toContain('advisedDate');
    expect(stored).not.toContain('gateAdvisedDate');
    expect(stored).not.toContain('offsetWeeks');
    expect(stored).not.toContain('gateWeeks');

    // Sanity: the derivation does produce advised dates from these inputs, so
    // their absence from storage above is meaningful, not vacuous.
    const advised = deriveAdvisedDates('2026-01-05', PROGRAMME_TEMPLATE);
    expect(advised.stages[0].gateAdvisedDate).toBeInstanceOf(Date);
  });
});

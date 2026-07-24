import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';
import {
  emptyProgrammeChoices,
  setMilestoneChoice,
} from '../app/pulse/app/components/programmeChoices.js';
import { PROGRAMME_TEMPLATE, stageMilestones } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme, ITEM_ORIGIN } from '../lib/engine/programmeAssembly.js';
import {
  reconcileBaseline,
  referenceFromBriefProgramme,
} from '../lib/engine/programmeReconciliation.js';
import {
  reviewStages,
  reviewSummary,
  lockGuard,
  finaliseProgrammeForLock,
} from '../app/pulse/app/programme/setup/reviewLockModel.js';
import { validateAssembledProgramme } from '../app/pulse/app/components/programmeBaselineStore.js';
import { formatDayMonthYear } from '../app/pulse/app/components/briefFormat.js';

/**
 * The single-source regression. The FINAL TEST DEVELOPMENT walkthrough proved
 * the locked Brief, the Step 7 wizard, and the assembled v1 could hold three
 * different versions of the same milestone. This suite locks a brief from one
 * wizard state and proves, field by field, that the three representations are
 * the same record set:
 *   - the rendered document (the assembleBrief model the lock snapshots),
 *   - the wizard state (the gates the wizard holds and persists),
 *   - the assembled v1 (assembleProgramme over the same choices),
 * with the lock-time reconciliation passing against the Brief's own programme
 * record, the review disclosing every point v1 holds, and the lock guard and
 * the frozen v1 proof behaving as the lock screen requires.
 *
 * Pure, at the model level: the wizard's persistence round-trip
 * (programmeChoices) and the store write (programmeBaselineStore) have their
 * own suites; here the same in-memory records feed all three representations,
 * which is exactly the state the lock flush guarantees at lock time.
 */

const START = '2026-01-05';
const TARGET = '2028-10-19'; // the Step 1 target completion, on the gate 7 date

// Dated choices for every gate and all but one headline milestone.
// first_exchange is deliberately left undated: it must stay undated and be
// named through every representation, never auto dated.
const GATE_DATES = {
  0: '2026-03-30', // week 12
  1: '2026-05-25', // week 20
  2: '2026-07-06', // week 26
  3: '2027-02-01', // week 56
  4: '2027-04-26', // week 68
  5: '2028-04-24', // week 120
  6: '2028-06-05', // week 126
  7: '2028-10-19', // week 146
};
const MILESTONE_DATES = {
  heads_of_terms: '2026-02-16',
  finance_committed: '2026-05-11',
  lead_consultant: '2026-06-22',
  planning_validated: '2026-10-12',
  tenders_returned: '2027-03-29',
  superstructure: '2027-10-25',
  finishing: '2028-03-01',
  completion_certificate: '2028-05-22',
  // first_exchange: undated on purpose.
};
const MILESTONE_NOTES = {
  finishing: 'Internal finishes and snagging to the specification standard.',
};

// Cost, time and funding non-negotiable, mirroring the walkthrough project:
// first_exchange (serves funding) is Critical and undated, the exact point
// the old derivation fabricated a date for.
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'non_negotiable' },
];

function wizardGates() {
  let stages = emptyProgrammeChoices().stages.map((s) => ({
    ...s,
    target_date: GATE_DATES[s.stage] ?? '',
  }));
  const stageByMilestone = {};
  for (const stage of PROGRAMME_TEMPLATE.stages) {
    for (const m of stageMilestones(stage)) stageByMilestone[m.key] = stage.stage;
  }
  for (const [key, date] of Object.entries(MILESTONE_DATES)) {
    const idx = stages.findIndex((s) => s.stage === stageByMilestone[key]);
    stages[idx] = setMilestoneChoice(stages[idx], key, {
      target_date: date,
      note: MILESTONE_NOTES[key] ?? '',
    });
  }
  return stages;
}

const GATES = wizardGates();
const STATE = {
  def: {
    name: 'Single Source Development',
    project_type: 'residential',
    currency: 'GBP',
    start_date: START,
    target_completion_date: TARGET,
  },
  ctx: {},
  objectives: OBJECTIVES,
  lists: {
    milestones: [],
    workstreams: [],
    risks: [],
    assumptions: [],
    constraints: [],
    dependencies: [],
  },
  gates: GATES,
};

// The three representations, from the one record set.
const DOCUMENT = assembleBrief(STATE); // what the lock snapshots and renders
const CHOICES = { stages: GATES }; // what the wizard persists and setup loads
const V1 = assembleProgramme(START, PROGRAMME_TEMPLATE, CHOICES, [], OBJECTIVES);

const isoOf = (date) => (date == null ? null : date.toISOString().slice(0, 10));
const v1MilestoneByKey = (key) => {
  for (const stage of V1.stages) {
    for (const a of stage.activities) {
      const m = a.milestones.find((x) => x.key === key);
      if (m) return m;
    }
  }
  return undefined;
};

describe('the locked document, the wizard state, and v1 hold the identical record set', () => {
  it('agrees every gate date, field by field, across all three', () => {
    for (const stageChoice of GATES) {
      const wizardDate = stageChoice.target_date === '' ? null : stageChoice.target_date;
      const briefGate = DOCUMENT.programme.gates.find(
        (g) => g.stage === stageChoice.stage
      );
      const v1Gate = V1.stages.find((s) => s.stage === stageChoice.stage).gate;
      expect(briefGate.date).toBe(wizardDate);
      expect(briefGate.na).toBe(stageChoice.target_na === true);
      expect(isoOf(v1Gate.baselineDate)).toBe(wizardDate);
    }
  });

  it('agrees every headline milestone date and note, field by field, across all three', () => {
    for (const stage of PROGRAMME_TEMPLATE.stages) {
      for (const tm of stageMilestones(stage)) {
        const stageChoice = GATES.find((s) => s.stage === stage.stage);
        const choice = stageChoice.milestones[tm.key] ?? {};
        const wizardDate =
          choice.target_date == null || choice.target_date === ''
            ? null
            : choice.target_date;
        const wizardNote =
          choice.note == null || choice.note === '' ? null : choice.note;

        const briefRecord = DOCUMENT.programme.milestones.find((m) => m.key === tm.key);
        const documentRow = DOCUMENT.milestones.find((m) => m.key === tm.key);
        const v1Milestone = v1MilestoneByKey(tm.key);

        // Wizard state equals the Brief's raw record set.
        expect(briefRecord.date).toBe(wizardDate);
        expect(briefRecord.note).toBe(wizardNote);
        // The rendered document row shows the same record, day-precise.
        expect(documentRow.date).toBe(wizardDate);
        expect(documentRow.note).toBe(wizardNote);
        expect(documentRow.dateDisplay).toBe(formatDayMonthYear(wizardDate));
        // v1 carries the same date, tagged carried; an undated point stays
        // undated (null on all three, never a derived date).
        expect(isoOf(v1Milestone.baselineDate)).toBe(wizardDate);
        expect(v1Milestone.origin).toBe(ITEM_ORIGIN.CARRIED);
      }
    }
  });

  it('keeps the undated Critical milestone undated and named in all three', () => {
    const briefRecord = DOCUMENT.programme.milestones.find(
      (m) => m.key === 'first_exchange'
    );
    const documentRow = DOCUMENT.milestones.find((m) => m.key === 'first_exchange');
    const v1Milestone = v1MilestoneByKey('first_exchange');
    expect(briefRecord.date).toBeNull();
    expect(briefRecord.critical).toBe(true);
    expect(documentRow.dateDisplay).toBeNull();
    expect(v1Milestone.baselineDate).toBeNull();
    expect(v1Milestone.criticality).toBe('critical');
    expect(v1Milestone.origin).toBe(ITEM_ORIGIN.CARRIED);
  });

  it('renders gate and milestone dates day-precise, never month and year alone', () => {
    for (const g of DOCUMENT.gateDates) {
      expect(g.dateDisplay).toBe(formatDayMonthYear(g.date));
      expect(g.dateDisplay).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    }
    const kpi = DOCUMENT.kpis.find((k) => k.key === 'completion');
    expect(kpi.value).toBe('19 Oct 2028');
  });

  it('passes the lock-time reconciliation against the Brief programme record', () => {
    const r = reconcileBaseline({
      assembled: V1,
      reference: referenceFromBriefProgramme(DOCUMENT.programme),
      resolutions: [],
      targetCompletionDate: TARGET,
    });
    expect(r.source).toBe('brief');
    expect(r.ok).toBe(true);
    expect(r.completion.breached).toBe(false);
  });
});

describe('the review discloses everything v1 holds', () => {
  const stages = reviewStages(V1);

  it('lists the undated carried milestone rather than hiding it', () => {
    const stage7 = stages.find((s) => s.stage === 7);
    const first = stage7.milestones.find((m) => m.key === 'first_exchange');
    expect(first).toBeDefined();
    expect(first.baselineDate).toBeNull();
  });

  it('lists every added drill-down milestone with its placement fields', () => {
    const added = stages.flatMap((s) => s.addedMilestones);
    const keys = added.map((m) => m.key).sort();
    expect(keys).toEqual([
      'consultant_scope_agreed',
      'developed_design_complete',
      'feasibility_confirmed',
      'substructure_complete',
    ]);
    for (const m of added) {
      expect(typeof m.offsetWeeks).toBe('number');
    }
    // The critical drill-down is listed undated: no derived date on a
    // protected point.
    const sub = added.find((m) => m.key === 'substructure_complete');
    expect(sub.baselineDate).toBeNull();
    expect(sub.criticality).toBe('critical');
  });

  it('tallies the disclosure for the footer', () => {
    const sum = reviewSummary(V1);
    expect(sum.gates).toBe(8);
    expect(sum.carriedMilestones).toBe(9);
    expect(sum.undatedCarried).toBe(1);
    expect(sum.addedMilestones).toBe(4);
    expect(sum.undatedAdded).toBe(1);
  });
});

describe('the lock guard and the frozen proof', () => {
  const passing = reconcileBaseline({
    assembled: V1,
    reference: referenceFromBriefProgramme(DOCUMENT.programme),
    resolutions: [],
    targetCompletionDate: TARGET,
  });

  it('allows the lock only on a passing check', () => {
    expect(lockGuard(passing).allowed).toBe(true);
    expect(lockGuard(null).allowed).toBe(false);
    expect(lockGuard(null).reason).toBe('not_checked');
    const failing = { ...passing, ok: false };
    expect(lockGuard(failing).allowed).toBe(false);
    expect(lockGuard(failing).reason).toBe('differences');
  });

  it('blocks a completion breach until it is expressly accepted', () => {
    const breached = reconcileBaseline({
      assembled: V1,
      reference: referenceFromBriefProgramme(DOCUMENT.programme),
      resolutions: [],
      targetCompletionDate: '2028-04-30',
    });
    expect(breached.ok).toBe(true);
    expect(breached.completion.breached).toBe(true);
    expect(lockGuard(breached, false).allowed).toBe(false);
    expect(lockGuard(breached, false).reason).toBe('breach_not_accepted');
    expect(lockGuard(breached, true).allowed).toBe(true);
  });

  it('freezes the reconciliation result and the accepted breach into v1', () => {
    const breached = reconcileBaseline({
      assembled: V1,
      reference: referenceFromBriefProgramme(DOCUMENT.programme),
      resolutions: [],
      targetCompletionDate: '2028-04-30',
    });
    const finalised = finaliseProgrammeForLock(V1, breached, true);
    expect(finalised.reconciliation.source).toBe('brief');
    expect(finalised.reconciliation.differences).toEqual([]);
    expect(finalised.reconciliation.derivations.length).toBe(4);
    expect(finalised.completionDecision.accepted).toBe(true);
    expect(finalised.completionDecision.weeksLate).toBeGreaterThan(0);
    // The frozen shape still satisfies the store's structural validation.
    expect(validateAssembledProgramme(finalised).ok).toBe(true);
    // No assembled point was touched.
    expect(finalised.stages).toEqual(V1.stages);
  });

  it('records no completion decision when there is no breach', () => {
    const finalised = finaliseProgrammeForLock(V1, passing, false);
    expect(finalised.completionDecision).toBeUndefined();
    expect(finalised.reconciliation.completion.breached).toBe(false);
  });
});

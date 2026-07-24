import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE, withinNormBand } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme, ITEM_ORIGIN } from '../lib/engine/programmeAssembly.js';
import {
  reconcileBaseline,
  referenceFromBriefProgramme,
  referenceFromChoices,
  baselineCompletionGateEpoch,
  describeDifference,
  formatReconciliationDate,
  DIFFERENCE_KINDS,
  DERIVATION_RULES,
  RECONCILIATION_SOURCES,
} from '../lib/engine/programmeReconciliation.js';

/**
 * The programme lock reconciliation engine. Proves the single-source guard at
 * the moment v1 locks:
 *   - an assembled programme that matches its reference record set passes,
 *     with every engine-placed point returned as a disclosed derivation;
 *   - the reference record set is preferably the locked Brief's programme
 *     section, with the live choices as the fallback for an older Brief;
 *   - a record the Brief holds that v1 does not (the FINAL TEST DEVELOPMENT
 *     fork: a milestone dated in the locked Brief but absent from the store
 *     the assembler consumed) is a named difference that blocks the lock;
 *   - a reconcile resolution is a recorded variance, not a difference;
 *   - a derived date past the completion gate is a named difference;
 *   - v1's completion is compared against the Step 1 target completion, and
 *     a breach is reported for the express-acceptance flow.
 */

const T = PROGRAMME_TEMPLATE;
const START = new Date(Date.UTC(2026, 0, 5));
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);

// Cost and time non-negotiable, the rest flexible: substructure_complete
// (drill-down, serves time) is the critical drill-down that stays undated.
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

// Every gate and headline milestone dated at its advised position.
const SPEC = {
  0: { gate: w(12), milestones: { heads_of_terms: w(6) } },
  1: { gate: w(20), milestones: { finance_committed: w(18) } },
  2: { gate: w(26), milestones: { lead_consultant: w(24) } },
  3: { gate: w(56), milestones: { planning_validated: w(40) } },
  4: { gate: w(68), milestones: { tenders_returned: w(64) } },
  5: { gate: w(120), milestones: { superstructure: w(94), finishing: w(112) } },
  6: { gate: w(126), milestones: { completion_certificate: w(124) } },
  7: { gate: w(146), milestones: { first_exchange: w(134) } },
};

function makeChoices(spec) {
  const stages = T.stages.map((s) => {
    const o = spec[s.stage] ?? {};
    const milestones = {};
    for (const [key, date] of Object.entries(o.milestones ?? {})) {
      milestones[key] = { target_date: iso(date) };
    }
    return {
      stage: s.stage,
      target_date: o.gate ? iso(o.gate) : '',
      target_na: o.na === true,
      milestones,
    };
  });
  return { stages };
}

// A brief programme section shaped as briefModel's `programme` extra emits it,
// derived from the same choices, so the two record sets agree by construction.
function briefProgrammeFromChoices(choices, targetCompletionDate = null) {
  const milestones = [];
  for (const stageChoice of choices.stages) {
    for (const [key, mc] of Object.entries(stageChoice.milestones ?? {})) {
      milestones.push({
        stage: stageChoice.stage,
        key,
        name: key,
        serves: null,
        date: mc.target_date ?? null,
        note: null,
        critical: false,
      });
    }
  }
  return {
    projectStart: iso(START),
    targetCompletionDate,
    gates: choices.stages.map((s) => ({
      stage: s.stage,
      date: s.target_date === '' ? null : s.target_date,
      na: s.target_na === true,
    })),
    milestones,
  };
}

const CHOICES = makeChoices(SPEC);
const ASSEMBLED = assembleProgramme(START, T, CHOICES, [], OBJECTIVES);

describe('a matching record set passes, with every derivation disclosed', () => {
  it('passes against the Brief programme section', () => {
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference,
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(true);
    expect(r.source).toBe(RECONCILIATION_SOURCES.BRIEF);
    expect(r.differences).toEqual([]);
  });

  it('passes against the live choices fallback, reported as the store source', () => {
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(true);
    expect(r.source).toBe(RECONCILIATION_SOURCES.STORE);
  });

  it('discloses the three dated drill-downs with their basis, and the undated protected one', () => {
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    const byKey = Object.fromEntries(r.derivations.map((d) => [d.key, d]));
    for (const key of [
      'feasibility_confirmed',
      'consultant_scope_agreed',
      'developed_design_complete',
    ]) {
      expect(byKey[key].rule).toBe(DERIVATION_RULES.STAGE_START_PLUS_OFFSET);
      expect(byKey[key].baselineDate).toBeInstanceOf(Date);
    }
    expect(byKey.substructure_complete.rule).toBe(DERIVATION_RULES.UNDATED_PROTECTED);
    expect(byKey.substructure_complete.baselineDate).toBeNull();
    expect(byKey.substructure_complete.criticality).toBe('critical');
  });

  it('discloses an undated gate the rolling chain dated from gateWeeks', () => {
    // Gate 1 left undated: the skeleton rolls it from gate 0 plus gateWeeks.
    // That is a disclosed derivation, never a silent mismatch.
    const spec = { ...SPEC, 1: { milestones: SPEC[1].milestones } };
    const choices = makeChoices(spec);
    const assembled = assembleProgramme(START, T, choices, [], OBJECTIVES);
    const r = reconcileBaseline({
      assembled,
      reference: referenceFromChoices(choices),
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(true);
    const gate1 = r.derivations.find((d) => d.key === 'gate_1');
    expect(gate1).toBeDefined();
    expect(gate1.rule).toBe(DERIVATION_RULES.ROLLED_FROM_GATE_WEEKS);
  });
});

describe('the FINAL TEST DEVELOPMENT fork is a named difference', () => {
  it('blocks when the Brief dates a milestone the assembled store never received', () => {
    // The locked Brief carries finishing at week 112; the store (and so the
    // assembly) never received that date. The check names the difference and
    // the lock is blocked, instead of v1 silently forking from the Brief.
    const staleSpec = {
      ...SPEC,
      5: { gate: w(120), milestones: { superstructure: w(94) } },
    };
    const staleChoices = makeChoices(staleSpec);
    const assembled = assembleProgramme(START, T, staleChoices, [], OBJECTIVES);
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    const r = reconcileBaseline({
      assembled,
      reference,
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(false);
    const diff = r.differences.find((d) => d.key === 'finishing');
    expect(diff).toBeDefined();
    expect(diff.kind).toBe(DIFFERENCE_KINDS.MILESTONE_DATE);
    expect(describeDifference(diff)).toContain('Finishing complete');
    expect(describeDifference(diff)).toContain('no date');
  });

  it('blocks on a gate date mismatch, named', () => {
    const movedSpec = { ...SPEC, 5: { ...SPEC[5], gate: w(118) } };
    const assembled = assembleProgramme(START, T, makeChoices(movedSpec), [], OBJECTIVES);
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    const r = reconcileBaseline({
      assembled,
      reference,
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(false);
    const diff = r.differences.find((d) => d.key === 'gate_5');
    expect(diff.kind).toBe(DIFFERENCE_KINDS.GATE_DATE);
  });

  it('blocks on an applicability mismatch', () => {
    const naSpec = { ...SPEC, 4: { na: true } };
    const assembled = assembleProgramme(START, T, makeChoices(naSpec), [], OBJECTIVES);
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    const r = reconcileBaseline({
      assembled,
      reference,
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(
      r.differences.some((d) => d.kind === DIFFERENCE_KINDS.GATE_APPLICABILITY)
    ).toBe(true);
  });

  it('blocks when the Brief holds a point v1 does not carry at all', () => {
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    reference.milestones.push({
      key: 'foreign_point',
      stage: 3,
      name: 'A point v1 lost',
      date: iso(w(30)),
    });
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference,
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    const diff = r.differences.find((d) => d.key === 'foreign_point');
    expect(diff.kind).toBe(DIFFERENCE_KINDS.MILESTONE_MISSING);
  });
});

describe('recorded variances from the reconcile step are not differences', () => {
  it('passes where a resolution agreed a date away from the Brief record', () => {
    // The reconcile step agreed heads_of_terms to week 8 (the Brief record
    // still holds week 6). The assembled date is the agreed date, and the
    // resolution is the recorded variance that explains it.
    const resolutions = [
      {
        key: 'heads_of_terms',
        kind: 'milestone',
        stage: 0,
        tier: 'propose',
        developerDate: w(6),
        recommendedDate: w(8),
        agreedDate: w(8),
        decision: 'accepted',
        note: null,
      },
    ];
    const assembled = assembleProgramme(START, T, CHOICES, resolutions, OBJECTIVES);
    const reference = referenceFromBriefProgramme(briefProgrammeFromChoices(CHOICES));
    const r = reconcileBaseline({
      assembled,
      reference,
      resolutions,
      targetCompletionDate: iso(w(146)),
    });
    expect(r.ok).toBe(true);
  });
});

describe('derived dates reconcile against the completion gate', () => {
  it('names a derived date that falls after the completion gate', () => {
    // A synthetic template: the drill-down offset overshoots the whole
    // programme (offset 30 in a stage whose gate, the completion gate, sits
    // at week 10). The derived date lands past the completion gate, and the
    // check names it rather than letting it drive the forecast tail.
    const synth = {
      version: 'synth',
      stages: [
        {
          stage: 0,
          name: 'Only',
          gateWeeks: 10,
          activities: [
            {
              key: 'a0',
              name: 'Only activity',
              typicalWeeks: 10,
              withinNormWeeks: withinNormBand(10),
              milestones: [
                {
                  key: 'over',
                  name: 'Overshoot',
                  serves: 'scope',
                  offsetWeeks: 30,
                  tier: 'drilldown',
                },
              ],
            },
          ],
          locationSensitive: [],
        },
      ],
    };
    const objectives = [
      { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
    ];
    const choices = {
      stages: [{ stage: 0, target_date: iso(w(10)), target_na: false, milestones: {} }],
    };
    const assembled = assembleProgramme(START, synth, choices, [], objectives);
    const r = reconcileBaseline({
      assembled,
      reference: referenceFromChoices(choices),
      resolutions: [],
      targetCompletionDate: null,
    });
    expect(r.ok).toBe(false);
    const diff = r.differences.find((d) => d.key === 'over');
    expect(diff.kind).toBe(DIFFERENCE_KINDS.DERIVED_PAST_COMPLETION);
  });
});

describe('the completion comparison against the Step 1 target', () => {
  it('reads the completion gate per the baseline, gates only', () => {
    expect(baselineCompletionGateEpoch(ASSEMBLED)).toBe(w(146).getTime());
  });

  it('reports no breach when v1 completes on or before the target', () => {
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: iso(w(146)),
    });
    expect(r.completion.breached).toBe(false);
    expect(r.completion.weeksLate).toBe(0);
  });

  it('reports the breach, in exact weeks, when v1 completes after the target', () => {
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: iso(w(140)),
    });
    expect(r.completion.breached).toBe(true);
    expect(r.completion.weeksLate).toBe(6);
    // The breach is not a record difference: the record sets still match.
    expect(r.ok).toBe(true);
  });

  it('reports no breach when no target is held', () => {
    const r = reconcileBaseline({
      assembled: ASSEMBLED,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: null,
    });
    expect(r.completion.breached).toBe(false);
    expect(r.completion.weeksLate).toBeNull();
  });
});

describe('naming and formatting discipline', () => {
  it('formats dates day-precise, never month and year alone', () => {
    expect(formatReconciliationDate('2026-07-23')).toBe('23 Jul 2026');
    expect(formatReconciliationDate(w(0))).toBe('5 Jan 2026');
    expect(formatReconciliationDate(null)).toBeNull();
  });

  it('describes every difference kind without an em dash or an en dash', () => {
    const sample = {
      key: 'finishing',
      stage: 5,
      name: 'Finishing complete',
      briefDate: w(112),
      baselineDate: null,
      expectedDate: w(112),
    };
    for (const kind of Object.values(DIFFERENCE_KINDS)) {
      const text = describeDifference({ ...sample, kind });
      expect(text).not.toMatch(/[\u2013\u2014]/);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('structurally rejects a derived date on a governed or protected point', () => {
    // Belt-and-braces: if a future regression ever tags a headline point
    // added, or dates a critical drill-down, the check names it.
    const doctored = JSON.parse(JSON.stringify(ASSEMBLED));
    for (const stage of doctored.stages) {
      for (const activity of stage.activities) {
        for (const m of activity.milestones) {
          if (m.key === 'first_exchange') {
            m.origin = ITEM_ORIGIN.ADDED;
            m.baselineDate = w(154).toISOString();
          }
          if (m.key === 'substructure_complete') {
            m.baselineDate = w(80).toISOString();
          }
        }
      }
    }
    const r = reconcileBaseline({
      assembled: doctored,
      reference: referenceFromChoices(CHOICES),
      resolutions: [],
      targetCompletionDate: null,
    });
    expect(
      r.differences.some((d) => d.kind === DIFFERENCE_KINDS.DERIVED_ON_GOVERNED)
    ).toBe(true);
    expect(
      r.differences.some((d) => d.kind === DIFFERENCE_KINDS.DERIVED_ON_PROTECTED)
    ).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { assembleBrief } from '../app/pulse/app/components/briefModel.js';
import {
  emptyProgrammeChoices,
  setMilestoneChoice,
} from '../app/pulse/app/components/programmeChoices.js';

/**
 * Every date in the Brief carries its day (Note 16 secondary finding, Note 8
 * full-precision dates).
 *
 * The finding was that the Brief rendered gate and milestone dates as month and
 * year alone, dropping the day. Session A0 already delivered day-precise gate
 * and milestone dates, so this suite is the standing guard around that, not a
 * rebuild of it: it pins every date-bearing surface of the Brief to the app's
 * one display format, so a month-and-year form cannot come back to any of them.
 *
 * The Brief renders `model` directly, so equality at the model level is equality
 * at the rendered document. In the rendered Brief the Programme section IS the
 * stage-gate timeline plus the milestone timeline (BriefDocument's Programme
 * component renders `gateDates` and `milestones` as two timelines), so the four
 * surfaces the note names are covered by the four blocks below.
 */

const OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'non_negotiable' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
];

// A day-precise display string: a one or two digit day, a named month, a
// four-digit year. Anything that dropped the day would fail this outright.
const DAY_PRECISE = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

// A month-and-year-only string, the exact form the note found and rejected.
const MONTH_YEAR_ONLY = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

function briefWith({ gates, financial, def } = {}) {
  return assembleBrief({
    def: {
      name: 'Twelve unit scheme',
      project_type: 'residential',
      currency: 'GBP',
      start_date: '2026-11-02',
      target_completion_date: '2028-04-06',
      ...def,
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
    financial,
    gates: gates ?? emptyProgrammeChoices().stages,
  });
}

// Gate choices with a date on stages 0, 1 and 6, two of them on a single-digit
// day so the padding rule is exercised where it matters.
function datedGates() {
  const gates = emptyProgrammeChoices().stages;
  gates[0] = { ...gates[0], target_date: '2026-11-02' };
  gates[1] = { ...gates[1], target_date: '2027-06-01' };
  gates[6] = { ...gates[6], target_date: '2028-12-31' };
  return gates;
}

describe('the gate list carries the day', () => {
  const brief = briefWith({ gates: datedGates() });

  it('renders every dated gate day-precise', () => {
    expect(brief.gateDates).toHaveLength(3);
    for (const gate of brief.gateDates) {
      expect(gate.dateDisplay).toMatch(DAY_PRECISE);
      expect(gate.dateDisplay).not.toMatch(MONTH_YEAR_ONLY);
    }
  });

  it('renders the two dates the end-to-end test misread, unambiguously', () => {
    const [stage0, stage1] = brief.gateDates;
    // Entered as 02/11/2026, meaning 2 November. It cannot now read as
    // 11 February, because the month is named.
    expect(stage0.dateDisplay).toBe('2 Nov 2026');
    // Entered as 01/06/2027, meaning 1 June.
    expect(stage1.dateDisplay).toBe('1 Jun 2027');
  });

  it('holds the day across a year boundary', () => {
    expect(brief.gateDates[2].dateDisplay).toBe('31 Dec 2028');
  });

  it('keeps the raw stored date alongside the display string, unchanged', () => {
    expect(brief.gateDates.map((g) => g.date)).toEqual([
      '2026-11-02',
      '2027-06-01',
      '2028-12-31',
    ]);
  });
});

describe('the milestone list carries the day', () => {
  it('renders a chosen milestone date day-precise', () => {
    let gates = emptyProgrammeChoices().stages;
    gates[0] = setMilestoneChoice(gates[0], 'heads_of_terms', {
      target_date: '2026-11-02',
      note: null,
    });
    gates[5] = setMilestoneChoice(gates[5], 'finishing', {
      target_date: '2028-01-09',
      note: null,
    });
    const brief = briefWith({ gates });

    const dated = brief.milestones.filter((m) => m.dateDisplay != null);
    expect(dated).toHaveLength(2);
    for (const milestone of dated) {
      expect(milestone.dateDisplay).toMatch(DAY_PRECISE);
      expect(milestone.dateDisplay).not.toMatch(MONTH_YEAR_ONLY);
    }
    expect(dated[0].dateDisplay).toBe('2 Nov 2026');
    expect(dated[1].dateDisplay).toBe('9 Jan 2028');
  });

  it('leaves an undated milestone null rather than inventing a date', () => {
    const brief = briefWith({});
    for (const milestone of brief.milestones) {
      expect(milestone.dateDisplay).toBeNull();
    }
  });
});

describe('the Programme section carries the day', () => {
  // The Brief's Programme section renders the gate list and the milestone list
  // as its two timelines, so the section is day-precise exactly when both are.
  it('has no date anywhere in the section that lacks its day', () => {
    let gates = datedGates();
    gates[0] = setMilestoneChoice(gates[0], 'heads_of_terms', {
      target_date: '2026-12-08',
      note: null,
    });
    const brief = briefWith({ gates });

    const rendered = [
      ...brief.gateDates.map((g) => g.dateDisplay),
      ...brief.milestones.map((m) => m.dateDisplay),
    ].filter(Boolean);

    expect(rendered.length).toBeGreaterThan(0);
    for (const display of rendered) {
      expect(display).toMatch(DAY_PRECISE);
    }
  });

  it('carries the raw programme record set day-precise too', () => {
    // The record set the Programme lock reconciles v1 against holds the stored
    // dates, which are and stay the ISO calendar day.
    const brief = briefWith({ gates: datedGates() });
    const dated = brief.programme.gates.filter((g) => g.date);
    expect(dated.length).toBeGreaterThan(0);
    for (const gate of dated) {
      expect(gate.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('the stage-gate timeline carries the day', () => {
  it('names every stage with a day-precise date, in stage order', () => {
    const brief = briefWith({ gates: datedGates() });
    expect(
      brief.gateDates.map((g) => `Stage ${g.stage}: ${g.dateDisplay}`)
    ).toEqual([
      'Stage 0: 2 Nov 2026',
      'Stage 1: 1 Jun 2027',
      'Stage 6: 31 Dec 2028',
    ]);
  });

  it('names each stage by the framework stage name', () => {
    const brief = briefWith({ gates: datedGates() });
    expect(brief.gateDates.map((g) => g.stageName)).toEqual([
      'Land and Site Acquisition',
      'Project Objectives and Funding',
      'Completion and Handover',
    ]);
  });
});

describe('every other date in the Brief carries the day', () => {
  it('renders the target completion day-precise on the headline figures', () => {
    const brief = briefWith({});
    const completion = brief.kpis.find((k) => k.key === 'completion');
    expect(completion.value).toBe('6 Apr 2028');
    expect(completion.value).toMatch(DAY_PRECISE);
  });

  it('renders a funding milestone date day-precise', () => {
    const brief = briefWith({
      financial: {
        milestones: [
          { label: 'First drawdown', amount: 250000, target_date: '2027-06-01', status: 'planned' },
        ],
      },
    });
    const [milestone] = brief.financialDetail.milestones;
    // The funding milestone the end-to-end test had to ask about: 06/01/2027.
    expect(milestone.dateDisplay).toBe('1 Jun 2027');
    expect(milestone.dateDisplay).toMatch(DAY_PRECISE);
  });
});

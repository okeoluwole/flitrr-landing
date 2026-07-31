import { describe, it, expect } from 'vitest';
import {
  RECONCILE_TIERS,
  deriveRealityCheck,
} from '../lib/engine/programmeRealityCheck.js';
import { geographyTemplate, resolveGeography } from '../lib/engine/geography.js';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { emptyProgrammeChoices } from '../app/pulse/app/components/programmeChoices.js';

/**
 * The Programme module's reconcile-dates flow reads BOTH halves of its
 * expression from the geography configuration (Note 10, Task 4): the VERIFY
 * LOCALLY hint a flagged card shows, and the normal-range benchmarks that
 * decided the card was flagged at all.
 *
 * The flow's cards previously repeated the United Kingdom hints for every
 * project, because the reality-check engine reads them straight off the stage
 * definition and the stage definitions were one hardcoded global template. The
 * fix wires the surface to hand the engine the geography-expressed template
 * (geographyTemplate), so both the hints and the benchmarks travel together and
 * no card can show one geography's hint against another's range.
 *
 * VERIFIED IN THE CODE BEFORE CHANGING IT: the reality-check engine holds no
 * numbers of its own. Every benchmark it compares against is read off the stage
 * definition it is given, and the band rule around them (typical plus or minus
 * fifty percent, minimum two weeks) is arithmetic that carries no jurisdiction.
 * So moving the expression is entirely a matter of which template the surface
 * hands in, which is what these tests pin.
 */

const PROJECT_START = '2026-01-05';

const OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'flexible' },
  { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'flexible' },
];

// Gate choices dating the four location-sensitive stages, so each raises a
// flag_verify card carrying its geography's hint.
function datedGates() {
  const gates = emptyProgrammeChoices().stages;
  const dates = {
    0: '2026-03-30',
    1: '2026-05-25',
    2: '2026-07-06',
    3: '2027-02-01',
    4: '2027-04-26',
    5: '2028-04-24',
    6: '2028-06-05',
  };
  for (const [stage, date] of Object.entries(dates)) {
    gates[Number(stage)] = { ...gates[Number(stage)], target_date: date };
  }
  return gates;
}

function checkFor(country, gates = datedGates()) {
  return deriveRealityCheck(PROJECT_START, geographyTemplate(country), {
    stages: gates,
  });
}

const gateItem = (check, stage) =>
  check.items.find((i) => i.key === `gate_${stage}`);

describe('the reconcile cards read their hints from the configuration', () => {
  it('shows the United Kingdom hints for a United Kingdom project', () => {
    const check = checkFor('united_kingdom');
    expect(gateItem(check, 3).reason).toBe(
      'Planning approval: Confirm the local statutory determination period.'
    );
    expect(gateItem(check, 5).reason).toBe(
      'Party wall, building control and levy commencement notices: Confirm local requirements.'
    );
    expect(gateItem(check, 4).reason).toBe(
      'Public procurement timescales: Confirm which apply.'
    );
  });

  it('shows the Nigeria hints for a Nigeria project, naming no UK mechanism', () => {
    const check = checkFor('nigeria');
    expect(gateItem(check, 3).reason).toBe(
      'State physical planning permit: Confirm the determination period with the state planning permit authority.'
    );
    expect(gateItem(check, 5).reason).toBe(
      'Building control approval and commencement notification: Confirm local requirements with the state building control agency.'
    );
    // The private Lagos scheme that started this note: no public procurement,
    // no party wall, no levy commencement notice, no Building Regulations.
    const allReasons = check.items.map((i) => i.reason).join(' | ');
    for (const term of [
      'Party wall',
      'levy commencement',
      'Public procurement',
      'statutory determination',
      'Building Regulations',
      'NHBC',
    ]) {
      expect(allReasons).not.toContain(term);
    }
  });

  it('shows the neutral hints for an unconfigured country, never the UK ones', () => {
    for (const country of ['other', null, undefined, 'ghana']) {
      const check = checkFor(country);
      expect(gateItem(check, 3).reason).toBe(
        'Development approval: Confirm the local determination period.'
      );
      expect(gateItem(check, 5).reason).toBe(
        'Pre-construction notices and building control: Confirm local requirements.'
      );
      expect(gateItem(check, 3).reason).not.toContain('statutory determination');
    }
  });

  it('takes no hint from a constant in the flow: the same gate differs by country', () => {
    const reasons = ['united_kingdom', 'nigeria', 'other'].map(
      (c) => gateItem(checkFor(c), 3).reason
    );
    expect(new Set(reasons).size).toBe(3);
  });

  it('keeps the VERIFY LOCALLY tier in every geography', () => {
    // The chip signals that PULSE is prompting, not asserting a statutory fact,
    // and it has to survive the move: a geography changes the wording of the
    // prompt, never whether there is one.
    for (const country of ['united_kingdom', 'nigeria', 'other']) {
      const check = checkFor(country);
      for (const stage of [3, 4, 5, 6]) {
        expect(gateItem(check, stage).tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
        expect(gateItem(check, stage).locationSensitive).toBe(true);
        expect(gateItem(check, stage).reason).toMatch(/: Confirm .*\.$/);
      }
    }
  });

  it('leaves a stage with no configured hint unflagged in every geography', () => {
    for (const country of ['united_kingdom', 'nigeria', 'other']) {
      const check = checkFor(country);
      for (const stage of [0, 1, 2]) {
        expect(gateItem(check, stage).locationSensitive).toBe(false);
      }
    }
  });
});

describe('the reconcile flow reads its range benchmarks from the configuration', () => {
  it('reports the curated figures the check actually works from', () => {
    // The benchmarks are the template's own curated durations, read off the
    // stage definition the surface hands in. No geography overrides one today,
    // so all three resolve to these, and a local figure is a configuration entry
    // rather than a code change.
    expect(PROGRAMME_TEMPLATE.stages.map((s) => s.gateWeeks)).toEqual([
      12, 8, 6, 30, 12, 52, 6, 20,
    ]);
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      expect(resolveGeography(country).programmeBenchmarks).toEqual({});
    }
  });

  it('flags identically across geographies while no benchmark is overridden', () => {
    // The honest consequence of leaving the numbers neutral: the tiers agree,
    // and only the wording of the hints differs.
    const uk = checkFor('united_kingdom');
    const ng = checkFor('nigeria');
    const neutral = checkFor('other');
    const tiers = (check) => check.items.map((i) => `${i.key}:${i.tier}`);
    expect(tiers(ng)).toEqual(tiers(uk));
    expect(tiers(neutral)).toEqual(tiers(uk));
  });

  it('moves the check when a benchmark IS overridden, so the wiring is real', () => {
    // The mechanism under test, exercised through a stand-in template so the
    // shipped configuration stays the honest empty one. Stage 1 is used because
    // it carries no location-sensitive hint, and flag_verify would otherwise
    // dominate the spacing check and hide the effect.
    const gates = datedGates();
    const base = checkFor('nigeria', gates);
    expect(gateItem(base, 1).tier).toBe(RECONCILE_TIERS.WITHIN_NORM);

    // The stage's activities are squeezed to a week each, taking the summed band
    // to a range the developer's eight-week gate no longer sits inside. The same
    // dates, the same engine, a different benchmark, and the card flips.
    const squeezed = deriveRealityCheck(
      PROJECT_START,
      geographyTemplate('nigeria', {
        ...PROGRAMME_TEMPLATE,
        stages: PROGRAMME_TEMPLATE.stages.map((s) =>
          s.stage === 1
            ? {
                ...s,
                activities: s.activities.map((a) => ({
                  ...a,
                  typicalWeeks: 1,
                  withinNormWeeks: { min: 1, max: 2 },
                })),
              }
            : s
        ),
      }),
      { stages: gates }
    );
    expect(gateItem(squeezed, 1).tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(gateItem(squeezed, 1).recommendedDate).toBeInstanceOf(Date);
    expect(gateItem(squeezed, 1).reason).toContain('weeks');
  });

  it('reports the band it used, so a card can always show its own arithmetic', () => {
    const check = checkFor('nigeria');
    const stage1 = gateItem(check, 1);
    // Stage 1's activities are 3 and 6 weeks, so their summed generous band is
    // 4 to 14 weeks. The figure comes off the template, never a constant here.
    expect(stage1.implied.band).toEqual({ min: 4, max: 14 });
    expect(stage1.implied.weeks).toBe(8);
    expect(stage1.implied.withinBand).toBe(true);
  });
});

describe('the expression and the benchmarks travel on one object', () => {
  it('a card can never show one geography hint against another geography range', () => {
    // Both halves come off the same resolved template, which is the point of
    // wiring the surface with geographyTemplate rather than two lookups.
    const template = geographyTemplate('nigeria');
    expect(template.region).toBe('nigeria');
    expect(template.stages[3].locationSensitive[0].label).toBe(
      'State physical planning permit'
    );
    expect(template.stages[3].gateWeeks).toBe(30);

    const check = deriveRealityCheck(PROJECT_START, template, {
      stages: datedGates(),
    });
    expect(gateItem(check, 3).reason).toContain('State physical planning permit');
  });
});

describe('objectives are irrelevant to the expression, and stay so', () => {
  it('derives the same hints whatever the objective classifications are', () => {
    // The geography changes wording. It must never touch the criticality
    // cascade, which is the framework's own mechanic.
    const flexible = checkFor('nigeria');
    const protectedAll = deriveRealityCheck(
      PROJECT_START,
      geographyTemplate('nigeria'),
      { stages: datedGates() },
      { objectives: OBJECTIVES.map((o) => ({ ...o, classification: 'non_negotiable' })) }
    );
    expect(gateItem(protectedAll, 3).reason).toBe(gateItem(flexible, 3).reason);
  });
});

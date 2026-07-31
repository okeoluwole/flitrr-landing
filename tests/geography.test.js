import { describe, it, expect } from 'vitest';
import {
  GEOGRAPHY_KEYS,
  geographyTemplate,
  resolveGeography,
} from '../lib/engine/geography.js';
import { DATE_INPUT_FORMATS } from '../lib/engine/dateFormat.js';
import {
  PROGRAMME_TEMPLATE,
  stageMilestones,
} from '../lib/engine/programmeTemplate.js';

/**
 * The geography expression (Note 10). The core is geography-agnostic; the
 * expression is configurable. The bug under test is that the expression was
 * hardcoded United Kingdom, so a Lagos scheme inherited NHBC, party wall notices
 * and Building Regulations. The load-bearing guarantee is the one at the top:
 * an unconfigured country resolves to the neutral base and NEVER to the United
 * Kingdom.
 */

// Every string in a configuration, flattened, so a test can assert that no
// jurisdiction-specific mechanism appears anywhere in the neutral base.
function allText(config) {
  const out = [config.specificationPlaceholder];
  for (const hints of Object.values(config.programmeHints)) {
    for (const h of hints) out.push(h.label, h.prompt);
  }
  for (const name of Object.values(config.milestoneNames)) out.push(name);
  return out.join(' | ');
}

describe('resolveGeography: the fallback is the neutral base, never the UK', () => {
  const UK_ONLY = [
    'NHBC',
    'EPC',
    'Party wall',
    'party wall',
    'levy commencement',
    'Building Regulations',
    'Public procurement',
    'statutory determination',
  ];

  it('resolves an unconfigured country to the neutral base', () => {
    expect(resolveGeography('other').key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography(null).key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography(undefined).key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography('').key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography('ghana').key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography('UNITED_KINGDOM').key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography(42).key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
    expect(resolveGeography({}).key).toBe(GEOGRAPHY_KEYS.NEUTRAL);
  });

  it('never returns the United Kingdom expression for an unconfigured country', () => {
    const uk = resolveGeography('united_kingdom');
    for (const country of ['other', null, undefined, '', 'ghana', 'nigeria', 7]) {
      const config = resolveGeography(country);
      expect(config.key).not.toBe(GEOGRAPHY_KEYS.UNITED_KINGDOM);
      expect(config.specificationPlaceholder).not.toBe(uk.specificationPlaceholder);
      expect(config.milestoneNames.completion_certificate).not.toBe(
        uk.milestoneNames.completion_certificate
      );
    }
  });

  it('names no jurisdiction-specific mechanism anywhere in the neutral base', () => {
    const text = allText(resolveGeography('other'));
    for (const term of UK_ONLY) expect(text).not.toContain(term);
  });

  it('names no United Kingdom mechanism anywhere in the Nigeria expression', () => {
    const text = allText(resolveGeography('nigeria'));
    for (const term of UK_ONLY) expect(text).not.toContain(term);
  });

  it('returns the same frozen object every time, so it is a lookup', () => {
    expect(resolveGeography('nigeria')).toBe(resolveGeography('nigeria'));
    expect(resolveGeography('other')).toBe(resolveGeography(null));
    expect(Object.isFrozen(resolveGeography('nigeria'))).toBe(true);
    expect(Object.isFrozen(resolveGeography('nigeria').programmeHints)).toBe(true);
  });

  it('trims a stored value before resolving it', () => {
    expect(resolveGeography(' nigeria ').key).toBe(GEOGRAPHY_KEYS.NIGERIA);
  });
});

describe('each configured geography returns its own placeholder', () => {
  it('the United Kingdom keeps the shipped placeholder', () => {
    expect(resolveGeography('united_kingdom').specificationPlaceholder).toBe(
      'e.g. NHBC, EPC B, contemporary fit-out'
    );
  });

  it('Nigeria offers the National Building Code and local convention', () => {
    const placeholder = resolveGeography('nigeria').specificationPlaceholder;
    expect(placeholder).toContain('National Building Code');
    expect(placeholder).not.toContain('NHBC');
    expect(placeholder).not.toContain('EPC');
  });

  it('the neutral base names a kind of standard, not any instrument', () => {
    expect(resolveGeography('other').specificationPlaceholder).toBe(
      'e.g. build standard, energy rating, fit-out level'
    );
  });

  it('all three differ from each other', () => {
    const keys = ['united_kingdom', 'nigeria', 'other'];
    const placeholders = keys.map((k) => resolveGeography(k).specificationPlaceholder);
    expect(new Set(placeholders).size).toBe(3);
  });
});

describe('the Step 4 planning field wording is configuration, not a conditional', () => {
  it('names the field for each jurisdiction', () => {
    expect(resolveGeography('united_kingdom').planningStatusLabel).toBe(
      'Planning status'
    );
    expect(resolveGeography('nigeria').planningStatusLabel).toBe('Consent status');
    expect(resolveGeography('other').planningStatusLabel).toBe(
      'Planning or consent status'
    );
  });

  it('the United Kingdom reads in permission terms, everyone else in consent terms', () => {
    const uk = resolveGeography('united_kingdom').planningStatusLabels;
    expect(uk.outline_consent).toBe('Outline planning permission');
    expect(uk.full_consent).toBe('Full planning permission');

    for (const country of ['nigeria', 'other', null]) {
      const labels = resolveGeography(country).planningStatusLabels;
      expect(labels.outline_consent).toBe('Outline consent');
      expect(labels.full_consent).toBe('Full consent');
    }
  });

  it('carries a label for every stored enum value, in every geography', () => {
    // The stored planning_status values are fixed and geography-agnostic
    // (migration 015). A geography that dropped one would render a blank option.
    const values = [
      'no_application', 'pre_application', 'outline_consent', 'full_consent',
      'reserved_matters', 'approved', 'refused', 'other',
    ];
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      const labels = resolveGeography(country).planningStatusLabels;
      for (const value of values) {
        expect(labels[value]).toBeTypeOf('string');
        expect(labels[value].length).toBeGreaterThan(0);
      }
    }
  });

  it('inherits the entries an overlay does not set, from the base not the UK', () => {
    const uk = resolveGeography('united_kingdom').planningStatusLabels;
    const ng = resolveGeography('nigeria').planningStatusLabels;
    const neutral = resolveGeography('other').planningStatusLabels;
    // Nigeria sets no label overrides at all, so every entry is the neutral one.
    expect(ng).toEqual(neutral);
    expect(ng.outline_consent).not.toBe(uk.outline_consent);
    // The United Kingdom overrides two entries and inherits the other six.
    expect(uk.no_application).toBe(neutral.no_application);
    expect(uk.reserved_matters).toBe(neutral.reserved_matters);
  });
});

describe('each configured geography returns its own Programme hints', () => {
  it('the United Kingdom keeps the shipped hints', () => {
    const hints = resolveGeography('united_kingdom').programmeHints;
    expect(hints[3][0]).toEqual({
      label: 'Planning approval',
      prompt: 'Confirm the local statutory determination period',
    });
    expect(hints[4][0].label).toBe('Public procurement timescales');
    expect(hints[5][0].label).toBe(
      'Party wall, building control and levy commencement notices'
    );
  });

  it('Nigeria names the state planning permit, not UK planning', () => {
    const hints = resolveGeography('nigeria').programmeHints;
    expect(hints[3][0].label).toBe('State physical planning permit');
    expect(hints[3][0].prompt).toContain('state planning permit authority');
  });

  it('Nigeria names state building control, not party wall or levy notices', () => {
    const hints = resolveGeography('nigeria').programmeHints;
    expect(hints[5][0].label).toBe(
      'Building control approval and commencement notification'
    );
    expect(hints[5][0].prompt).toContain('state building control agency');
  });

  it('names the country-level authority, not one state, since the key is the country', () => {
    // Naming Lagos in a configuration keyed on the country would hand an Abuja
    // scheme a Lagos mechanism, which is this note's own error one scale down.
    const text = allText(resolveGeography('nigeria'));
    expect(text).not.toContain('Lagos');
  });

  it('an overlay key it does not set falls to the neutral base, not to the UK', () => {
    const neutral = resolveGeography('other').programmeHints;
    const nigeria = resolveGeography('nigeria').programmeHints;
    const uk = resolveGeography('united_kingdom').programmeHints;
    // Nigeria sets no stage 4 hint: it inherits the neutral one.
    expect(nigeria[4]).toEqual(neutral[4]);
    expect(nigeria[4]).not.toEqual(uk[4]);
    expect(nigeria[4][0].label).toBe('Procurement timescales');
  });

  it('the neutral base prompts without naming a jurisdiction', () => {
    const hints = resolveGeography('other').programmeHints;
    expect(hints[3][0]).toEqual({
      label: 'Development approval',
      prompt: 'Confirm the local determination period',
    });
  });

  it('every hint keeps a confirm prompt, so PULSE prompts and never asserts', () => {
    for (const country of ['united_kingdom', 'nigeria', 'other']) {
      for (const hints of Object.values(resolveGeography(country).programmeHints)) {
        for (const h of hints) {
          expect(h.label.length).toBeGreaterThan(0);
          expect(h.prompt).toMatch(/^Confirm/);
        }
      }
    }
  });
});

describe('each configured geography returns its own milestone name', () => {
  it('the United Kingdom keeps the Building Regulations name', () => {
    expect(
      resolveGeography('united_kingdom').milestoneNames.completion_certificate
    ).toBe('Building Regulations completion certificate issued');
  });

  it('the neutral base uses the neutral completion name', () => {
    expect(resolveGeography('other').milestoneNames.completion_certificate).toBe(
      'Completion / occupancy certification issued'
    );
  });

  it('Nigeria falls through to the neutral name rather than guessing a local one', () => {
    // A Certificate of Occupancy in Nigeria is a land-title instrument under the
    // Land Use Act, not a building completion certificate, so the milestone is
    // deliberately not named after it.
    expect(resolveGeography('nigeria').milestoneNames.completion_certificate).toBe(
      'Completion / occupancy certification issued'
    );
  });
});

describe('the date input format lives in the configuration', () => {
  it('both configured geographies enter dates day first, and so does the base', () => {
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      expect(resolveGeography(country).dateInputFormat).toBe(
        DATE_INPUT_FORMATS.DMY_SLASH
      );
    }
  });
});

describe('geographyTemplate: the expression reaches the whole Programme surface', () => {
  const stage6Of = (template) =>
    stageMilestones(template.stages.find((s) => s.stage === 6));

  it('applies the geography milestone name at render and at lock', () => {
    expect(stage6Of(geographyTemplate('united_kingdom'))[0].name).toBe(
      'Building Regulations completion certificate issued'
    );
    expect(stage6Of(geographyTemplate('nigeria'))[0].name).toBe(
      'Completion / occupancy certification issued'
    );
    expect(stage6Of(geographyTemplate('other'))[0].name).toBe(
      'Completion / occupancy certification issued'
    );
    expect(stage6Of(geographyTemplate(null))[0].name).toBe(
      'Completion / occupancy certification issued'
    );
  });

  it('applies the geography location-sensitive hints onto the stages', () => {
    const ng = geographyTemplate('nigeria');
    const uk = geographyTemplate('united_kingdom');
    expect(ng.stages[5].locationSensitive[0].label).toBe(
      'Building control approval and commencement notification'
    );
    expect(uk.stages[5].locationSensitive[0].label).toBe(
      'Party wall, building control and levy commencement notices'
    );
  });

  it('leaves a stage with no configured hints carrying none', () => {
    for (const country of ['united_kingdom', 'nigeria', 'other']) {
      const template = geographyTemplate(country);
      for (const stage of [0, 1, 2, 7]) {
        expect(template.stages[stage].locationSensitive).toEqual([]);
      }
    }
  });

  it('records which expression produced the template', () => {
    expect(geographyTemplate('nigeria').region).toBe(GEOGRAPHY_KEYS.NIGERIA);
    expect(geographyTemplate('united_kingdom').region).toBe(
      GEOGRAPHY_KEYS.UNITED_KINGDOM
    );
    expect(geographyTemplate('other').region).toBe(GEOGRAPHY_KEYS.NEUTRAL);
  });

  it('never mutates the curated template', () => {
    const before = JSON.stringify(PROGRAMME_TEMPLATE);
    geographyTemplate('nigeria');
    geographyTemplate('united_kingdom');
    expect(JSON.stringify(PROGRAMME_TEMPLATE)).toBe(before);
    expect(stage6Of(PROGRAMME_TEMPLATE)[0].name).toBe(
      'Building Regulations completion certificate issued'
    );
  });

  it('returns a frozen template', () => {
    const t = geographyTemplate('nigeria');
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.stages[6])).toBe(true);
  });

  it('leaves every structural figure the derivations depend on untouched', () => {
    // Only the expression changes. The durations, offsets, keys, tiers and the
    // served objectives are the spine every derivation reads, and a geography
    // must not move them.
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      const t = geographyTemplate(country);
      expect(t.version).toBe(PROGRAMME_TEMPLATE.version);
      t.stages.forEach((stage, i) => {
        const base = PROGRAMME_TEMPLATE.stages[i];
        expect(stage.stage).toBe(base.stage);
        expect(stage.name).toBe(base.name);
        expect(stage.gateWeeks).toBe(base.gateWeeks);
        stage.activities.forEach((activity, j) => {
          const baseActivity = base.activities[j];
          expect(activity.key).toBe(baseActivity.key);
          expect(activity.typicalWeeks).toBe(baseActivity.typicalWeeks);
          expect(activity.withinNormWeeks).toEqual(baseActivity.withinNormWeeks);
          activity.milestones.forEach((milestone, k) => {
            const baseMilestone = baseActivity.milestones[k];
            expect(milestone.key).toBe(baseMilestone.key);
            expect(milestone.serves).toBe(baseMilestone.serves);
            expect(milestone.offsetWeeks).toBe(baseMilestone.offsetWeeks);
            expect(milestone.tier).toBe(baseMilestone.tier);
          });
        });
      });
    }
  });
});

describe('the range benchmarks are read from the configuration', () => {
  it('every geography carries a benchmark map, so a local figure is a config entry', () => {
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      const config = resolveGeography(country);
      expect(config.programmeBenchmarks).toBeTypeOf('object');
      expect(config.programmeBenchmarks).not.toBeNull();
    }
  });

  it('no geography overrides a benchmark today, so all three hold the curated figures', () => {
    // A defensible Nigeria benchmark could not be established, and a wrong
    // number is worse than a neutral one, so the neutral base stands. The
    // mechanism is in place; the figures are the template's own.
    const gateWeeks = PROGRAMME_TEMPLATE.stages.map((s) => s.gateWeeks);
    expect(gateWeeks).toEqual([12, 8, 6, 30, 12, 52, 6, 20]);
    for (const country of ['united_kingdom', 'nigeria', 'other', null]) {
      expect(resolveGeography(country).programmeBenchmarks).toEqual({});
      expect(geographyTemplate(country).stages.map((s) => s.gateWeeks)).toEqual(
        gateWeeks
      );
    }
  });

  it('a benchmark override folds into the template it is given', () => {
    // The wiring under test, exercised through a stand-in template so the shipped
    // configuration stays the honest empty one.
    const overridden = geographyTemplate('nigeria', {
      ...PROGRAMME_TEMPLATE,
      stages: PROGRAMME_TEMPLATE.stages.map((s) =>
        s.stage === 3 ? { ...s, gateWeeks: 44 } : s
      ),
    });
    expect(overridden.stages[3].gateWeeks).toBe(44);
    expect(overridden.stages[5].gateWeeks).toBe(52);
  });
});

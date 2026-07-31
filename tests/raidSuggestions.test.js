import { describe, it, expect } from 'vitest';
import {
  buildRaidBaseline,
  deriveRaidSuggestions,
  groupByType,
  LIST_KEY_BY_TYPE,
} from '../lib/engine/raidSuggestions.js';
import { RAID_LIBRARY, RAID_TYPES, RAID_TYPE_ORDER } from '../lib/engine/raidLibrary.js';
import { LIST_CONFIG } from '../app/pulse/app/components/listStepConfig.js';
import {
  suggestionToItem,
  itemToRow,
  captureStamp,
} from '../app/pulse/app/components/listItemModel.js';
import { OBJECTIVE_META } from '../app/pulse/app/components/objectiveMeta.js';

/**
 * Note 7: the RAID suggestion engine at Step 8 of initiation.
 *
 * The defect: Step 8 offered the same three generic risks to every project, at
 * no criticality and linked to no objective, so the cascade never applied. The
 * principle here is deterministic AI enrichment: a suggestion is a function of
 * the captured inputs, never generated at runtime, and every suggestion traces
 * to the input that produced it.
 *
 * These tests pin the selection (a condition holding is the only thing that
 * fires a candidate), the determinism and the order, the geography expression,
 * the proposal rules settled on 31 Jul 2026, and the write path's silence on
 * criticality.
 */

// The display names the wizard passes in. The kernel holds none of its own.
const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The test project: a twelve-unit Lagos off-plan scheme with Cost, Time and
// Funding non-negotiable, which is the shape the 23 Jul end-to-end test ran.
const LAGOS_OBJECTIVES = [
  { id: 'obj-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'obj-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'obj-funding', objective_type: 'funding', classification: 'non_negotiable' },
];

const lagos = (over = {}) =>
  buildRaidBaseline({
    country: 'nigeria',
    currency: 'NGN',
    procurementRoute: 'design_bid_build',
    planningStatus: 'pre_application',
    fundingStructureType: 'off_plan_presales',
    fundingMilestoneCount: 3,
    entryStage: 1,
    objectives: LAGOS_OBJECTIVES,
    nameByType: NAME_BY_TYPE,
    ...over,
  });

const keysOf = (result) => result.candidates.map((c) => c.key);
const byKey = (result, key) => result.candidates.find((c) => c.key === key);

// ── A candidate fires only when its condition holds ────────────────────────

describe('selection is a function of the recorded inputs', () => {
  it('offers the off-plan candidates when the funding structure is off-plan presales', () => {
    const keys = keysOf(deriveRaidSuggestions(lagos()));
    expect(keys).toContain('offplan_absorption_behind_drawdown');
    expect(keys).toContain('assume_absorption_rate_holds');
    expect(keys).toContain('constraint_presales_before_construction');
    expect(keys).toContain('dependency_buyer_finance');
  });

  it('offers none of them when the funding structure is anything else', () => {
    const keys = keysOf(
      deriveRaidSuggestions(lagos({ fundingStructureType: 'senior_debt' }))
    );
    expect(keys).not.toContain('offplan_absorption_behind_drawdown');
    expect(keys).not.toContain('assume_absorption_rate_holds');
    expect(keys).not.toContain('constraint_presales_before_construction');
    expect(keys).not.toContain('dependency_buyer_finance');
    // The debt family's own candidate takes its place.
    expect(keys).toContain('assume_facility_drawn_on_schedule');
  });

  it('does not fire a funding condition on an absent fact', () => {
    const keys = keysOf(deriveRaidSuggestions(lagos({ fundingStructureType: null })));
    expect(keys).not.toContain('offplan_absorption_behind_drawdown');
    expect(keys).not.toContain('assume_facility_drawn_on_schedule');
  });

  it('fires the procurement candidate only on the route recorded', () => {
    const traditional = keysOf(deriveRaidSuggestions(lagos()));
    expect(traditional).toContain('dbb_tender_above_appraisal');
    expect(traditional).not.toContain('db_design_responsibility_at_novation');

    const designBuild = keysOf(
      deriveRaidSuggestions(lagos({ procurementRoute: 'design_build' }))
    );
    expect(designBuild).toContain('db_design_responsibility_at_novation');
    expect(designBuild).not.toContain('dbb_tender_above_appraisal');
  });

  it('drops the consent candidates once consent is recorded as granted', () => {
    const keys = keysOf(deriveRaidSuggestions(lagos({ planningStatus: 'approved' })));
    expect(keys).not.toContain('consent_determination_beyond_programme');
    expect(keys).not.toContain('constraint_consent_before_commencement');
    expect(keys).not.toContain('dependency_consent_authority');
  });

  it('fires a classification condition only when every named objective matches', () => {
    // Cost non-negotiable and Time non-negotiable with Scope flexible.
    expect(keysOf(deriveRaidSuggestions(lagos()))).toContain(
      'no_slack_between_cost_and_time'
    );

    const timeFlexible = LAGOS_OBJECTIVES.map((o) =>
      o.objective_type === 'time' ? { ...o, classification: 'flexible' } : o
    );
    expect(
      keysOf(deriveRaidSuggestions(lagos({ objectives: timeFlexible })))
    ).not.toContain('no_slack_between_cost_and_time');
  });

  it('scopes a candidate out once its stages sit behind the entry stage (Note 12)', () => {
    const adopter = deriveRaidSuggestions(lagos({ entryStage: 5 }));
    const keys = keysOf(adopter);
    // Stage 2 and 3 consent candidates are behind a Stage 5 adopter.
    expect(keys).not.toContain('consent_determination_beyond_programme');
    expect(keys).not.toContain('dependency_consent_authority');
    // Stage 5 onwards still applies.
    expect(keys).toContain('dependency_building_control');
    expect(keys).toContain('dependency_buyer_finance');
  });
});

// ── Determinism and stable order ───────────────────────────────────────────

describe('determinism', () => {
  it('returns the same list in the same order twice', () => {
    const first = deriveRaidSuggestions(lagos());
    const second = deriveRaidSuggestions(lagos());
    expect(second.candidates).toEqual(first.candidates);
    expect(second.dropped).toEqual(first.dropped);
  });

  it('orders by RAID type, then by the library declaration order', () => {
    const { candidates } = deriveRaidSuggestions(lagos());
    const ranks = candidates.map((c) => RAID_TYPE_ORDER.indexOf(c.type));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    // Within a type, the order is the library's own.
    for (const type of RAID_TYPE_ORDER) {
      const got = candidates.filter((c) => c.type === type).map((c) => c.key);
      const libraryOrder = RAID_LIBRARY.filter((c) => c.type === type)
        .map((c) => c.key)
        .filter((k) => got.includes(k));
      expect(got).toEqual(libraryOrder);
    }
  });

  it('groups every type, including one with no candidates', () => {
    const { candidates } = deriveRaidSuggestions(lagos());
    const grouped = groupByType(candidates);
    expect(Object.keys(grouped).sort()).toEqual([...RAID_TYPE_ORDER].sort());
    expect(grouped[RAID_TYPES.RISK].length).toBeGreaterThan(0);
    expect(groupByType([])[RAID_TYPES.DEPENDENCY]).toEqual([]);
  });

  it('maps every RAID type to a Step 8 list that exists', () => {
    for (const type of RAID_TYPE_ORDER) {
      expect(LIST_CONFIG[LIST_KEY_BY_TYPE[type]]).toBeTruthy();
    }
  });
});

// ── Geography ──────────────────────────────────────────────────────────────

describe('the same scheme across geographies', () => {
  const nigeria = deriveRaidSuggestions(lagos());
  const unitedKingdom = deriveRaidSuggestions(
    lagos({ country: 'united_kingdom', currency: 'GBP' })
  );
  const unconfigured = deriveRaidSuggestions(
    lagos({ country: 'other', currency: 'GBP' })
  );

  it('selects a different set: the currency candidate is Nigeria-recorded only', () => {
    expect(keysOf(nigeria)).toContain('currency_movement_imported_costs');
    expect(keysOf(unitedKingdom)).not.toContain('currency_movement_imported_costs');
    expect(keysOf(nigeria)).not.toEqual(keysOf(unitedKingdom));
  });

  it('words the consent mechanism from each geography, never from another', () => {
    const ng = byKey(nigeria, 'consent_determination_beyond_programme').text;
    const uk = byKey(unitedKingdom, 'consent_determination_beyond_programme').text;
    const neutral = byKey(unconfigured, 'consent_determination_beyond_programme').text;

    expect(ng).toContain('State physical planning permit');
    expect(uk).toContain('Planning approval');
    expect(neutral).toContain('Development approval');

    expect(ng).not.toEqual(uk);
    expect(neutral).not.toEqual(uk);
  });

  it('never falls back to the United Kingdom for an unconfigured country', () => {
    for (const c of unconfigured.candidates) {
      expect(c.text).not.toContain('Planning approval');
      expect(c.text).not.toContain('Party wall');
      expect(c.text).not.toContain('levy commencement');
    }
    // A null country resolves the same neutral way.
    const nullCountry = deriveRaidSuggestions(
      lagos({ country: null, currency: 'GBP' })
    );
    expect(byKey(nullCountry, 'consent_determination_beyond_programme').text).toEqual(
      byKey(unconfigured, 'consent_determination_beyond_programme').text
    );
  });

  it('words the Stage 5 dependency from each geography', () => {
    expect(byKey(nigeria, 'dependency_building_control').text).toContain(
      'Building control approval and commencement notification'
    );
    expect(byKey(unitedKingdom, 'dependency_building_control').text).toContain(
      'Party wall, building control and levy commencement notices'
    );
    expect(byKey(unconfigured, 'dependency_building_control').text).toContain(
      'Pre-construction notices and building control'
    );
  });

  it('names the recorded currency in the text rather than any figure', () => {
    const text = byKey(nigeria, 'currency_movement_imported_costs').text;
    expect(text).toContain('NGN');
    expect(text).not.toMatch(/\{\{|\}\}/);
    expect(text).not.toMatch(/\d/);
  });
});

// ── The programme condition ────────────────────────────────────────────────

describe('the recorded stage window against the curated span', () => {
  // Stage 5's curated gateWeeks is 52. Gate 4 to gate 5 at 20 weeks is under it.
  const tightGates = [
    { stage: 4, target_date: '2026-01-01', target_na: false },
    { stage: 5, target_date: '2026-05-21', target_na: false },
  ];
  // The same two gates 78 weeks apart is over it.
  const roomyGates = [
    { stage: 4, target_date: '2026-01-01', target_na: false },
    { stage: 5, target_date: '2027-07-01', target_na: false },
  ];

  it('fires only when the recorded window is shorter than the curated span', () => {
    expect(keysOf(deriveRaidSuggestions(lagos({ gates: tightGates })))).toContain(
      'construction_window_under_typical'
    );
    expect(keysOf(deriveRaidSuggestions(lagos({ gates: roomyGates })))).not.toContain(
      'construction_window_under_typical'
    );
  });

  it('does not fire when the dates are not recorded', () => {
    expect(keysOf(deriveRaidSuggestions(lagos({ gates: [] })))).not.toContain(
      'construction_window_under_typical'
    );
    expect(
      keysOf(
        deriveRaidSuggestions(lagos({ gates: [{ stage: 5, target_date: null }] }))
      )
    ).not.toContain('construction_window_under_typical');
  });

  it('names the stage by its framework name in the basis', () => {
    const c = byKey(
      deriveRaidSuggestions(lagos({ gates: tightGates })),
      'construction_window_under_typical'
    );
    expect(c.basis).toContain('Stage 5, Construction');
  });
});

// ── The proposal (Task 2, settled 31 Jul 2026) ─────────────────────────────

describe('the objective proposal', () => {
  it('previews Critical on a non-negotiable objective', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'offplan_absorption_behind_drawdown');
    expect(c.dimension).toBe('funding');
    expect(c.proposal).toEqual({
      objectiveId: 'obj-funding',
      objectiveType: 'funding',
      objectiveName: 'Funding',
      classification: 'non_negotiable',
      criticality: 'critical',
    });
  });

  it('previews Standard on a flexible objective', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'db_design_responsibility_at_novation');
    // Quality is flexible on this project.
    const withDb = byKey(
      deriveRaidSuggestions(lagos({ procurementRoute: 'design_build' })),
      'db_design_responsibility_at_novation'
    );
    expect(c).toBeUndefined();
    expect(withDb.dimension).toBe('quality');
    expect(withDb.proposal.classification).toBe('flexible');
    expect(withDb.proposal.criticality).toBe('standard');
  });

  it('follows a reclassification, because it is derived not stored', () => {
    const fundingFlexible = LAGOS_OBJECTIVES.map((o) =>
      o.objective_type === 'funding' ? { ...o, classification: 'flexible' } : o
    );
    const c = byKey(
      deriveRaidSuggestions(lagos({ objectives: fundingFlexible })),
      'offplan_absorption_behind_drawdown'
    );
    expect(c.proposal.criticality).toBe('standard');
  });

  it('arrives with no proposal when the project holds no objective of that dimension', () => {
    // Funding not yet saved, so it carries no id and nothing can link to it.
    const noFunding = LAGOS_OBJECTIVES.filter((o) => o.objective_type !== 'funding');
    const result = deriveRaidSuggestions(lagos({ objectives: noFunding }));
    const c = byKey(result, 'offplan_absorption_behind_drawdown');

    expect(c).toBeTruthy();
    expect(c.dimension).toBe('funding');
    expect(c.proposal).toBeNull();

    // And it is not quietly attached to some other objective instead.
    for (const other of result.candidates) {
      if (other.dimension === 'funding') expect(other.proposal).toBeNull();
    }
  });

  it('treats an unsaved objective row (no id) as no objective', () => {
    const unsaved = LAGOS_OBJECTIVES.map((o) =>
      o.objective_type === 'funding' ? { ...o, id: null } : o
    );
    const c = byKey(
      deriveRaidSuggestions(lagos({ objectives: unsaved })),
      'offplan_absorption_behind_drawdown'
    );
    expect(c.proposal).toBeNull();
  });

  it('proposes at most the project objective of its own dimension', () => {
    const { candidates } = deriveRaidSuggestions(lagos());
    for (const c of candidates) {
      if (c.proposal) expect(c.proposal.objectiveType).toBe(c.dimension);
    }
  });
});

// ── The basis ──────────────────────────────────────────────────────────────

describe('every candidate states its basis', () => {
  it('names a recorded input on every candidate offered', () => {
    const { candidates } = deriveRaidSuggestions(lagos());
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.basis).toMatch(/^PULSE Suggests, selected because /);
      expect(c.basis.endsWith('.')).toBe(true);
      expect(c.basisFacts.length).toBeGreaterThan(0);
    }
  });

  it('names the funding structure that fired it, in the Brief own words', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'offplan_absorption_behind_drawdown');
    expect(c.basis).toContain('the funding structure is off-plan presales');
    expect(c.basisFacts).toContain('funding_structure');
  });

  it('names both inputs when two fired', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'offplan_price_fixed_before_cost');
    expect(c.basis).toContain('the funding structure is off-plan presales');
    expect(c.basis).toContain('Cost is non-negotiable on this project');
  });

  it('words the planning field from the geography, not from a branch', () => {
    const ng = byKey(deriveRaidSuggestions(lagos()), 'dependency_consent_authority');
    const uk = byKey(
      deriveRaidSuggestions(lagos({ country: 'united_kingdom', currency: 'GBP' })),
      'dependency_consent_authority'
    );
    expect(ng.basis).toContain('consent status');
    expect(uk.basis).toContain('planning status');
  });

  it('falls back to the entry stage when nothing else selected the candidate', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'dependency_building_control');
    expect(c.basis).toContain('Stage 5, Construction');
    expect(c.basisFacts).toEqual(['entry_stage']);
  });

  it('leaves no unresolved token in any text or basis', () => {
    for (const country of ['nigeria', 'united_kingdom', 'other', null]) {
      const { candidates } = deriveRaidSuggestions(lagos({ country }));
      for (const c of candidates) {
        expect(c.text).not.toMatch(/\{\{|\}\}/);
        expect(c.basis).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it('drops a candidate whose condition holds but whose text cannot be expressed', () => {
    const library = [
      {
        key: 'needs_a_stage_hint_that_does_not_exist',
        type: RAID_TYPES.RISK,
        dimension: 'time',
        when: { fundingStructureIn: ['off_plan_presales'] },
        // Stage 0 configures no location-sensitive hint in any geography.
        text: '{{hint:0}} is not something the baseline carries',
      },
    ];
    const result = deriveRaidSuggestions(lagos(), library);
    expect(result.candidates).toEqual([]);
    expect(result.dropped).toEqual([
      { key: 'needs_a_stage_hint_that_does_not_exist', reason: 'unresolved_token' },
    ]);
  });

  it('drops a candidate that tested no recorded fact at all', () => {
    const library = [
      {
        key: 'unconditional',
        type: RAID_TYPES.RISK,
        dimension: 'cost',
        when: {},
        text: 'Something true of every project',
      },
    ];
    const result = deriveRaidSuggestions(lagos(), library);
    expect(result.candidates).toEqual([]);
    expect(result.dropped).toEqual([
      { key: 'unconditional', reason: 'no_recorded_basis' },
    ]);
  });

  it('drops nothing on the shipped library for the test project', () => {
    expect(deriveRaidSuggestions(lagos()).dropped).toEqual([]);
  });
});

// ── The write path: nothing until the user acts, and no criticality ────────

describe('adding a suggestion', () => {
  const cfg = LIST_CONFIG.risks;
  let n = 0;
  const makeKey = () => `k${(n += 1)}`;
  const candidate = () =>
    byKey(deriveRaidSuggestions(lagos()), 'offplan_absorption_behind_drawdown');

  it('sends no criticality value of its own', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey);
    const row = itemToRow(cfg, item, LAGOS_OBJECTIVES);

    expect(row).not.toHaveProperty('criticality');
    expect(row).not.toHaveProperty('criticality_basis_type');
    expect(row).not.toHaveProperty('criticality_basis_classification');
  });

  it('still sends the stamp for a hand-typed row, unchanged', () => {
    const typed = {
      ...suggestionToItem(cfg, candidate(), 'obj-funding', makeKey),
      _fromSuggestion: false,
    };
    const row = itemToRow(cfg, typed, LAGOS_OBJECTIVES);
    expect(row.criticality).toBe('critical');
    expect(row.criticality_basis_type).toBe('funding');
    expect(row.criticality_basis_classification).toBe('non_negotiable');
  });

  it('lands with the confirmed link, and the criticality and basis the trigger derives', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey);
    const row = itemToRow(cfg, item, LAGOS_OBJECTIVES);

    expect(row.description).toBe(c.text);
    expect(row.linked_objective_id).toBe('obj-funding');

    // What migration 034's trigger will stamp from that link: Session D's own
    // derivation, which the preview on the card is the same call to.
    const stamp = captureStamp(row.linked_objective_id, LAGOS_OBJECTIVES);
    expect(stamp.criticality).toBe('critical');
    expect(stamp.basisType).toBe('funding');
    expect(stamp.basisClassification).toBe('non_negotiable');
    expect(stamp.criticality).toBe(c.proposal.criticality);
  });

  it('honours a link the developer changed away from the proposal', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, 'obj-quality', makeKey);
    const row = itemToRow(cfg, item, LAGOS_OBJECTIVES);

    expect(row.linked_objective_id).toBe('obj-quality');
    expect(row).not.toHaveProperty('criticality');
    expect(captureStamp('obj-quality', LAGOS_OBJECTIVES).criticality).toBe('standard');
  });

  it('gives Standard when the developer clears the link', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, '', makeKey);
    const row = itemToRow(cfg, item, LAGOS_OBJECTIVES);

    expect(row.linked_objective_id).toBeNull();
    expect(row).not.toHaveProperty('criticality');
    expect(captureStamp('', LAGOS_OBJECTIVES).criticality).toBe('standard');
  });

  it('adds an ordinary editable item, with the list defaults intact', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey);

    expect(item.id).toBeNull();
    expect(item._key).toBeTruthy();
    expect(item.description).toBe(c.text);
    expect(item.likelihood).toBe('medium');
    expect(item.impact).toBe('medium');
    expect(item.mitigation).toBe('');
  });

  it('shapes a sibling list the same way, on its own identity field', () => {
    const c = byKey(deriveRaidSuggestions(lagos()), 'assume_absorption_rate_holds');
    const acfg = LIST_CONFIG[LIST_KEY_BY_TYPE[c.type]];
    const row = itemToRow(
      acfg,
      suggestionToItem(acfg, c, c.proposal.objectiveId, makeKey),
      LAGOS_OBJECTIVES
    );
    expect(acfg.table).toBe('project_assumptions');
    expect(row.description).toBe(c.text);
    expect(row).not.toHaveProperty('criticality');
  });
});

// ── The library itself ─────────────────────────────────────────────────────

describe('the library is content, not code', () => {
  it('declares no condition outside the vocabulary the selector evaluates', () => {
    const allowed = new Set([
      'countryIn',
      'currencyIn',
      'fundingStructureIn',
      'procurementRouteIn',
      'planningStatusIn',
      'nonNegotiable',
      'flexible',
      'hasFundingMilestones',
      'stageUnderTypical',
      'stagesAhead',
    ]);
    for (const c of RAID_LIBRARY) {
      for (const clause of Object.keys(c.when ?? {})) {
        expect(allowed.has(clause)).toBe(true);
      }
      expect(typeof c.when).toBe('object');
    }
  });

  it('gives every candidate a stable key, a known type and a real dimension', () => {
    const keys = new Set();
    const dimensions = new Set(OBJECTIVE_META.map((o) => o.type));
    for (const c of RAID_LIBRARY) {
      expect(keys.has(c.key)).toBe(false);
      keys.add(c.key);
      expect(RAID_TYPE_ORDER).toContain(c.type);
      expect(dimensions.has(c.dimension)).toBe(true);
      expect(typeof c.text).toBe('string');
    }
  });

  it('is frozen, so a consumer cannot mutate the content it is handed', () => {
    expect(Object.isFrozen(RAID_LIBRARY)).toBe(true);
    expect(Object.isFrozen(RAID_LIBRARY[0])).toBe(true);
    expect(Object.isFrozen(RAID_LIBRARY[0].when)).toBe(true);
  });

  it('uses no em dash or en dash anywhere in its content', () => {
    for (const c of RAID_LIBRARY) {
      expect(c.text).not.toMatch(/[–—]/);
    }
    for (const c of deriveRaidSuggestions(lagos()).candidates) {
      expect(c.text).not.toMatch(/[–—]/);
      expect(c.basis).not.toMatch(/[–—]/);
    }
  });
});

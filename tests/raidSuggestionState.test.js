import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRaidBaseline,
  deriveRaidSuggestions,
  suppressedCountByType,
} from '../lib/engine/raidSuggestions.js';
import { RAID_LIBRARY, RAID_TYPES } from '../lib/engine/raidLibrary.js';
import { LIST_CONFIG } from '../app/pulse/app/components/listStepConfig.js';
import {
  suggestionToItem,
  itemToRow,
} from '../app/pulse/app/components/listItemModel.js';
import { OBJECTIVE_META } from '../app/pulse/app/components/objectiveMeta.js';
import {
  RAID_SUGGESTION_STATES,
  RAID_SUGGESTION_STATE_CONFLICT,
  RAID_SUGGESTION_STATE_TABLE,
  actedCandidateIds,
  capturedSuggestionIds,
  loadRaidSuggestionState,
  raidSuggestionStateRow,
  recordRaidSuggestionState,
} from '../app/pulse/app/components/raidSuggestionStore.js';

/**
 * Note 7, the persisted state of a RAID suggestion.
 *
 * THE DEFECT. Dismiss cleared a card and wrote nothing, so every dismissed
 * suggestion came back on the next load. Add was covered only by the exact-text
 * check, so editing the captured text brought the candidate back as though it
 * had never been taken. Both are the same missing thing: no record of what the
 * developer DID with a candidate, only an inference from what the register
 * happens to say right now.
 *
 * These tests pin the record: that it suppresses, that it outlives an edit to
 * the captured text, that it lands in the one suppressed bucket alongside the
 * inference, that its absence changes nothing, that a candidate's identity is an
 * authored constant rather than its own wording, and that the write happens only
 * after the capture it records has succeeded.
 */

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The same twelve-unit Lagos off-plan scheme the Session G tests run.
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
const textOf = (key) => byKey(deriveRaidSuggestions(lagos()), key).text;

// Two candidates of the same type, so one can carry a state row while the other,
// otherwise identically placed, does not.
const ANSWERED = 'offplan_absorption_behind_drawdown';
const UNANSWERED = 'offplan_price_fixed_before_cost';

// ── The record suppresses ──────────────────────────────────────────────────

describe('a candidate the developer has already answered', () => {
  it('is suppressed, while an otherwise identical candidate without a row is offered', () => {
    const both = keysOf(deriveRaidSuggestions(lagos()));
    expect(both).toContain(ANSWERED);
    expect(both).toContain(UNANSWERED);

    const result = deriveRaidSuggestions(
      lagos({ actedCandidateIds: [ANSWERED] })
    );
    expect(keysOf(result)).not.toContain(ANSWERED);
    expect(keysOf(result)).toContain(UNANSWERED);
    expect(result.suppressed).toContainEqual({
      key: ANSWERED,
      reason: 'already_acted',
    });
  });

  it('stays suppressed once the captured text has been edited (the add-then-edit case)', () => {
    const captured = textOf(ANSWERED);

    // Before the record existed, this was the whole of the suppression: the
    // candidate's own wording sitting in the list.
    expect(
      keysOf(deriveRaidSuggestions(lagos({ captured: { risk: [captured] } })))
    ).not.toContain(ANSWERED);

    // Edit that captured item, as a developer does, and the inference alone
    // brings the candidate straight back.
    const edited = `${captured}, and the sales agent is not yet appointed`;
    expect(
      keysOf(deriveRaidSuggestions(lagos({ captured: { risk: [edited] } })))
    ).toContain(ANSWERED);

    // With the record, the edit changes nothing: it was added, and it stays
    // added. This is the reason the persisted state exists.
    const withRecord = deriveRaidSuggestions(
      lagos({ captured: { risk: [edited] }, actedCandidateIds: [ANSWERED] })
    );
    expect(keysOf(withRecord)).not.toContain(ANSWERED);
    expect(withRecord.suppressed).toContainEqual({
      key: ANSWERED,
      reason: 'already_acted',
    });
  });

  it('is suppressed whatever the register now says, because the record wins outright', () => {
    // Nothing captured at all, so the inference has nothing to work with.
    const result = deriveRaidSuggestions(
      lagos({ captured: { risk: [] }, actedCandidateIds: [ANSWERED] })
    );
    expect(keysOf(result)).not.toContain(ANSWERED);
  });

  it('takes a Set as readily as an array, and ignores blanks', () => {
    const asSet = deriveRaidSuggestions(
      lagos({ actedCandidateIds: new Set([ANSWERED]) })
    );
    const asArray = deriveRaidSuggestions(
      lagos({ actedCandidateIds: [ANSWERED, '', null, undefined] })
    );
    expect(keysOf(asSet)).toEqual(keysOf(asArray));
    expect(keysOf(asSet)).not.toContain(ANSWERED);
  });
});

// ── One bucket, one entry ──────────────────────────────────────────────────

describe('both suppression inputs land in the same bucket', () => {
  it('reports a text match and a state row in the one suppressed list', () => {
    const result = deriveRaidSuggestions(
      lagos({
        captured: { assumption: [textOf('assume_absorption_rate_holds')] },
        actedCandidateIds: [ANSWERED],
      })
    );
    const reasons = Object.fromEntries(
      result.suppressed.map((s) => [s.key, s.reason])
    );
    expect(reasons[ANSWERED]).toBe('already_acted');
    expect(reasons.assume_absorption_rate_holds).toBe('already_captured');
    expect(result.suppressed).toHaveLength(2);
  });

  it('reports a candidate caught by both exactly once, as the record', () => {
    const result = deriveRaidSuggestions(
      lagos({
        captured: { risk: [textOf(ANSWERED)] },
        actedCandidateIds: [ANSWERED],
      })
    );
    const hits = result.suppressed.filter((s) => s.key === ANSWERED);
    expect(hits).toEqual([{ key: ANSWERED, reason: 'already_acted' }]);
    expect(keysOf(result)).not.toContain(ANSWERED);
  });

  it('counts the suppressed candidates by RAID type, for the band line', () => {
    const result = deriveRaidSuggestions(
      lagos({
        captured: { assumption: [textOf('assume_absorption_rate_holds')] },
        actedCandidateIds: [ANSWERED, 'assume_deposits_released_to_build'],
      })
    );
    const counts = suppressedCountByType(result.suppressed);
    expect(counts[RAID_TYPES.RISK]).toBe(1);
    expect(counts[RAID_TYPES.ASSUMPTION]).toBe(2);
    expect(counts[RAID_TYPES.CONSTRAINT]).toBe(0);
    expect(counts[RAID_TYPES.DEPENDENCY]).toBe(0);
  });

  it('counts a key the library no longer holds towards nothing', () => {
    const counts = suppressedCountByType([
      { key: 'retired_from_the_library', reason: 'already_acted' },
    ]);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it('gives every RAID type a count, including one suppressing nothing', () => {
    expect(suppressedCountByType([])).toEqual({
      risk: 0,
      assumption: 0,
      constraint: 0,
      dependency: 0,
    });
  });
});

// ── No record, no change ───────────────────────────────────────────────────

describe('an empty set of persisted ids', () => {
  it('leaves the derivation exactly as it was', () => {
    const without = deriveRaidSuggestions(lagos());
    for (const empty of [undefined, null, [], new Set()]) {
      const with_ = deriveRaidSuggestions(lagos({ actedCandidateIds: empty }));
      expect(with_.candidates).toEqual(without.candidates);
      expect(with_.suppressed).toEqual(without.suppressed);
      expect(with_.dropped).toEqual(without.dropped);
    }
  });

  it('suppresses nothing and drops nothing on the shipped library', () => {
    const result = deriveRaidSuggestions(lagos({ actedCandidateIds: [] }));
    expect(result.suppressed).toEqual([]);
    expect(result.dropped).toEqual([]);
  });
});

// ── The candidate's identity ───────────────────────────────────────────────

describe('a candidate is identified by an authored constant', () => {
  it('gives every candidate in the library a unique key', () => {
    const keys = RAID_LIBRARY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('does not derive that key from the candidate own wording', () => {
    // A key derived from the text would move whenever the text was reworded,
    // and a copy edit would silently resurrect every dismissal of it on every
    // project. So no key may be a slug of its own text.
    const slug = (text) =>
      String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    for (const c of RAID_LIBRARY) {
      expect(c.key).not.toBe(slug(c.text));
      expect(slug(c.text).startsWith(c.key)).toBe(false);
    }
  });

  it('holds the same key for the same candidate however its text renders', () => {
    // The consent candidates word themselves from the geography configuration,
    // so the same candidate reads differently in Nigeria, in the United Kingdom
    // and under the neutral base. The key does not move with the words.
    const texts = new Set();
    for (const country of ['nigeria', 'united_kingdom', 'other']) {
      const c = byKey(
        deriveRaidSuggestions(lagos({ country, currency: 'GBP' })),
        'consent_determination_beyond_programme'
      );
      expect(c.key).toBe('consent_determination_beyond_programme');
      texts.add(c.text);
    }
    expect(texts.size).toBe(3);
  });

  it('keeps the engine free of any database read of its own', () => {
    // The persisted ids arrive as an argument, per the three-register pattern:
    // the caller reads, the engine stays pure.
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib', 'engine', 'raidSuggestions.js'),
      'utf8'
    );
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/createClient/);
  });
});

// ── The write path ─────────────────────────────────────────────────────────

describe('an added suggestion is recorded only after its capture succeeded', () => {
  const cfg = LIST_CONFIG.risks;
  let n = 0;
  const makeKey = () => `k${(n += 1)}`;
  const candidate = () => byKey(deriveRaidSuggestions(lagos()), ANSWERED);

  it('carries the candidate key onto the item it creates', () => {
    const c = candidate();
    const item = suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey);
    expect(item._suggestionKey).toBe(ANSWERED);
    expect(item._fromSuggestion).toBe(true);
  });

  it('never sends that key to the capture table', () => {
    const c = candidate();
    const row = itemToRow(
      cfg,
      suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey),
      LAGOS_OBJECTIVES
    );
    expect(row).not.toHaveProperty('_suggestionKey');
    expect(row).not.toHaveProperty('_fromSuggestion');
    expect(row).not.toHaveProperty('criticality');
  });

  it('records nothing while the item has no database id', () => {
    const c = candidate();
    const unsaved = suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey);
    expect(unsaved.id).toBeNull();
    expect(capturedSuggestionIds([unsaved])).toEqual([]);
  });

  it('records it once the insert has returned an id', () => {
    const c = candidate();
    const saved = {
      ...suggestionToItem(cfg, c, c.proposal.objectiveId, makeKey),
      id: 'risk-row-1',
    };
    expect(capturedSuggestionIds([saved])).toEqual([ANSWERED]);
  });

  it('records nothing for a hand-typed row, saved or not', () => {
    const typed = { id: 'risk-row-2', description: 'Something typed' };
    expect(capturedSuggestionIds([typed, { id: null }])).toEqual([]);
  });

  it('records each candidate once, however many items carry it', () => {
    const c = candidate();
    const twice = [
      { ...suggestionToItem(cfg, c, '', makeKey), id: 'risk-row-3' },
      { ...suggestionToItem(cfg, c, '', makeKey), id: 'risk-row-4' },
    ];
    expect(capturedSuggestionIds(twice)).toEqual([ANSWERED]);
  });
});

// ── The store ──────────────────────────────────────────────────────────────

/**
 * A Supabase double that records what it was asked to do. Enough of the client
 * surface for the two calls this store makes, and nothing more.
 */
function fakeSupabase({ rows = [], selectError = null, writeError = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table };
      calls.push(call);
      return {
        select(columns) {
          call.select = columns;
          return {
            eq(column, value) {
              call.eq = [column, value];
              return Promise.resolve({
                data: selectError ? null : rows,
                error: selectError,
              });
            },
          };
        },
        upsert(payload, options) {
          call.upsert = payload;
          call.options = options;
          return Promise.resolve({ data: null, error: writeError });
        },
      };
    },
  };
}

describe('the suggestion state store', () => {
  it('shapes a row with no clock and no invented id', () => {
    expect(
      raidSuggestionStateRow({
        projectId: 'p1',
        candidateId: ANSWERED,
        state: RAID_SUGGESTION_STATES.DISMISSED,
      })
    ).toEqual({
      project_id: 'p1',
      candidate_id: ANSWERED,
      state: 'dismissed',
    });
  });

  it('refuses a state outside the two the enum holds', () => {
    expect(() =>
      raidSuggestionStateRow({
        projectId: 'p1',
        candidateId: ANSWERED,
        state: 'accepted',
      })
    ).toThrow();
    expect(() =>
      raidSuggestionStateRow({ projectId: 'p1', candidateId: '', state: 'added' })
    ).toThrow();
  });

  it('reads the answered candidates off the loaded rows, whatever the answer was', () => {
    const ids = actedCandidateIds([
      { candidate_id: ANSWERED, state: 'added' },
      { candidate_id: UNANSWERED, state: 'dismissed' },
      { candidate_id: '', state: 'added' },
      null,
    ]);
    expect([...ids].sort()).toEqual([ANSWERED, UNANSWERED].sort());
  });

  it('loads a project state as the set the engine suppresses on', async () => {
    const supabase = fakeSupabase({
      rows: [{ candidate_id: ANSWERED, state: 'dismissed' }],
    });
    const { candidateIds, error } = await loadRaidSuggestionState(supabase, 'p1');
    expect(error).toBeNull();
    expect([...candidateIds]).toEqual([ANSWERED]);
    expect(supabase.calls[0].table).toBe(RAID_SUGGESTION_STATE_TABLE);
    expect(supabase.calls[0].eq).toEqual(['project_id', 'p1']);
  });

  it('reports a failed load rather than reading as nothing answered', async () => {
    const supabase = fakeSupabase({ selectError: { message: 'nope' } });
    const { candidateIds, error } = await loadRaidSuggestionState(supabase, 'p1');
    expect(candidateIds).toBeNull();
    expect(error).toBeTruthy();
  });

  it('upserts on the project and candidate pair, so a dismiss can become an add', async () => {
    const supabase = fakeSupabase();
    const { error } = await recordRaidSuggestionState(supabase, {
      projectId: 'p1',
      candidateIds: [ANSWERED],
      state: RAID_SUGGESTION_STATES.ADDED,
    });
    expect(error).toBeNull();
    expect(supabase.calls[0].options).toEqual({
      onConflict: RAID_SUGGESTION_STATE_CONFLICT,
    });
    expect(supabase.calls[0].upsert).toEqual([
      { project_id: 'p1', candidate_id: ANSWERED, state: 'added' },
    ]);
    // The conflict target is the unique constraint migration 036 declares.
    expect(RAID_SUGGESTION_STATE_CONFLICT).toBe('project_id,candidate_id');
  });

  it('records several captured candidates in one write', async () => {
    const supabase = fakeSupabase();
    await recordRaidSuggestionState(supabase, {
      projectId: 'p1',
      candidateIds: [ANSWERED, UNANSWERED],
      state: RAID_SUGGESTION_STATES.ADDED,
    });
    expect(supabase.calls[0].upsert).toHaveLength(2);
  });

  it('writes nothing when there is nothing to record', async () => {
    const supabase = fakeSupabase();
    const { error } = await recordRaidSuggestionState(supabase, {
      projectId: 'p1',
      candidateIds: [],
      state: RAID_SUGGESTION_STATES.ADDED,
    });
    expect(error).toBeNull();
    expect(supabase.calls).toEqual([]);
  });

  it('returns a failed write rather than swallowing it', async () => {
    const supabase = fakeSupabase({ writeError: { message: 'denied' } });
    const { error } = await recordRaidSuggestionState(supabase, {
      projectId: 'p1',
      candidateIds: [ANSWERED],
      state: RAID_SUGGESTION_STATES.DISMISSED,
    });
    expect(error).toBeTruthy();
  });
});

// ── The migration says what the code assumes ───────────────────────────────

describe('migration 036 carries what the store relies on', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '036_raid_suggestion_state.sql'),
    'utf8'
  );

  it('declares the table, the type and the two states the store writes', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS project_raid_suggestion_state');
    expect(sql).toContain("CREATE TYPE raid_suggestion_state AS ENUM ('added', 'dismissed')");
    expect(RAID_SUGGESTION_STATE_TABLE).toBe('project_raid_suggestion_state');
  });

  it('declares the unique pair every write upserts on', () => {
    expect(sql).toContain('UNIQUE (project_id, candidate_id)');
  });

  it('carries the four org-scoped policies, so a member who can add can dismiss', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FOR SELECT');
    expect(sql).toContain('FOR INSERT');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('FOR DELETE');
    expect(sql).toContain('current_user_organisation_id()');
    expect(sql).toContain('is_organisation_admin()');
  });

  it('uses no em dash or en dash', () => {
    expect(sql).not.toMatch(/[–—]/);
  });
});

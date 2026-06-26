import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';
import {
  BASELINE_COLUMNS,
  BaselineWriteError,
  validateAssembledProgramme,
  currentBaselineRow,
  nextBaselineVersion,
  isRebaseline,
  planBaselineWrite,
  baselineRpcArgs,
  writeProgrammeBaseline,
  loadCurrentProgrammeBaseline,
  loadProgrammeBaselineHistory,
} from '../app/pulse/app/components/programmeBaselineStore.js';

/**
 * Programme baseline store (Programme module Phase 2.2). Proves the pure
 * decision logic (next version, v1 versus re-baseline, the required reason,
 * the well-formed check, the row shape) and the read and write paths around
 * the table.
 *
 * The database is taken out of the loop with a faithful in-memory fake that
 * mirrors the migration 020 contract: lock_programme_baseline supersedes the
 * current baseline and inserts the new version in one step, the programme is
 * frozen as jsonb (a JSON round-trip, so Date objects land as ISO strings as
 * real jsonb does), and the version unique constraint and the reason rule are
 * enforced. So a write goes through the genuine writeProgrammeBaseline and the
 * reads through the genuine load functions, exactly the calls the lock screen
 * (2.3) and the tracking surface (Phase 3) make.
 */

const T = PROGRAMME_TEMPLATE;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);

// Cost and Time non-negotiable, the rest flexible: the same split the assembly
// test uses, so the frozen programme carries a real mix of criticalities.
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];

// The advised, gateWeeks-derived dates accepted in full, the same spec the
// assembly test assembles from. Enough to produce a genuine, fully-resolved v1.
const ADVISED_SPEC = {
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

// A genuine assembled programme to freeze.
function assembled() {
  return assembleProgramme(START, T, makeChoices(ADVISED_SPEC), [], OBJECTIVES);
}

// The JSON form the database actually holds (Date objects become ISO strings).
function frozen(programme) {
  return JSON.parse(JSON.stringify(programme));
}

// ── A faithful in-memory fake of the migration 020 store ────────────────────
// Mirrors the SQL contract used by the store: the select chains the reads use,
// and lock_programme_baseline's atomic supersede-and-insert with the version
// unique constraint and the reason rule as backstops.
function makeFakeSupabase() {
  const rows = [];
  let idSeq = 0;
  let clock = 0;
  const stamp = () =>
    `2026-06-26T00:00:${String(++clock).padStart(2, '0')}.000Z`;

  function selectBuilder() {
    const filters = [];
    let isNullCol = null;
    let order = null;
    const matched = () => {
      let out = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (isNullCol) out = out.filter((r) => r[isNullCol] == null);
      if (order) {
        out = [...out].sort((a, b) =>
          order.ascending ? a[order.col] - b[order.col] : b[order.col] - a[order.col]
        );
      }
      // Hand back copies, as a network read would, so a caller cannot mutate
      // the store by holding a returned row.
      return out.map((r) => ({ ...r, programme: r.programme }));
    };
    const builder = {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      is(col, val) {
        if (val === null) isNullCol = col;
        return this;
      },
      order(col, opts) {
        order = { col, ascending: opts?.ascending !== false };
        return this;
      },
      maybeSingle() {
        const out = matched();
        if (out.length > 1) {
          return Promise.resolve({ data: null, error: { message: 'multiple rows returned' } });
        }
        return Promise.resolve({ data: out[0] ?? null, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve({ data: matched(), error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    from() {
      return { select: () => selectBuilder() };
    },
    async rpc(fn, args) {
      if (fn !== 'lock_programme_baseline') {
        return { data: null, error: { message: `unknown function ${fn}` } };
      }
      const {
        p_project_id,
        p_version,
        p_programme,
        p_source_brief_id,
        p_locked_by,
        p_rebaseline_reason,
      } = args;

      // The reason rule CHECK: v1 carries no reason, a later version a non-empty one.
      const reasonOk =
        p_version === 1
          ? p_rebaseline_reason == null
          : typeof p_rebaseline_reason === 'string' && p_rebaseline_reason.trim() !== '';
      if (!reasonOk) {
        return { data: null, error: { message: 'programme_baselines_reason_rule violated' } };
      }

      // The version unique constraint.
      if (rows.some((r) => r.project_id === p_project_id && r.version === p_version)) {
        return { data: null, error: { message: 'duplicate (project_id, version)' } };
      }

      // Atomic: supersede the current row (if any) then insert the new one.
      const supersededAt = stamp();
      for (const r of rows) {
        if (r.project_id === p_project_id && r.superseded_at == null) {
          r.superseded_at = supersededAt;
        }
      }
      const row = {
        id: `baseline-${++idSeq}`,
        project_id: p_project_id,
        version: p_version,
        source_brief_id: p_source_brief_id ?? null,
        locked_by: p_locked_by ?? null,
        locked_at: stamp(),
        programme: frozen(p_programme),
        // Stored as passed, exactly as the real function inserts it; the reason
        // rule above (mirroring the CHECK) has already guaranteed a v1 reason is
        // null and a later one non-empty.
        rebaseline_reason: p_rebaseline_reason ?? null,
        superseded_at: null,
        created_at: stamp(),
      };
      rows.push(row);
      return { data: { ...row }, error: null };
    },
    // Test-only window onto the raw stored rows.
    _rows: rows,
  };
}

// ── Pure decision logic ─────────────────────────────────────────────────────

describe('nextBaselineVersion', () => {
  it('gives 1 when there are no baselines', () => {
    expect(nextBaselineVersion([])).toBe(1);
    expect(nextBaselineVersion(undefined)).toBe(1);
  });
  it('gives 2 when there is a v1', () => {
    expect(nextBaselineVersion([{ version: 1, superseded_at: null }])).toBe(2);
  });
  it('gives 3 when there is a v1 and a v2', () => {
    expect(
      nextBaselineVersion([
        { version: 1, superseded_at: '2026-06-26T00:00:01.000Z' },
        { version: 2, superseded_at: null },
      ])
    ).toBe(3);
  });
});

describe('currentBaselineRow and isRebaseline', () => {
  it('finds the row with a null superseded_at, or null', () => {
    expect(currentBaselineRow([])).toBeNull();
    const rows = [
      { version: 1, superseded_at: '2026-06-26T00:00:01.000Z' },
      { version: 2, superseded_at: null },
    ];
    expect(currentBaselineRow(rows).version).toBe(2);
  });
  it('reads a re-baseline as one where a current baseline exists', () => {
    expect(isRebaseline([])).toBe(false);
    expect(isRebaseline([{ version: 1, superseded_at: null }])).toBe(true);
  });
});

describe('validateAssembledProgramme', () => {
  it('accepts a genuine assembled programme', () => {
    expect(validateAssembledProgramme(assembled()).ok).toBe(true);
  });
  it('rejects null, a non-object, and an array', () => {
    expect(validateAssembledProgramme(null).ok).toBe(false);
    expect(validateAssembledProgramme('x').ok).toBe(false);
    expect(validateAssembledProgramme([]).ok).toBe(false);
  });
  it('rejects an object with no stages', () => {
    expect(validateAssembledProgramme({}).ok).toBe(false);
    expect(validateAssembledProgramme({ stages: [] }).ok).toBe(false);
    expect(validateAssembledProgramme({ stages: 'x' }).ok).toBe(false);
  });
  it('rejects a stage missing its gate, its activities, or its number', () => {
    expect(
      validateAssembledProgramme({ stages: [{ stage: 0, activities: [] }] }).ok
    ).toBe(false);
    expect(
      validateAssembledProgramme({ stages: [{ stage: 0, gate: { key: 'gate_0' } }] }).ok
    ).toBe(false);
    expect(
      validateAssembledProgramme({
        stages: [{ activities: [], gate: { key: 'gate_0' } }],
      }).ok
    ).toBe(false);
  });
  it('rejects an activity missing its key or its milestones array', () => {
    expect(
      validateAssembledProgramme({
        stages: [{ stage: 0, activities: [{ milestones: [] }], gate: { key: 'gate_0' } }],
      }).ok
    ).toBe(false);
    expect(
      validateAssembledProgramme({
        stages: [{ stage: 0, activities: [{ key: 'a' }], gate: { key: 'gate_0' } }],
      }).ok
    ).toBe(false);
  });
});

describe('planBaselineWrite', () => {
  it('plans v1 with a null reason when there is no current baseline', () => {
    const plan = planBaselineWrite({
      existingRows: [],
      programme: assembled(),
      sourceBriefId: 'brief-v0',
      lockedBy: 'user-1',
    });
    expect(plan.isRebaseline).toBe(false);
    expect(plan.version).toBe(1);
    expect(plan.rebaselineReason).toBeNull();
    expect(plan.sourceBriefId).toBe('brief-v0');
    expect(plan.lockedBy).toBe('user-1');
  });
  it('ignores a reason passed on a v1 write', () => {
    const plan = planBaselineWrite({
      existingRows: [],
      programme: assembled(),
      rebaselineReason: 'should be ignored on v1',
    });
    expect(plan.version).toBe(1);
    expect(plan.rebaselineReason).toBeNull();
  });
  it('requires a non-empty reason on a re-baseline', () => {
    const existingRows = [{ version: 1, superseded_at: null }];
    expect(() =>
      planBaselineWrite({ existingRows, programme: assembled() })
    ).toThrow(BaselineWriteError);
    expect(() =>
      planBaselineWrite({ existingRows, programme: assembled(), rebaselineReason: '   ' })
    ).toThrow(/reason is required/);
    try {
      planBaselineWrite({ existingRows, programme: assembled() });
    } catch (err) {
      expect(err.code).toBe('reason_required');
    }
  });
  it('plans v2 with the trimmed reason on a re-baseline', () => {
    const plan = planBaselineWrite({
      existingRows: [{ version: 1, superseded_at: null }],
      programme: assembled(),
      rebaselineReason: '  Funding restructured, programme re-cut.  ',
    });
    expect(plan.isRebaseline).toBe(true);
    expect(plan.version).toBe(2);
    expect(plan.rebaselineReason).toBe('Funding restructured, programme re-cut.');
  });
  it('rejects a malformed programme before anything else', () => {
    try {
      planBaselineWrite({ existingRows: [], programme: { stages: [] } });
      throw new Error('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BaselineWriteError);
      expect(err.code).toBe('malformed_programme');
    }
  });
  it('shapes the row with every field', () => {
    const plan = planBaselineWrite({
      existingRows: [],
      programme: assembled(),
      sourceBriefId: 'brief-v0',
      lockedBy: 'user-1',
    });
    expect(Object.keys(plan).sort()).toEqual([
      'isRebaseline',
      'lockedBy',
      'programme',
      'rebaselineReason',
      'sourceBriefId',
      'version',
    ]);
  });
});

describe('baselineRpcArgs', () => {
  it('names the database function arguments from a plan', () => {
    const plan = planBaselineWrite({ existingRows: [], programme: assembled() });
    const args = baselineRpcArgs('project-1', plan);
    expect(args).toEqual({
      p_project_id: 'project-1',
      p_version: 1,
      p_programme: plan.programme,
      p_source_brief_id: null,
      p_locked_by: null,
      p_rebaseline_reason: null,
    });
  });
});

// ── The read and write paths against the fake ───────────────────────────────

const PROJECT = 'project-1';
const BRIEF_V0 = 'brief-v0';
const USER = 'user-1';

describe('the first write succeeds as v1', () => {
  it('writes v1 with a null reason and a null superseded_at', async () => {
    const supabase = makeFakeSupabase();
    const { baseline, error } = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(error).toBeNull();
    expect(baseline.version).toBe(1);
    expect(baseline.rebaseline_reason).toBeNull();
    expect(baseline.superseded_at).toBeNull();
  });

  it('stamps the row with every field: project, version, v0 reference, locked-at, locked-by, frozen programme, reason', async () => {
    const supabase = makeFakeSupabase();
    const programme = assembled();
    const { baseline } = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme,
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(baseline.project_id).toBe(PROJECT);
    expect(baseline.version).toBe(1);
    expect(baseline.source_brief_id).toBe(BRIEF_V0);
    expect(typeof baseline.locked_at).toBe('string');
    expect(baseline.locked_by).toBe(USER);
    expect(baseline.programme).toEqual(frozen(programme));
    expect(baseline.rebaseline_reason).toBeNull();
  });
});

describe('a write when a current baseline exists', () => {
  it('requires a re-baseline reason and rejects an empty one, writing nothing', async () => {
    const supabase = makeFakeSupabase();
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });

    const noReason = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(noReason.baseline).toBeNull();
    expect(noReason.error).toBeInstanceOf(BaselineWriteError);
    expect(noReason.error.code).toBe('reason_required');

    const emptyReason = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      rebaselineReason: '   ',
    });
    expect(emptyReason.baseline).toBeNull();
    expect(emptyReason.error.code).toBe('reason_required');

    // Nothing beyond the single v1 was ever written.
    expect(supabase._rows).toHaveLength(1);
    expect(supabase._rows[0].version).toBe(1);
    expect(supabase._rows[0].superseded_at).toBeNull();
  });

  it('increments the version and stamps the prior row superseded on a re-baseline', async () => {
    const supabase = makeFakeSupabase();
    const v1 = (
      await writeProgrammeBaseline(supabase, {
        projectId: PROJECT,
        programme: assembled(),
        sourceBriefId: BRIEF_V0,
        lockedBy: USER,
      })
    ).baseline;

    const { baseline: v2, error } = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Funding restructured.',
    });
    expect(error).toBeNull();
    expect(v2.version).toBe(2);
    expect(v2.rebaseline_reason).toBe('Funding restructured.');
    expect(v2.superseded_at).toBeNull();

    // The prior row is now stamped superseded and otherwise unchanged.
    const priorAfter = supabase._rows.find((r) => r.id === v1.id);
    expect(priorAfter.version).toBe(1);
    expect(priorAfter.superseded_at).not.toBeNull();
  });
});

describe('after a re-baseline, exactly one row is current, the new one', () => {
  it('leaves a single null superseded_at, on v2', async () => {
    const supabase = makeFakeSupabase();
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Re-cut.',
    });

    const current = supabase._rows.filter((r) => r.superseded_at == null);
    expect(current).toHaveLength(1);
    expect(current[0].version).toBe(2);
  });
});

describe('a malformed assembled programme is rejected, not stored', () => {
  it('returns a malformed error and writes nothing', async () => {
    const supabase = makeFakeSupabase();
    const { baseline, error } = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: { stages: [] },
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(baseline).toBeNull();
    expect(error).toBeInstanceOf(BaselineWriteError);
    expect(error.code).toBe('malformed_programme');
    expect(supabase._rows).toHaveLength(0);
  });
});

describe('the current-baseline read', () => {
  it('returns the frozen programme byte-identical to what was written, with no re-derivation', async () => {
    const supabase = makeFakeSupabase();
    const programme = assembled();
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme,
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });

    const { baseline, error } = await loadCurrentProgrammeBaseline(supabase, PROJECT);
    expect(error).toBeNull();
    expect(baseline.version).toBe(1);
    // Byte-identical at the JSON level, the form jsonb holds.
    expect(baseline.programme).toEqual(frozen(programme));
    expect(JSON.stringify(baseline.programme)).toBe(JSON.stringify(frozen(programme)));
  });

  it('returns null when the project has no baseline', async () => {
    const supabase = makeFakeSupabase();
    const { baseline, error } = await loadCurrentProgrammeBaseline(supabase, 'no-such');
    expect(error).toBeNull();
    expect(baseline).toBeNull();
  });

  it('returns the latest version after a re-baseline', async () => {
    const supabase = makeFakeSupabase();
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Re-cut.',
    });
    const { baseline } = await loadCurrentProgrammeBaseline(supabase, PROJECT);
    expect(baseline.version).toBe(2);
  });
});

describe('the history read', () => {
  it('returns the versions in order', async () => {
    const supabase = makeFakeSupabase();
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Re-cut once.',
    });
    await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Re-cut twice.',
    });

    const { baselines, error } = await loadProgrammeBaselineHistory(supabase, PROJECT);
    expect(error).toBeNull();
    expect(baselines.map((b) => b.version)).toEqual([1, 2, 3]);
    // Only the latest is current.
    expect(baselines.filter((b) => b.superseded_at == null).map((b) => b.version)).toEqual([3]);
  });

  it('returns an empty list for a project with no baselines', async () => {
    const supabase = makeFakeSupabase();
    const { baselines } = await loadProgrammeBaselineHistory(supabase, 'no-such');
    expect(baselines).toEqual([]);
  });
});

describe('end to end via assembleProgramme', () => {
  it('assembles, freezes v1, reads it unchanged, then re-baselines to v2 keeping v1 retained and superseded', async () => {
    const supabase = makeFakeSupabase();

    // Assemble a genuine programme and freeze it as v1.
    const programmeV1 = assembled();
    const writeV1 = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: programmeV1,
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(writeV1.error).toBeNull();
    expect(writeV1.baseline.version).toBe(1);

    // Read the current baseline back: it is the frozen programme, unchanged.
    const readV1 = await loadCurrentProgrammeBaseline(supabase, PROJECT);
    expect(readV1.baseline.version).toBe(1);
    expect(readV1.baseline.programme).toEqual(frozen(programmeV1));

    // Re-baseline with a reason: v2 becomes current, v1 is retained and superseded.
    const programmeV2 = assembled();
    const writeV2 = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: programmeV2,
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
      rebaselineReason: 'Programme re-cut after a funding change.',
    });
    expect(writeV2.error).toBeNull();
    expect(writeV2.baseline.version).toBe(2);

    const readCurrent = await loadCurrentProgrammeBaseline(supabase, PROJECT);
    expect(readCurrent.baseline.version).toBe(2);

    const history = await loadProgrammeBaselineHistory(supabase, PROJECT);
    expect(history.baselines.map((b) => b.version)).toEqual([1, 2]);
    // v1 is retained and superseded; its frozen programme is unchanged.
    const v1After = history.baselines.find((b) => b.version === 1);
    expect(v1After.superseded_at).not.toBeNull();
    expect(v1After.programme).toEqual(frozen(programmeV1));
  });
});

describe('the write unwraps the function result', () => {
  it('returns the single row whether rpc gives an object or a one-element array', async () => {
    const supabase = makeFakeSupabase();
    // Some PostgREST setups wrap a single composite result in an array; the
    // store unwraps either form. Wrap this fake's result to exercise that path.
    const realRpc = supabase.rpc.bind(supabase);
    supabase.rpc = async (fn, args) => {
      const res = await realRpc(fn, args);
      return res.error ? res : { data: [res.data], error: null };
    };

    const { baseline, error } = await writeProgrammeBaseline(supabase, {
      projectId: PROJECT,
      programme: assembled(),
      sourceBriefId: BRIEF_V0,
      lockedBy: USER,
    });
    expect(error).toBeNull();
    expect(Array.isArray(baseline)).toBe(false);
    expect(baseline.version).toBe(1);
  });
});

describe('the exported column list', () => {
  it('names every baseline column the reads select', () => {
    for (const col of [
      'id',
      'project_id',
      'version',
      'source_brief_id',
      'locked_by',
      'locked_at',
      'programme',
      'rebaseline_reason',
      'superseded_at',
      'created_at',
    ]) {
      expect(BASELINE_COLUMNS).toContain(col);
    }
  });
});

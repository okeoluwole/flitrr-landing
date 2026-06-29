import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';
import { deriveProgress } from '../lib/engine/programmeProgress.js';
import { deriveRAG, RAG_STATUS } from '../lib/engine/programmeRAG.js';
import {
  MILESTONE_ACTUAL_COLUMNS,
  GATE_PASSED_STATUS,
  gatePointKey,
  isGateMet,
  buildMetPointsView,
  actualRpcArgs,
  markMilestoneMet,
  unmarkMilestone,
  loadMilestoneActuals,
  loadGateMetRows,
  loadMetPointsView,
} from '../app/pulse/app/components/programmeActualsStore.js';

/**
 * Programme milestone actuals store and combined met-points view (Programme
 * module Phase 3.3). Proves the pure view assembly (the stitch of milestone
 * actuals and gate-met into one keyspace, in the engines' contract shape), the
 * mark / amend / un-mark operations against a faithful in-memory fake of the
 * migration 021 store, baseline-independence end to end, and that the view feeds
 * both tracking engines so the met points register as percent and colour.
 *
 * The database is taken out of the loop with a fake that mirrors the migration
 * 021 contract: record_milestone_actual is a single upsert keyed on
 * (project_id, milestone_key) that preserves recorded_by and recorded_at on an
 * amendment and bumps updated_at; the delete removes the matching row; and the
 * gate rows live on a separate project_stage_gates table the view reads but never
 * writes. So a write goes through the genuine markMilestoneMet and the reads
 * through the genuine load functions, exactly the calls the tracking surface will
 * make.
 */

const PROJECT = 'project-1';
const USER = 'user-1';

// ── A faithful in-memory fake of the migration 021 store ────────────────────
// Two tables: programme_milestone_actuals (mutable, upserted by the rpc and
// removed by delete) and project_stage_gates (read only here, seeded per test).
function makeFakeSupabase({ gates = [] } = {}) {
  const actuals = [];
  const gateRows = gates.map((g) => ({ ...g }));
  let idSeq = 0;
  let clock = 0;
  const stamp = () =>
    `2026-06-30T00:00:${String(++clock).padStart(2, '0')}.000Z`;

  function rowsFor(table) {
    if (table === 'programme_milestone_actuals') return actuals;
    if (table === 'project_stage_gates') return gateRows;
    return [];
  }

  function selectBuilder(table) {
    const filters = [];
    let order = null;
    const matched = () => {
      let out = rowsFor(table).filter((r) => filters.every(([c, v]) => r[c] === v));
      if (order) {
        out = [...out].sort((a, b) =>
          order.ascending ? a[order.col] - b[order.col] : b[order.col] - a[order.col]
        );
      }
      // Hand back copies, as a network read would.
      return out.map((r) => ({ ...r }));
    };
    return {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      order(col, opts) {
        order = { col, ascending: opts?.ascending !== false };
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: matched(), error: null }).then(resolve, reject);
      },
    };
  }

  function deleteBuilder(table) {
    const filters = [];
    return {
      eq(col, val) {
        filters.push([col, val]);
        return this;
      },
      then(resolve, reject) {
        const arr = rowsFor(table);
        let removed = 0;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (filters.every(([c, v]) => arr[i][c] === v)) {
            arr.splice(i, 1);
            removed += 1;
          }
        }
        return Promise.resolve({ data: null, error: null, count: removed }).then(resolve, reject);
      },
    };
  }

  return {
    from(table) {
      return {
        select: () => selectBuilder(table),
        delete: () => deleteBuilder(table),
      };
    },
    async rpc(fn, args) {
      if (fn !== 'record_milestone_actual') {
        return { data: null, error: { message: `unknown function ${fn}` } };
      }
      const { p_project_id, p_milestone_key, p_met_date, p_recorded_by } = args;
      const existing = actuals.find(
        (r) => r.project_id === p_project_id && r.milestone_key === p_milestone_key
      );
      if (existing) {
        // Amend: only the met date changes; recorded_by and recorded_at are
        // preserved (the original provenance), and updated_at is bumped by the
        // trigger. This mirrors the function's ON CONFLICT DO UPDATE.
        existing.met_date = p_met_date;
        existing.updated_at = stamp();
        return { data: { ...existing }, error: null };
      }
      const now = stamp();
      const row = {
        id: `actual-${++idSeq}`,
        project_id: p_project_id,
        milestone_key: p_milestone_key,
        met_date: p_met_date,
        recorded_by: p_recorded_by ?? null,
        recorded_at: now,
        updated_at: now,
      };
      actuals.push(row);
      return { data: { ...row }, error: null };
    },
    // Test-only windows onto the raw rows.
    _actuals: actuals,
    _gates: gateRows,
  };
}

// Eight seeded stage gates (0..7), as handle_new_project creates them, all
// not_started, each carrying its project_id as the real rows do. A helper marks
// one passed with a date.
function seededGates(passed = {}, projectId = PROJECT) {
  return Array.from({ length: 8 }, (_, stage) => {
    const p = passed[stage];
    return {
      project_id: projectId,
      stage,
      gate_status: p ? GATE_PASSED_STATUS : 'not_started',
      passed_at: p ?? null,
    };
  });
}

// ── The pure view assembly ──────────────────────────────────────────────────

describe('gatePointKey and isGateMet', () => {
  it('keys a gate as gate_<stage>, matching the baseline', () => {
    expect(gatePointKey(0)).toBe('gate_0');
    expect(gatePointKey(7)).toBe('gate_7');
  });
  it('reads a gate met only when its status is passed', () => {
    expect(isGateMet({ gate_status: 'passed' })).toBe(true);
    expect(isGateMet({ gate_status: 'in_progress' })).toBe(false);
    expect(isGateMet({ gate_status: 'not_started' })).toBe(false);
    expect(isGateMet(null)).toBe(false);
    expect(isGateMet({})).toBe(false);
  });
});

describe('buildMetPointsView stitches milestones and gates into one keyspace', () => {
  it('carries each met milestone with its met date', () => {
    const view = buildMetPointsView(
      [
        { milestone_key: 'heads_of_terms', met_date: '2026-03-02' },
        { milestone_key: 'finance_committed', met_date: '2026-05-10' },
      ],
      []
    );
    expect(view.heads_of_terms).toEqual({ met: true, metDate: '2026-03-02' });
    expect(view.finance_committed).toEqual({ met: true, metDate: '2026-05-10' });
  });

  it('carries each passed gate as gate_<stage> with its passed date, and skips unpassed gates', () => {
    const view = buildMetPointsView(
      [],
      seededGates({ 1: '2026-04-01T09:00:00.000Z' })
    );
    expect(view.gate_1).toEqual({ met: true, metDate: '2026-04-01T09:00:00.000Z' });
    // Every other seeded gate is not_started, so absent from the view.
    for (const stage of [0, 2, 3, 4, 5, 6, 7]) {
      expect(view[gatePointKey(stage)]).toBeUndefined();
    }
  });

  it('carries a passed gate with no passed date as metDate null, pinning the fallback', () => {
    // A gate read as passed but with a null passed_at is still met (the engines
    // ignore metDate, but the contract shape is pinned here).
    const view = buildMetPointsView(
      [],
      [{ project_id: PROJECT, stage: 2, gate_status: GATE_PASSED_STATUS, passed_at: null }]
    );
    expect(view.gate_2).toEqual({ met: true, metDate: null });
  });

  it('puts milestone keys and gate keys in one map, the shape the engines read', () => {
    const view = buildMetPointsView(
      [{ milestone_key: 'heads_of_terms', met_date: '2026-03-02' }],
      seededGates({ 0: '2026-03-20T00:00:00.000Z' })
    );
    expect(Object.keys(view).sort()).toEqual(['gate_0', 'heads_of_terms']);
    // Each entry is the canonical { met: true, metDate } contract shape.
    for (const entry of Object.values(view)) {
      expect(entry.met).toBe(true);
      expect('metDate' in entry).toBe(true);
    }
  });

  it('is deterministic and mutates neither source', () => {
    const actualRows = [{ milestone_key: 'heads_of_terms', met_date: '2026-03-02' }];
    const gateRows = seededGates({ 1: '2026-04-01T00:00:00.000Z' });
    const a = JSON.stringify(actualRows);
    const g = JSON.stringify(gateRows);
    expect(buildMetPointsView(actualRows, gateRows)).toEqual(
      buildMetPointsView(actualRows, gateRows)
    );
    expect(JSON.stringify(actualRows)).toBe(a);
    expect(JSON.stringify(gateRows)).toBe(g);
  });

  it('treats absent sources as an empty view', () => {
    expect(buildMetPointsView(undefined, undefined)).toEqual({});
    expect(buildMetPointsView([], [])).toEqual({});
  });
});

describe('actualRpcArgs', () => {
  it('names the database function arguments, defaulting recordedBy to null', () => {
    expect(actualRpcArgs(PROJECT, 'heads_of_terms', '2026-03-02', USER)).toEqual({
      p_project_id: PROJECT,
      p_milestone_key: 'heads_of_terms',
      p_met_date: '2026-03-02',
      p_recorded_by: USER,
    });
    expect(actualRpcArgs(PROJECT, 'heads_of_terms', '2026-03-02').p_recorded_by).toBeNull();
  });
});

// ── Mark, amend, un-mark against the fake ────────────────────────────────────

describe('mark inserts a row with its met date and audit stamp', () => {
  it('writes one row stamped with the met date, who recorded it and when', async () => {
    const supabase = makeFakeSupabase();
    const { actual, error } = await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-02',
      recordedBy: USER,
    });
    expect(error).toBeNull();
    expect(actual.project_id).toBe(PROJECT);
    expect(actual.milestone_key).toBe('heads_of_terms');
    expect(actual.met_date).toBe('2026-03-02');
    expect(actual.recorded_by).toBe(USER);
    expect(typeof actual.recorded_at).toBe('string');
    // On a fresh mark the last-updated stamp equals the recorded-at stamp.
    expect(actual.updated_at).toBe(actual.recorded_at);
    expect(supabase._actuals).toHaveLength(1);
  });

  it('rejects a missing milestone key or met date before any write', async () => {
    const supabase = makeFakeSupabase();
    const noKey = await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: '   ',
      metDate: '2026-03-02',
    });
    expect(noKey.actual).toBeNull();
    expect(noKey.error).toBeInstanceOf(Error);

    const noDate = await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '',
    });
    expect(noDate.actual).toBeNull();
    expect(noDate.error).toBeInstanceOf(Error);

    expect(supabase._actuals).toHaveLength(0);
  });
});

describe('marking again amends the met date rather than duplicating', () => {
  it('updates the met date and the last-updated stamp, preserving the original audit stamp, with no duplicate row', async () => {
    const supabase = makeFakeSupabase();
    const first = (
      await markMilestoneMet(supabase, {
        projectId: PROJECT,
        milestoneKey: 'heads_of_terms',
        metDate: '2026-03-02',
        recordedBy: USER,
      })
    ).actual;

    const amended = (
      await markMilestoneMet(supabase, {
        projectId: PROJECT,
        milestoneKey: 'heads_of_terms',
        metDate: '2026-03-09',
        recordedBy: 'user-2',
      })
    ).actual;

    // Same row, no duplicate.
    expect(supabase._actuals).toHaveLength(1);
    expect(amended.id).toBe(first.id);
    // The met date moved.
    expect(amended.met_date).toBe('2026-03-09');
    // The original audit stamp is preserved (provenance of the met record): an
    // amendment does not re-stamp who recorded it or when, even when a different
    // user performs the amend.
    expect(amended.recorded_by).toBe(USER);
    expect(amended.recorded_at).toBe(first.recorded_at);
    // The guaranteed invariant is that the last-updated stamp is never before the
    // recorded-at stamp. Across separate transactions, the real call pattern of
    // one request per mark, the trigger's NOW() advances updated_at strictly past
    // recorded_at; within a single transaction Postgres resolves both to the same
    // NOW(), so the true invariant asserted here is updated_at >= recorded_at.
    expect(amended.updated_at >= amended.recorded_at).toBe(true);
    // The fake models the cross-transaction separation with a monotonic clock, so
    // here the bumped stamp is also strictly distinct from the original.
    expect(amended.updated_at).not.toBe(first.recorded_at);
  });
});

describe('the conflict target is per project, not global', () => {
  it('lets two projects each hold the same milestone key as distinct rows', async () => {
    const supabase = makeFakeSupabase();
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-02',
      recordedBy: USER,
    });
    await markMilestoneMet(supabase, {
      projectId: 'project-2',
      milestoneKey: 'heads_of_terms',
      metDate: '2026-04-04',
      recordedBy: USER,
    });
    // Two distinct rows, one per project: the conflict target is
    // (project_id, milestone_key), not milestone_key alone.
    expect(supabase._actuals).toHaveLength(2);

    // Amending one project's actual leaves the other untouched.
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-20',
    });
    const p1 = (await loadMilestoneActuals(supabase, PROJECT)).actuals;
    const p2 = (await loadMilestoneActuals(supabase, 'project-2')).actuals;
    expect(p1).toHaveLength(1);
    expect(p1[0].met_date).toBe('2026-03-20');
    expect(p2).toHaveLength(1);
    expect(p2[0].met_date).toBe('2026-04-04');
  });
});

describe('un-mark deletes the row: met if and only if a row exists', () => {
  it('removes the row, so the milestone is absent from the view', async () => {
    const supabase = makeFakeSupabase();
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-02',
      recordedBy: USER,
    });
    expect(supabase._actuals).toHaveLength(1);

    const beforeUnmark = await loadMetPointsView(supabase, PROJECT);
    expect(beforeUnmark.view.heads_of_terms).toBeDefined();

    const { error } = await unmarkMilestone(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
    });
    expect(error).toBeNull();
    expect(supabase._actuals).toHaveLength(0);

    const afterUnmark = await loadMetPointsView(supabase, PROJECT);
    expect(afterUnmark.view.heads_of_terms).toBeUndefined();
  });

  it('un-marking a milestone that was not met is not an error', async () => {
    const supabase = makeFakeSupabase();
    const { error } = await unmarkMilestone(supabase, {
      projectId: PROJECT,
      milestoneKey: 'never_marked',
    });
    expect(error).toBeNull();
  });
});

// ── The combined read path ───────────────────────────────────────────────────

describe('loadMetPointsView carries the met milestones and the met gates', () => {
  it('stitches the table and the gate mechanic, keyed to match the baseline', async () => {
    const supabase = makeFakeSupabase({
      gates: seededGates({ 1: '2026-04-01T09:00:00.000Z' }),
    });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-02',
      recordedBy: USER,
    });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'finance_committed',
      metDate: '2026-05-10',
      recordedBy: USER,
    });

    const { view, error } = await loadMetPointsView(supabase, PROJECT);
    expect(error).toBeNull();
    expect(view.heads_of_terms).toEqual({ met: true, metDate: '2026-03-02' });
    expect(view.finance_committed).toEqual({ met: true, metDate: '2026-05-10' });
    expect(view.gate_1).toEqual({ met: true, metDate: '2026-04-01T09:00:00.000Z' });
    // No unpassed gate leaks in.
    expect(view.gate_0).toBeUndefined();
  });

  it('filters each read by project_id (ownership isolation itself is RLS, verified live)', async () => {
    // This proves the app-level .eq('project_id') read filter only. Project
    // ownership isolation (one developer cannot reach another's actuals) is
    // enforced by RLS plus SECURITY INVOKER in migration 021 and is verified
    // against the live database at the walkthrough, not by this in-memory fake.
    const supabase = makeFakeSupabase({ gates: seededGates({ 0: '2026-02-01T00:00:00.000Z' }) });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-03-02',
    });
    const { actuals } = await loadMilestoneActuals(supabase, 'other-project');
    expect(actuals).toEqual([]);
    const { gates } = await loadGateMetRows(supabase, PROJECT);
    expect(gates.map((g) => g.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

// ── Baseline-independence, end to end ────────────────────────────────────────

// A real assembled v1 baseline from the live template, the shape the engines read.
const START = new Date(Date.UTC(2026, 0, 5));
const isoFromWeeks = (weeks) =>
  new Date(START.getTime() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const ADVISED = {
  0: { gate: 12, m: { heads_of_terms: 6 } },
  1: { gate: 20, m: { finance_committed: 18 } },
  2: { gate: 26, m: { lead_consultant: 24 } },
  3: { gate: 56, m: { planning_validated: 40 } },
  4: { gate: 68, m: { tenders_returned: 64 } },
  5: { gate: 120, m: { superstructure: 94, finishing: 112 } },
  6: { gate: 126, m: { completion_certificate: 124 } },
  7: { gate: 146, m: { first_exchange: 134 } },
};
const OBJECTIVES = [
  { id: 'o-scope', objective_type: 'scope', classification: 'flexible' },
  { id: 'o-cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'o-time', objective_type: 'time', classification: 'non_negotiable' },
  { id: 'o-quality', objective_type: 'quality', classification: 'flexible' },
  { id: 'o-funding', objective_type: 'funding', classification: 'flexible' },
];
function sampleBaseline() {
  const choices = {
    stages: PROGRAMME_TEMPLATE.stages.map((s) => {
      const o = ADVISED[s.stage] ?? {};
      const milestones = {};
      for (const [key, weeks] of Object.entries(o.m ?? {})) {
        milestones[key] = { target_date: isoFromWeeks(weeks) };
      }
      return {
        stage: s.stage,
        target_date: o.gate ? isoFromWeeks(o.gate) : '',
        target_na: false,
        milestones,
      };
    }),
  };
  return assembleProgramme(START, PROGRAMME_TEMPLATE, choices, [], OBJECTIVES);
}

describe('an actual for a key no baseline contains rides through and is ignored by the engines', () => {
  it('appears in the view yet does not move the engines, proving baseline-independence', async () => {
    const supabase = makeFakeSupabase({ gates: seededGates() });
    // One real baseline milestone met, and one actual for a key the baseline has
    // no point for (the deliberate re-baseline / orphan case).
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-02-16',
      recordedBy: USER,
    });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'ghost_from_an_old_baseline',
      metDate: '2026-02-16',
      recordedBy: USER,
    });

    const { view } = await loadMetPointsView(supabase, PROJECT);
    // The orphan is in the view, unfiltered.
    expect(view.ghost_from_an_old_baseline).toBeDefined();

    const baseline = sampleBaseline();
    // The engines ignore the orphan: a view with it and a view without it score
    // and colour identically.
    const without = { heads_of_terms: view.heads_of_terms };
    expect(deriveProgress(baseline, view)).toEqual(deriveProgress(baseline, without));
    const today = '2026-12-31';
    expect(deriveRAG(baseline, view, today, 4)).toEqual(
      deriveRAG(baseline, without, today, 4)
    );
  });
});

describe('the view feeds both tracking engines and the met points register', () => {
  it('registers in the percent-complete engine and clears the points in the RAG engine', async () => {
    // Mark stage 0's milestone met and pass stage 0's gate, so stage 0 is fully
    // accounted for: 0a holds heads_of_terms, 0b is the empty closing activity
    // taken to 100 by the gate.
    const supabase = makeFakeSupabase({
      gates: seededGates({ 0: '2026-03-30T00:00:00.000Z' }),
    });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-02-16',
      recordedBy: USER,
    });

    const { view } = await loadMetPointsView(supabase, PROJECT);
    const baseline = sampleBaseline();

    // Percent-complete: stage 0 reads one hundred (milestone met, gate passed).
    const progress = deriveProgress(baseline, view);
    const stage0 = progress.stages.find((s) => s.stage === 0);
    expect(stage0.percentComplete).toBe(100);
    expect(progress.percentComplete).toBeGreaterThan(0);

    // RAG at a today before any stage 0 baseline date has passed: nothing is
    // behind, so the programme reads Green and neither met point is flagged. The
    // met milestone and passed gate are never in the flagged list.
    const earlyToday = '2026-01-19'; // two weeks in, before the stage 0 gate (week 12)
    const ragEarly = deriveRAG(baseline, view, earlyToday, 4);
    expect(ragEarly.status).toBe(RAG_STATUS.GREEN);
    expect(ragEarly.flagged.map((f) => f.key)).not.toContain('heads_of_terms');
    expect(ragEarly.flagged.map((f) => f.key)).not.toContain('gate_0');

    // RAG well past stage 0: the met milestone and passed gate are still never
    // flagged (a met point is done), proving the met points register as cleared.
    const lateToday = '2026-12-31';
    const ragLate = deriveRAG(baseline, view, lateToday, 4);
    expect(ragLate.flagged.map((f) => f.key)).not.toContain('heads_of_terms');
    expect(ragLate.flagged.map((f) => f.key)).not.toContain('gate_0');
  });

  it('un-marking a milestone drops it back out of both engines', async () => {
    const supabase = makeFakeSupabase({ gates: seededGates() });
    await markMilestoneMet(supabase, {
      projectId: PROJECT,
      milestoneKey: 'heads_of_terms',
      metDate: '2026-02-16',
      recordedBy: USER,
    });
    const baseline = sampleBaseline();

    const withMet = (await loadMetPointsView(supabase, PROJECT)).view;
    expect(deriveProgress(baseline, withMet).percentComplete).toBeGreaterThan(0);

    await unmarkMilestone(supabase, { projectId: PROJECT, milestoneKey: 'heads_of_terms' });
    const afterUnmark = (await loadMetPointsView(supabase, PROJECT)).view;
    // Nothing met now, so the programme reads zero and the milestone, once its
    // baseline date passes, is flagged again by the RAG engine.
    expect(deriveProgress(baseline, afterUnmark).percentComplete).toBe(0);
    const lateToday = '2026-12-31';
    const rag = deriveRAG(baseline, afterUnmark, lateToday, 4);
    expect(rag.flagged.map((f) => f.key)).toContain('heads_of_terms');
  });
});

describe('the exported column list', () => {
  it('names every actual column the read selects', () => {
    for (const col of [
      'id',
      'project_id',
      'milestone_key',
      'met_date',
      'recorded_by',
      'recorded_at',
      'updated_at',
    ]) {
      expect(MILESTONE_ACTUAL_COLUMNS).toContain(col);
    }
  });
});

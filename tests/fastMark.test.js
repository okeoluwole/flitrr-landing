import { describe, it, expect } from 'vitest';
import {
  nextThirtyDays,
  fastMarkAction,
} from '../app/pulse/app/programme/overviewModel.js';
import {
  writeControls,
  utcDayValue,
  validateMetDate,
  viewWithMark,
} from '../app/pulse/app/programme/detailModel.js';
import { deriveProgress } from '../lib/engine/programmeProgress.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';
import { markMilestoneMet } from '../app/pulse/app/components/programmeActualsStore.js';

/**
 * The fast mark on Next 30 days (Programme module Phase 3.8b). Proves the
 * fast lane at the pure seams the screen renders over, against the one write
 * path 3.8a built: the affordance decision (fastMarkAction) offers the
 * one-tap mark exactly where the 3.8a permission gate allows a mark, a
 * writer's unmet milestone row, and never on a gate row, for a read-only
 * member, or off an unparseable today; the request it returns is the shared
 * path's own shape, the point key and the same today value the detail's
 * input defaults to, which the shared guard (validateMetDate) passes
 * verbatim and the same store operation (markMilestoneMet, the Phase 3.3
 * mark-or-amend upsert) receives unchanged, so the fast lane and the detail
 * view run one write path, not a duplicate; and once the confirmed write is
 * applied to the met-points view in the exact shape the refreshed read
 * returns (viewWithMark, the 3.8a twins), the engines re-derive and the
 * now-met milestone leaves the unmet lookahead while the percent moves by
 * its step.
 *
 * The fixture and posture are the overviewModel tests' own: the same
 * canonical baseline, read at the iso(10) window where the lookahead holds
 * exactly one unmet critical milestone (m3) and one gate (gate_0), so the
 * rows the affordance reads are the proven ones.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// An ISO date a whole number of weeks after the anchor, and its YYYY-MM-DD
// day value, the shape the date input and the store carry.
const iso = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK).toISOString();
const day = (weeks) => iso(weeks).slice(0, 10);

const mkMs = (key, criticality, baselineDate, name = key) => ({
  key,
  name,
  criticality,
  baselineDate,
});

// The overviewModel tests' canonical fixture: three applicable stages around
// a not-applicable one.
function canonicalBaseline() {
  return {
    version: 'test-1.0.0',
    stages: [
      {
        stage: 0,
        name: 'Stage 0',
        applicable: true,
        stageStart: iso(0),
        activities: [
          {
            key: '0a',
            name: '0a',
            durationWeeks: 1,
            milestones: [
              mkMs('m1', 'critical', iso(2), 'Heads of terms'),
              mkMs('m2', 'standard', iso(8), 'Searches back'),
            ],
          },
          {
            key: '0b',
            name: '0b',
            durationWeeks: 2,
            milestones: [mkMs('m3', 'critical', iso(10), 'Title cleared')],
          },
        ],
        gate: {
          key: 'gate_0',
          name: 'Site acquired',
          baselineDate: iso(12),
          closesActivityKey: '0b',
        },
      },
      {
        stage: 1,
        name: 'Stage 1',
        applicable: true,
        stageStart: iso(12),
        activities: [
          {
            key: '1a',
            name: '1a',
            durationWeeks: 6,
            milestones: [mkMs('m4', 'critical', iso(16), 'Finance committed')],
          },
        ],
        gate: {
          key: 'gate_1',
          name: 'Brief and funding locked',
          baselineDate: iso(20),
          closesActivityKey: '1a',
        },
      },
      {
        stage: 2,
        name: 'Stage 2',
        applicable: false,
        stageStart: iso(20),
        activities: [
          {
            key: '2a',
            name: '2a',
            durationWeeks: 100,
            milestones: [mkMs('m5', 'critical', iso(21), 'Skipped point')],
          },
        ],
        gate: {
          key: 'gate_2',
          name: 'Skipped gate',
          baselineDate: iso(22),
          closesActivityKey: '2a',
        },
      },
      {
        stage: 3,
        name: 'Stage 3',
        applicable: true,
        stageStart: iso(20),
        activities: [
          {
            key: '3a',
            name: '3a',
            durationWeeks: 8,
            milestones: [mkMs('m6', 'standard', iso(24), 'Design issued')],
          },
        ],
        gate: {
          key: 'gate_3',
          name: 'Consent secured',
          baselineDate: iso(28),
          closesActivityKey: '3a',
        },
      },
    ],
  };
}

// The proven posture: at week 10 with m1 and m2 met, the window holds the
// unmet critical milestone m3 (due today) and gate_0 (week 12), nothing else.
const TODAY = iso(10);
const MET_SO_FAR = {
  m1: { met: true, metDate: iso(2) },
  m2: { met: true, metDate: iso(8) },
};

function lookaheadAt(metView, today = TODAY) {
  const baseline = canonicalBaseline();
  const forecast = deriveForecast(baseline, metView, today);
  return { baseline, forecast, items: nextThirtyDays(baseline, forecast, today) };
}

describe('fastMarkAction, the affordance decision on the lookahead rows', () => {
  it('offers the one-tap mark on an unmet milestone row for a writer: the key, and today as the day value', () => {
    const { items } = lookaheadAt(MET_SO_FAR);
    // Pin the posture first, so the rows read are the proven ones.
    expect(items.map((i) => i.key)).toEqual(['m3', 'gate_0']);

    const milestone = items.find((i) => i.kind === 'milestone');
    expect(fastMarkAction(milestone, true, TODAY)).toEqual({
      key: 'm3',
      dateValue: day(10),
    });
  });

  it("offers nothing on a gate row, whoever is looking: gate-met is the gate mechanic's own decision", () => {
    const { items } = lookaheadAt(MET_SO_FAR);
    const gate = items.find((i) => i.kind === 'gate');
    expect(gate).toBeTruthy();
    expect(fastMarkAction(gate, true, TODAY)).toBe(null);
    expect(fastMarkAction(gate, false, TODAY)).toBe(null);
  });

  it('offers nothing to a read-only member, on any row, and defaults closed', () => {
    const { items } = lookaheadAt(MET_SO_FAR);
    for (const item of items) {
      expect(fastMarkAction(item, false, TODAY)).toBe(null);
      expect(fastMarkAction(item, undefined, TODAY)).toBe(null);
    }
    expect(fastMarkAction(null, true, TODAY)).toBe(null);
    expect(fastMarkAction({ kind: 'milestone' }, true, TODAY)).toBe(null);
  });

  it('is the 3.8a permission gate, reused: it opens exactly where writeControls allows a mark', () => {
    for (const kind of ['milestone', 'gate']) {
      for (const canEdit of [true, false]) {
        const offered =
          fastMarkAction({ key: 'x', kind }, canEdit, TODAY) != null;
        expect(offered).toBe(writeControls({ kind, canEdit }).canMark);
      }
    }
  });

  it('invents no date: an unparseable today offers no fast mark', () => {
    const item = { key: 'm3', kind: 'milestone' };
    expect(fastMarkAction(item, true, null)).toBe(null);
    expect(fastMarkAction(item, true, '')).toBe(null);
    expect(fastMarkAction(item, true, 'not a date')).toBe(null);
  });
});

describe('the one-tap request runs the shared write path, not a duplicate', () => {
  const request = fastMarkAction(
    { key: 'm3', kind: 'milestone' },
    true,
    TODAY
  );

  it("carries the detail input's own today default, and the shared guard passes it verbatim", () => {
    // The same function the detail uses for its default and its max: one
    // today, one value shape.
    expect(request.dateValue).toBe(utcDayValue(TODAY));
    expect(validateMetDate(request.dateValue, TODAY)).toEqual({
      ok: true,
      metDate: request.dateValue,
    });
  });

  it('feeds the same store operation with the same arguments the detail flow produces for a today mark', async () => {
    // The arg spy the 3.8a tests drive the store with: the rpc records the
    // mark-or-amend call, resolving as Supabase would.
    const calls = [];
    const spy = {
      async rpc(fn, args) {
        calls.push([fn, args]);
        return { data: { id: 'row-1' }, error: null };
      },
    };

    const check = validateMetDate(request.dateValue, TODAY);
    const { error } = await markMilestoneMet(spy, {
      projectId: 'project-1',
      milestoneKey: request.key,
      metDate: check.metDate,
    });

    expect(error).toBe(null);
    expect(calls).toEqual([
      [
        'record_milestone_actual',
        {
          p_project_id: 'project-1',
          p_milestone_key: 'm3',
          p_met_date: day(10),
          p_recorded_by: null,
        },
      ],
    ]);
  });
});

describe('after the fast mark the surface re-derives and the milestone leaves the unmet list', () => {
  it('marking met on today drops the row from the lookahead, the gate stays, and the percent moves by the milestone step', () => {
    const before = lookaheadAt(MET_SO_FAR);
    expect(before.items.map((i) => i.key)).toEqual(['m3', 'gate_0']);
    // Weighted by duration: 0a (1 wk) fully met over a 17 wk programme.
    expect(
      deriveProgress(before.baseline, MET_SO_FAR).percentComplete
    ).toBeCloseTo(100 / 17, 12);

    // The confirmed write applied to the view in the exact shape the
    // refreshed read returns, the same update the surface re-derives from.
    const request = fastMarkAction(before.items[0], true, TODAY);
    const marked = viewWithMark(MET_SO_FAR, request.key, request.dateValue);

    const after = lookaheadAt(marked);
    expect(after.items.map((i) => i.key)).toEqual(['gate_0']);
    // 0b (2 wk) reads one of its two points met: the percent steps up.
    expect(
      deriveProgress(after.baseline, marked).percentComplete
    ).toBeCloseTo(200 / 17, 12);
  });

  it('drops the row because it is met, not because a date moved: met on today, its own baseline day', () => {
    const marked = viewWithMark(MET_SO_FAR, 'm3', day(10));
    const { forecast } = lookaheadAt(marked);
    const stage0 = forecast.stages.find((s) => s.stage === 0);
    const node = stage0.activities
      .flatMap((a) => a.milestones ?? [])
      .find((m) => m.key === 'm3');
    expect(node.met).toBe(true);
  });
});

describe('nothing is mutated', () => {
  it('fastMarkAction reads the lookahead rows and today without touching either', () => {
    const { items } = lookaheadAt(MET_SO_FAR);
    const itemsBefore = structuredClone(items);

    for (const item of items) {
      fastMarkAction(item, true, TODAY);
      fastMarkAction(item, false, TODAY);
    }

    expect(items).toEqual(itemsBefore);
  });
});

import { describe, it, expect } from 'vitest';
import {
  FUTURE_MET_DATE_REASON,
  INVALID_MET_DATE_REASON,
  detailFields,
  writeControls,
  utcDayValue,
  validateMetDate,
  viewWithMark,
  viewWithoutMark,
} from '../app/pulse/app/programme/detailModel.js';
import { scheduleRows } from '../app/pulse/app/programme/scheduleModel.js';
import { deriveProgress } from '../lib/engine/programmeProgress.js';
import { deriveRAG } from '../lib/engine/programmeRAG.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';
import {
  buildMetPointsView,
  markMilestoneMet,
  unmarkMilestone,
} from '../app/pulse/app/components/programmeActualsStore.js';

/**
 * The Programme milestone detail display model (Phase 3.8a). Proves the
 * detail view and the mark action at the pure seam the screen renders over:
 * the detail's fields derive from the baseline, the forecast, and the
 * met-points view without recomputing any of them; the mark flow moves the
 * surface through the real engines (marking a milestone met on a date lifts
 * the percent, shifts the forecast completion, and clears the flag, amending
 * the date moves the forecast again, un-marking reverts everything);
 * marking both slipping points turns the status colour green and un-marking
 * one turns it back; the store operations receive exactly the chosen date
 * (the mark-or-amend upsert) and the un-mark is a plain delete; the
 * write-permission gate follows canEdit and never offers a gate a mark
 * control; the future-date guard refuses tomorrow and malformed input while
 * passing today and any earlier day; and no helper mutates an engine output
 * or the met-points view it is given.
 *
 * The engine inputs are built in the assembled-baseline shape with a fixed
 * UTC anchor, the same fixed-anchor style as the engine and sibling display
 * model tests, and the engines themselves produce the outputs the detail
 * reads, so the seam tested is the real one.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// An ISO instant a whole number of weeks after the anchor, the epoch of the
// same, and the YYYY-MM-DD day value the date input carries for it.
const iso = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK).toISOString();
const epoch = (weeks) => ANCHOR + weeks * MS_PER_WEEK;
const day = (weeks) => iso(weeks).slice(0, 10);

const mkMs = (key, criticality, baselineDate, name = key) => ({
  key,
  name,
  criticality,
  baselineDate,
});

// The canonical fixture the sibling display-model tests share: two spine
// stages and the concurrent sales stage around a not-applicable one.
function canonicalBaseline() {
  return {
    version: 'test-1.0.0',
    stages: [
      {
        stage: 0,
        name: 'Land and Site Acquisition',
        applicable: true,
        stageStart: iso(0),
        activities: [
          {
            key: '0a',
            name: 'Site search and appraisal',
            durationWeeks: 2,
            milestones: [
              mkMs('m1', 'critical', iso(2), 'Heads of terms agreed'),
              mkMs('m2', 'standard', iso(8), 'Searches back'),
            ],
          },
          {
            key: '0b',
            name: 'Acquisition and legal completion',
            durationWeeks: 2,
            milestones: [mkMs('m3', 'standard', iso(10), 'Title cleared')],
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
        name: 'Project Objectives and Funding',
        applicable: true,
        stageStart: iso(12),
        activities: [
          {
            key: '1a',
            name: 'Funding secured',
            durationWeeks: 4,
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
        name: 'Consultant Appointment',
        applicable: false,
        stageStart: iso(20),
        activities: [
          {
            key: '2a',
            name: 'Scope and selection',
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
        stage: 7,
        name: 'Sales and Disposal',
        applicable: true,
        stageStart: iso(22),
        activities: [
          {
            key: '7a',
            name: 'Marketing and sales',
            durationWeeks: 5,
            milestones: [mkMs('m7', 'standard', iso(4), 'First exchange')],
          },
        ],
        gate: {
          key: 'gate_7',
          name: 'Disposal complete',
          baselineDate: iso(9),
          closesActivityKey: '7a',
        },
      },
    ],
  };
}

// Today three weeks past m1's baseline: m1 (critical) and m7 (standard) are
// observably behind and flag; everything else is still ahead of its date.
const TODAY = iso(5);
const STANDARD_TOLERANCE = 4;

// The full derivation the surface makes for a met-points view: the three
// engines over the fixture, and the schedule rows the detail reads.
function derive(metView = {}) {
  const programme = canonicalBaseline();
  const progress = deriveProgress(programme, metView);
  const forecast = deriveForecast(programme, metView, TODAY);
  const rag = deriveRAG(programme, metView, TODAY, STANDARD_TOLERANCE);
  const rows = scheduleRows(programme, forecast, rag);
  return { programme, progress, forecast, rag, rows };
}

const rowFor = (rows, key) => rows.find((r) => r.key === key);

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

describe('detailFields', () => {
  it('derives an unmet milestone detail from the row: identity off the baseline, current off the forecast, variance passed through', () => {
    const { rows } = derive();
    const fields = detailFields(rowFor(rows, 'm1'), {});

    expect(fields.key).toBe('m1');
    expect(fields.name).toBe('Heads of terms agreed');
    expect(fields.kind).toBe('milestone');
    expect(fields.stage).toBe(0);
    expect(fields.stageName).toBe('Land and Site Acquisition');
    expect(fields.criticality).toBe('critical');
    expect(fields.met).toBe(false);
    expect(fields.metDate).toBe(null);
    expect(fields.baselineDate.getTime()).toBe(epoch(2));
    // Unmet and overdue, so the roll floored it at today.
    expect(fields.currentDate.getTime()).toBe(epoch(5));
    expect(fields.varianceWeeks).toBe(3);
    expect(fields.flagged).toBe(true);
    expect(fields.flagColour).toBe('amber');
  });

  it('joins the met date off the met-points view for a met point, the one fact the row does not carry', () => {
    const metView = { m1: { met: true, metDate: day(1) } };
    const { rows } = derive(metView);
    const fields = detailFields(rowFor(rows, 'm1'), metView);

    expect(fields.met).toBe(true);
    expect(fields.metDate.getTime()).toBe(epoch(1));
    // Current is the stamped actual once met, as the forecast engine read it.
    expect(fields.currentDate.getTime()).toBe(epoch(1));
    expect(fields.flagged).toBe(false);
  });

  it('reads a Map-shaped view too, and a met point with no recorded date carries a null met date', () => {
    const asMap = new Map([['m1', { met: true, metDate: day(1) }]]);
    const { rows } = derive({ m1: { met: true, metDate: day(1) } });
    expect(detailFields(rowFor(rows, 'm1'), asMap).metDate.getTime()).toBe(
      epoch(1)
    );

    const dateless = { m1: { met: true, metDate: null } };
    const derived = derive(dateless);
    const fields = detailFields(rowFor(derived.rows, 'm1'), dateless);
    expect(fields.met).toBe(true);
    expect(fields.metDate).toBe(null);
  });

  it('derives a gate detail the same way, critical by nature, met off the gate mechanic record', () => {
    const passedAt = '2026-03-02T09:15:00.000Z';
    const metView = { gate_0: { met: true, metDate: passedAt } };
    const { rows } = derive(metView);
    const fields = detailFields(rowFor(rows, 'gate_0'), metView);

    expect(fields.kind).toBe('gate');
    expect(fields.name).toBe('Site acquired');
    expect(fields.criticality).toBe('critical');
    expect(fields.met).toBe(true);
    expect(fields.metDate.getTime()).toBe(Date.parse(passedAt));
  });

  it('returns null for a missing row rather than an invented detail', () => {
    expect(detailFields(null, {})).toBe(null);
    expect(detailFields(undefined, {})).toBe(null);
  });
});

describe('the mark flow moves the surface through the derivations', () => {
  it('marking a milestone met on a date lifts the percent, clears its flag, and pulls the forecast completion in', () => {
    const before = derive({});
    expect(before.progress.percentComplete).toBe(0);
    expect(before.rag.status).toBe('amber');
    expect(before.rag.flagged.some((f) => f.key === 'm1')).toBe(true);
    expect(before.forecast.forecastCompletion.getTime()).toBe(epoch(23));

    // The mark: m1 met a week ahead of its baseline, the date the developer
    // records, applied to the view exactly as the refreshed read would hold
    // it.
    const marked = viewWithMark({}, 'm1', day(1));
    const after = derive(marked);

    // The percent moves by m1's step: activity 0a reads one of two points
    // met, duration-weighted into the programme figure.
    expect(after.progress.percentComplete).toBeCloseTo(100 / 13, 12);
    // The met point is no longer flagged; the standard slip (m7) remains, so
    // the colour honestly stays amber.
    expect(after.rag.flagged.some((f) => f.key === 'm1')).toBe(false);
    expect(after.rag.status).toBe('amber');
    // The actual re-anchors the roll, so the completion pulls in from the
    // slipped iso(23) to iso(19).
    expect(after.forecast.forecastCompletion.getTime()).toBe(epoch(19));
    // And the schedule row the detail reads moves with it.
    const row = rowFor(after.rows, 'm1');
    expect(row.met).toBe(true);
    expect(row.currentDate.getTime()).toBe(epoch(1));
  });

  it('amending the met date re-derives again: the forecast completion follows the new actual', () => {
    const marked = viewWithMark({}, 'm1', day(1));
    expect(derive(marked).forecast.forecastCompletion.getTime()).toBe(
      epoch(19)
    );

    // The amendment is the same mark-or-amend shape: the entry replaced with
    // the corrected date.
    const amended = viewWithMark(marked, 'm1', day(2));
    const after = derive(amended);
    expect(after.forecast.forecastCompletion.getTime()).toBe(epoch(20));
    // The percent reads met or not met, so it holds; only the dates moved.
    expect(after.progress.percentComplete).toBeCloseTo(100 / 13, 12);
    expect(detailFields(rowFor(after.rows, 'm1'), amended).metDate.getTime()).toBe(
      epoch(2)
    );
  });

  it('un-marking removes the point from the view and the derivations revert', () => {
    const marked = viewWithMark({}, 'm1', day(1));
    const unmarked = viewWithoutMark(marked, 'm1');
    expect(unmarked).toEqual({});

    const before = derive({});
    const after = derive(unmarked);
    expect(after.progress.percentComplete).toBe(
      before.progress.percentComplete
    );
    expect(after.forecast.forecastCompletion.getTime()).toBe(epoch(23));
    expect(after.rag.flagged.some((f) => f.key === 'm1')).toBe(true);
    expect(rowFor(after.rows, 'm1').met).toBe(false);
  });

  it('the status colour moves and reverts: both slipping points met reads green, un-marking one reads amber again', () => {
    const bothMet = viewWithMark(
      viewWithMark({}, 'm1', day(2)),
      'm7',
      day(4)
    );
    expect(derive(bothMet).rag.status).toBe('green');

    const oneUnmarked = viewWithoutMark(bothMet, 'm7');
    expect(derive(oneUnmarked).rag.status).toBe('amber');
  });

  it('the fallback view is exactly the shape the refreshed read returns, gates carried through untouched', () => {
    const gateRows = [
      { stage: 0, gate_status: 'passed', passed_at: '2026-03-02T09:15:00.000Z' },
      { stage: 1, gate_status: 'not_started', passed_at: null },
    ];
    const base = buildMetPointsView([], gateRows);

    const fallback = viewWithMark(base, 'm1', day(1));
    const refreshed = buildMetPointsView(
      [{ milestone_key: 'm1', met_date: day(1) }],
      gateRows
    );
    expect(fallback).toEqual(refreshed);

    expect(viewWithoutMark(fallback, 'm1')).toEqual(base);
  });
});

describe('the store operations receive the chosen arguments', () => {
  // A spy client: the rpc records the mark-or-amend call, the delete builder
  // records the table and its filters, both resolving as Supabase would.
  function makeArgSpy() {
    const calls = { rpc: [], deletes: [] };
    return {
      calls,
      async rpc(fn, args) {
        calls.rpc.push([fn, args]);
        return { data: { id: 'row-1' }, error: null };
      },
      from(table) {
        return {
          delete() {
            const filters = [];
            const builder = {
              eq(col, val) {
                filters.push([col, val]);
                return builder;
              },
              then(resolve, reject) {
                calls.deletes.push({ table, filters: [...filters] });
                return Promise.resolve({ error: null }).then(resolve, reject);
              },
            };
            return builder;
          },
        };
      },
    };
  }

  it('mark-or-amend goes to record_milestone_actual with the validated chosen date, verbatim', async () => {
    const spy = makeArgSpy();
    const chosen = validateMetDate(day(1), TODAY);
    expect(chosen.ok).toBe(true);

    const { actual, error } = await markMilestoneMet(spy, {
      projectId: 'project-1',
      milestoneKey: 'm1',
      metDate: chosen.metDate,
    });
    expect(error).toBe(null);
    expect(actual).toEqual({ id: 'row-1' });
    expect(spy.calls.rpc).toEqual([
      [
        'record_milestone_actual',
        {
          p_project_id: 'project-1',
          p_milestone_key: 'm1',
          p_met_date: day(1),
          p_recorded_by: null,
        },
      ],
    ]);
  });

  it('un-mark is a plain delete on the actuals row, keyed by project and milestone', async () => {
    const spy = makeArgSpy();
    const { error } = await unmarkMilestone(spy, {
      projectId: 'project-1',
      milestoneKey: 'm1',
    });
    expect(error).toBe(null);
    expect(spy.calls.deletes).toEqual([
      {
        table: 'programme_milestone_actuals',
        filters: [
          ['project_id', 'project-1'],
          ['milestone_key', 'm1'],
        ],
      },
    ]);
    expect(spy.calls.rpc).toEqual([]);
  });
});

describe('writeControls, the existing boundary presented, nothing new', () => {
  it('a writer sees the mark controls on a milestone', () => {
    expect(writeControls({ kind: 'milestone', canEdit: true })).toEqual({
      canWrite: true,
      canMark: true,
    });
  });

  it('a read-only member sees no write control of any kind', () => {
    expect(writeControls({ kind: 'milestone', canEdit: false })).toEqual({
      canWrite: false,
      canMark: false,
    });
  });

  it('a gate is never markable here, whoever is looking: gate-met belongs to the gate mechanic', () => {
    expect(writeControls({ kind: 'gate', canEdit: true })).toEqual({
      canWrite: true,
      canMark: false,
    });
    expect(writeControls({ kind: 'gate', canEdit: false })).toEqual({
      canWrite: false,
      canMark: false,
    });
  });

  it('defaults closed: no access resolved means no controls', () => {
    expect(writeControls({})).toEqual({ canWrite: false, canMark: false });
    expect(writeControls()).toEqual({ canWrite: false, canMark: false });
  });
});

describe('utcDayValue', () => {
  it('gives the UTC calendar day of an instant in the date input value shape', () => {
    expect(utcDayValue(iso(1))).toBe(day(1));
    expect(utcDayValue(new Date(epoch(1)))).toBe(day(1));
    // Pinned to the UTC day whatever the clock reads, matching the surface.
    expect(utcDayValue('2026-03-05T17:30:00.000Z')).toBe('2026-03-05');
  });

  it('returns null where nothing parses, never an invented day', () => {
    expect(utcDayValue(null)).toBe(null);
    expect(utcDayValue('')).toBe(null);
    expect(utcDayValue('not a date')).toBe(null);
  });
});

describe('validateMetDate, the light future-date guard', () => {
  it('passes today and any earlier day, handing the chosen value through verbatim', () => {
    expect(validateMetDate(day(5), TODAY)).toEqual({
      ok: true,
      metDate: day(5),
    });
    expect(validateMetDate(day(1), TODAY)).toEqual({
      ok: true,
      metDate: day(1),
    });
  });

  it('compares calendar days, not instants: today mid-afternoon still accepts today', () => {
    expect(validateMetDate('2026-02-09', '2026-02-09T16:45:00.000Z').ok).toBe(
      true
    );
  });

  it('refuses a future day, because a milestone cannot have been met in the future', () => {
    expect(validateMetDate(day(6), TODAY)).toEqual({
      ok: false,
      reason: FUTURE_MET_DATE_REASON,
    });
  });

  it('refuses malformed input rather than guessing a date', () => {
    for (const bad of ['', '09/02/2026', '2026-2-9', '2026-02-31', null, 42]) {
      expect(validateMetDate(bad, TODAY)).toEqual({
        ok: false,
        reason: INVALID_MET_DATE_REASON,
      });
    }
  });

  it('stays light with no parseable today: the format still validates, the future check is skipped', () => {
    expect(validateMetDate(day(6), null).ok).toBe(true);
    expect(validateMetDate('bad', null).ok).toBe(false);
  });
});

describe('nothing is mutated', () => {
  it('no helper writes to the rows, the engine outputs, or the met-points view', () => {
    const metView = deepFreeze({ m1: { met: true, metDate: day(1) } });
    const programme = deepFreeze(canonicalBaseline());
    const forecast = deepFreeze(deriveForecast(programme, metView, TODAY));
    const rag = deepFreeze(
      deriveRAG(programme, metView, TODAY, STANDARD_TOLERANCE)
    );
    const rows = deepFreeze(scheduleRows(programme, forecast, rag));

    const before = {
      view: JSON.stringify(metView),
      rows: JSON.stringify(rows),
    };

    // Strict mode: any write to the frozen inputs throws, so completing is
    // the proof.
    for (const row of rows) detailFields(row, metView);
    const withMark = viewWithMark(metView, 'm2', day(3));
    const withoutMark = viewWithoutMark(metView, 'm1');
    writeControls({ kind: 'milestone', canEdit: true });
    utcDayValue(iso(3));
    validateMetDate(day(3), TODAY);

    expect(JSON.stringify(metView)).toBe(before.view);
    expect(JSON.stringify(rows)).toBe(before.rows);
    // The view updates are fresh objects, never the given one.
    expect(withMark).not.toBe(metView);
    expect(withoutMark).not.toBe(metView);
    expect(withMark.m1).toEqual({ met: true, metDate: day(1) });
    expect(withoutMark.m1).toBeUndefined();
  });
});

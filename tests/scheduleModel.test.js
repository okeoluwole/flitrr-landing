import { describe, it, expect } from 'vitest';
import {
  VARIANCE_DIRECTIONS,
  scheduleRows,
  highLevelRows,
  registerGroups,
  timelineLayout,
  varianceText,
} from '../app/pulse/app/programme/scheduleModel.js';
import { deriveRAG } from '../lib/engine/programmeRAG.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';

/**
 * The Programme Schedule tab display model (Phase 3.7). Proves the tab's
 * three faces derive correctly from what the page already holds: the row set
 * joins the frozen baseline, the forecast tree, and the RAG flags without
 * touching any of them; the high-level filter keeps exactly the gates, the
 * critical milestones, and anything flagged, ordered by baseline date
 * earliest first, while an excluded standard point stays in the full
 * schedule; the flagged part follows the RAG derivation the tolerance dial
 * re-runs; the four columns read Item off the baseline, Baseline off the
 * baseline, Current off the forecast engine, and Variance as the display
 * subtraction with its direction plain across ahead, on baseline, and
 * behind; the Register groups by stage in programme order; the Timeline
 * positions every point from its baseline and forecast dates only; and no
 * helper mutates an engine output.
 *
 * The engine inputs are built in the assembled-baseline shape with a fixed
 * UTC anchor, the same fixed-anchor style as the engine, trackingModel, and
 * overviewModel tests, and the engines themselves produce the outputs the
 * display model reads, so the seam tested is the real one.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// An ISO date a whole number of weeks after the anchor, the string form the
// frozen baseline carries after its jsonb round trip.
const iso = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK).toISOString();
// The epoch for a whole number of weeks after the anchor.
const epoch = (weeks) => ANCHOR + weeks * MS_PER_WEEK;

const mkMs = (key, criticality, baselineDate, name = key) => ({
  key,
  name,
  criticality,
  baselineDate,
});

// The canonical fixture: two spine stages and the concurrent sales stage
// around a not-applicable one. Stage 7's points sit early in time, between
// stage 0's, so baseline order genuinely differs from programme order and
// the high-level sort is exercised for real.
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
const TIGHT_TOLERANCE = 2;

// The full derivation the surface makes, at a given tolerance and met view.
function derive({ metView = {}, tolerance = STANDARD_TOLERANCE } = {}) {
  const programme = canonicalBaseline();
  const forecast = deriveForecast(programme, metView, TODAY);
  const rag = deriveRAG(programme, metView, TODAY, tolerance);
  const rows = scheduleRows(programme, forecast, rag);
  return { programme, forecast, rag, rows };
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

describe('scheduleRows', () => {
  it('builds one row per trackable point in programme order, skipping the not-applicable stage', () => {
    const { rows } = derive();
    expect(rows.map((r) => r.key)).toEqual([
      'm1',
      'm2',
      'm3',
      'gate_0',
      'm4',
      'gate_1',
      'm7',
      'gate_7',
    ]);
    // The not-applicable stage contributes nothing, exactly as the engines
    // exclude it.
    expect(rows.some((r) => r.key === 'm5' || r.key === 'gate_2')).toBe(false);
  });

  it('carries Item off the frozen baseline: name, kind, stage, stage name, and criticality, gates critical by nature', () => {
    const { rows } = derive();
    const m1 = rows.find((r) => r.key === 'm1');
    expect(m1.name).toBe('Heads of terms agreed');
    expect(m1.kind).toBe('milestone');
    expect(m1.stage).toBe(0);
    expect(m1.stageName).toBe('Land and Site Acquisition');
    expect(m1.criticality).toBe('critical');

    const m2 = rows.find((r) => r.key === 'm2');
    expect(m2.criticality).toBe('standard');

    for (const gate of rows.filter((r) => r.kind === 'gate')) {
      expect(gate.criticality).toBe('critical');
    }
    const gate0 = rows.find((r) => r.key === 'gate_0');
    expect(gate0.name).toBe('Site acquired');
  });

  it('reads Baseline off the baseline and Current off the forecast engine, met flag included', () => {
    const metView = { m1: { met: true, metDate: iso(1) } };
    const { forecast, rows } = derive({ metView });

    const m1 = rows.find((r) => r.key === 'm1');
    expect(m1.baselineDate.getTime()).toBe(epoch(2));
    // Current is the forecast engine's date: the stamped actual once met.
    expect(m1.met).toBe(true);
    expect(m1.currentDate.getTime()).toBe(epoch(1));

    // For an unmet point, Current is the rolled forecast, exactly as the
    // engine produced it.
    const engineM2 = forecast.stages[0].activities[0].milestones.find(
      (m) => m.key === 'm2'
    );
    const m2 = rows.find((r) => r.key === 'm2');
    expect(m2.met).toBe(false);
    expect(m2.currentDate.getTime()).toBe(engineM2.forecastDate.getTime());
  });

  it('derives Variance as forecast minus baseline with the direction plain, across ahead, on baseline, and behind', () => {
    // Behind: nothing met, m1 floors at today, three weeks past its baseline.
    const behind = derive().rows.find((r) => r.key === 'm1');
    expect(behind.varianceWeeks).toBe(3);
    expect(behind.direction).toBe(VARIANCE_DIRECTIONS.BEHIND);

    // On baseline: m1 met exactly on its date, so m2's roll reproduces the
    // baseline.
    const onBaseline = derive({
      metView: { m1: { met: true, metDate: iso(2) } },
    });
    const m1On = onBaseline.rows.find((r) => r.key === 'm1');
    expect(m1On.varianceWeeks).toBe(0);
    expect(m1On.direction).toBe(VARIANCE_DIRECTIONS.ON_BASELINE);
    const m2On = onBaseline.rows.find((r) => r.key === 'm2');
    expect(m2On.varianceWeeks).toBe(0);
    expect(m2On.direction).toBe(VARIANCE_DIRECTIONS.ON_BASELINE);

    // Ahead: m1 met a week early pulls m2's roll a week ahead of baseline.
    const ahead = derive({ metView: { m1: { met: true, metDate: iso(1) } } });
    const m1Ahead = ahead.rows.find((r) => r.key === 'm1');
    expect(m1Ahead.varianceWeeks).toBe(-1);
    expect(m1Ahead.direction).toBe(VARIANCE_DIRECTIONS.AHEAD);
    const m2Ahead = ahead.rows.find((r) => r.key === 'm2');
    expect(m2Ahead.varianceWeeks).toBe(-1);
    expect(m2Ahead.direction).toBe(VARIANCE_DIRECTIONS.AHEAD);
  });

  it('carries the flag and the colour off the RAG derivation, and a knock-on behind row stays unflagged', () => {
    const { rows } = derive();

    const m1 = rows.find((r) => r.key === 'm1');
    expect(m1.flagged).toBe(true);
    expect(m1.flagColour).toBe('amber');

    const m7 = rows.find((r) => r.key === 'm7');
    expect(m7.flagged).toBe(true);
    expect(m7.flagColour).toBe('amber');

    // m2 is behind on variance (the knock-on from m1's slip) but its own
    // baseline date has not passed, so the RAG derivation does not flag it
    // and the row honestly carries no flag.
    const m2 = rows.find((r) => r.key === 'm2');
    expect(m2.direction).toBe(VARIANCE_DIRECTIONS.BEHIND);
    expect(m2.flagged).toBe(false);
    expect(m2.flagColour).toBe(null);
  });
});

describe('highLevelRows', () => {
  it('keeps exactly the gates, the critical milestones, and anything flagged; a standard unflagged point is excluded yet stays in the full schedule', () => {
    const { rows } = derive();
    const highLevel = highLevelRows(rows);

    // m7 is standard but flagged, so the flag pulls it up; m2 and m3 are
    // standard and unflagged, so they live in the full schedule only.
    expect(new Set(highLevel.map((r) => r.key))).toEqual(
      new Set(['m1', 'm4', 'gate_0', 'gate_1', 'gate_7', 'm7'])
    );
    expect(rows.some((r) => r.key === 'm2')).toBe(true);
    expect(rows.some((r) => r.key === 'm3')).toBe(true);
  });

  it('orders by baseline date, earliest first, not programme order', () => {
    const { rows } = derive();
    // Stage 7's points sit early in time, so the sort must pull them ahead
    // of stage 0's gate.
    expect(highLevelRows(rows).map((r) => r.key)).toEqual([
      'm1',
      'm7',
      'gate_7',
      'gate_0',
      'm4',
      'gate_1',
    ]);
  });

  it('sinks an undated row to the end and keeps ties stable in programme order', () => {
    const rows = [
      { key: 'a', kind: 'gate', criticality: 'critical', flagged: false, baselineDate: null },
      { key: 'b', kind: 'gate', criticality: 'critical', flagged: false, baselineDate: iso(3) },
      { key: 'c', kind: 'gate', criticality: 'critical', flagged: false, baselineDate: iso(3) },
    ];
    expect(highLevelRows(rows).map((r) => r.key)).toEqual(['b', 'c', 'a']);
  });

  it('follows the RAG derivation the tolerance dial re-runs: membership tracks the flagged list, and the carried colour tightens with the tolerance', () => {
    // The filter's flagged part is exactly the derivation it is handed: a
    // standard point flagged in one derivation and not another enters the
    // set exactly when flagged.
    const { programme, forecast, rag } = derive();
    const withoutFlag = {
      ...rag,
      flagged: rag.flagged.filter((f) => f.key !== 'm7'),
    };
    const rowsFlagged = scheduleRows(programme, forecast, rag);
    const rowsUnflagged = scheduleRows(programme, forecast, withoutFlag);
    expect(highLevelRows(rowsFlagged).some((r) => r.key === 'm7')).toBe(true);
    expect(highLevelRows(rowsUnflagged).some((r) => r.key === 'm7')).toBe(
      false
    );

    // On the live observed-slip rule the tolerance moves a critical point's
    // colour, and the breakdown carries the fresh colour through: m1, three
    // weeks behind, reads amber at the standard four weeks and red at the
    // tight two.
    const standard = derive({ tolerance: STANDARD_TOLERANCE });
    const tight = derive({ tolerance: TIGHT_TOLERANCE });
    const m1Standard = highLevelRows(standard.rows).find(
      (r) => r.key === 'm1'
    );
    const m1Tight = highLevelRows(tight.rows).find((r) => r.key === 'm1');
    expect(m1Standard.flagColour).toBe('amber');
    expect(m1Tight.flagColour).toBe('red');
  });
});

describe('registerGroups', () => {
  it('groups the full set by stage in programme order, rows in programme order within each stage', () => {
    const { rows } = derive();
    const groups = registerGroups(rows);
    expect(groups.map((g) => g.stage)).toEqual([0, 1, 7]);
    expect(groups[0].stageName).toBe('Land and Site Acquisition');
    expect(groups[0].rows.map((r) => r.key)).toEqual([
      'm1',
      'm2',
      'm3',
      'gate_0',
    ]);
    expect(groups[2].rows.map((r) => r.key)).toEqual(['m7', 'gate_7']);
  });
});

describe('timelineLayout', () => {
  it('positions every point from its baseline and forecast dates only, on the one shared domain', () => {
    const { rows } = derive();
    const layout = timelineLayout(rows, TODAY);

    // The domain is set by the dates themselves: the earliest baseline (m1)
    // to the latest forecast (gate_1, rolled three weeks past its week-20
    // baseline).
    expect(layout.start.getTime()).toBe(epoch(2));
    expect(layout.end.getTime()).toBe(epoch(23));
    const span = epoch(23) - epoch(2);

    const frac = (weeks) => (epoch(weeks) - epoch(2)) / span;
    expect(layout.todayFrac).toBeCloseTo(frac(5), 12);

    const lane0 = layout.lanes.find((l) => l.stage === 0);
    const m1 = lane0.points.find((p) => p.key === 'm1');
    expect(m1.baselineFrac).toBe(0);
    expect(m1.currentFrac).toBeCloseTo(frac(5), 12);

    const lane7 = layout.lanes.find((l) => l.stage === 7);
    const m7 = lane7.points.find((p) => p.key === 'm7');
    expect(m7.baselineFrac).toBeCloseTo(frac(4), 12);
    expect(m7.currentFrac).toBeCloseTo(frac(5), 12);

    const lane1 = layout.lanes.find((l) => l.stage === 1);
    const gate1 = lane1.points.find((p) => p.key === 'gate_1');
    expect(gate1.baselineFrac).toBeCloseTo(frac(20), 12);
    expect(gate1.currentFrac).toBe(1);
  });

  it('keeps lane order and point order as given: no invented ordering beyond the dates', () => {
    const { rows } = derive();
    const layout = timelineLayout(rows, TODAY);
    expect(layout.lanes.map((l) => l.stage)).toEqual([0, 1, 7]);
    // Stage 7 sits early in time, but its lane and points keep programme
    // order; only the fractions say where its points sit.
    expect(layout.lanes[2].points.map((p) => p.key)).toEqual([
      'm7',
      'gate_7',
    ]);
  });

  it('derives each lane span from its own baseline dates', () => {
    const { rows } = derive();
    const layout = timelineLayout(rows, TODAY);
    const span = epoch(23) - epoch(2);
    const frac = (weeks) => (epoch(weeks) - epoch(2)) / span;

    const lane0 = layout.lanes.find((l) => l.stage === 0);
    expect(lane0.spanStartFrac).toBe(0);
    expect(lane0.spanEndFrac).toBeCloseTo(frac(12), 12);

    const lane7 = layout.lanes.find((l) => l.stage === 7);
    expect(lane7.spanStartFrac).toBeCloseTo(frac(4), 12);
    expect(lane7.spanEndFrac).toBeCloseTo(frac(9), 12);
  });

  it('ticks are UTC month boundaries inside the domain, thinned, never invented dates', () => {
    const { rows } = derive();
    const layout = timelineLayout(rows, TODAY);
    expect(layout.ticks.length).toBeGreaterThan(0);
    expect(layout.ticks.length).toBeLessThanOrEqual(6);
    for (const tick of layout.ticks) {
      expect(tick.date.getUTCDate()).toBe(1);
      expect(tick.frac).toBeGreaterThan(0);
      expect(tick.frac).toBeLessThan(1);
    }
    expect(layout.ticks[0].date.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('is honest at the edges: a degenerate domain centres, a missing today places no marker', () => {
    const oneRow = [
      {
        key: 'only',
        kind: 'gate',
        criticality: 'critical',
        flagged: false,
        stage: 0,
        stageName: 'Only',
        baselineDate: iso(0),
        currentDate: iso(0),
      },
    ];
    const degenerate = timelineLayout(oneRow, iso(0));
    expect(degenerate.lanes[0].points[0].baselineFrac).toBe(0.5);
    expect(degenerate.lanes[0].points[0].currentFrac).toBe(0.5);
    expect(degenerate.ticks).toEqual([]);

    const noToday = timelineLayout(derive().rows, null);
    expect(noToday.todayFrac).toBe(null);
    expect(noToday.start).not.toBe(null);

    const empty = timelineLayout([], TODAY);
    expect(empty.start).toBe(null);
    expect(empty.end).toBe(null);
    expect(empty.todayFrac).toBe(null);
    expect(empty.lanes).toEqual([]);
    expect(empty.ticks).toEqual([]);
  });
});

describe('varianceText', () => {
  it('states the direction plainly under the half-week convention', () => {
    expect(varianceText(0)).toBe('on baseline');
    expect(varianceText(0.4)).toBe('on baseline');
    expect(varianceText(-0.4)).toBe('on baseline');
    expect(varianceText(3)).toBe('3 wk behind');
    expect(varianceText(2.6)).toBe('3 wk behind');
    expect(varianceText(-2)).toBe('2 wk ahead');
    expect(varianceText(null)).toBe(null);
    expect(varianceText(undefined)).toBe(null);
    expect(varianceText(Number.NaN)).toBe(null);
  });
});

describe('nothing is mutated', () => {
  it('no helper writes to the baseline, the engine outputs, or the given rows', () => {
    const programme = deepFreeze(canonicalBaseline());
    const metView = deepFreeze({ m1: { met: true, metDate: iso(1) } });
    const forecast = deepFreeze(deriveForecast(programme, metView, TODAY));
    const rag = deepFreeze(
      deriveRAG(programme, metView, TODAY, STANDARD_TOLERANCE)
    );

    const before = {
      forecast: JSON.stringify(forecast),
      rag: JSON.stringify(rag),
    };

    // Strict mode: any write to the frozen inputs throws, so completing is
    // the proof.
    const rows = deepFreeze(scheduleRows(programme, forecast, rag));
    highLevelRows(rows);
    registerGroups(rows);
    timelineLayout(rows, TODAY);
    for (const row of rows) varianceText(row.varianceWeeks);

    expect(JSON.stringify(forecast)).toBe(before.forecast);
    expect(JSON.stringify(rag)).toBe(before.rag);
  });
});

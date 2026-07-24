import { describe, it, expect } from 'vitest';
import {
  programmeChart,
  slipText,
} from '../app/pulse/app/programme/chartModel.js';
import { scheduleRows } from '../app/pulse/app/programme/scheduleModel.js';
import { deriveRAG } from '../lib/engine/programmeRAG.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';
import { deriveStageStates } from '../lib/engine/stageStates.js';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';

/**
 * The Programme chart view-model (Note 17, finding 4). Proves the one chart is
 * a deterministic function of records the tracker table already reads: each
 * stage bar is a stage window taken from the stage-state engine over the
 * baseline's own gate dates, never a spread of markers, so a concurrent stage
 * 7 spans from sales launch and no bar collapses to nothing; each point holds
 * its baseline and current positions with the slip in weeks, a milestone
 * pairing solid to open across a drift bar and a gate reading its slip through
 * its stage bar's forecast extension rather than a second diamond; the axis
 * carries a quarter grid and one today line; and the completion block states
 * the forecast against the target in the tracker's own variance language.
 *
 * The engine inputs are built in the assembled-baseline shape with a fixed UTC
 * anchor, the same fixed-anchor style as the engine, trackingModel, and
 * scheduleModel tests, and the engines themselves produce the outputs the view
 * model reads, so the seam tested is the real one. The stage states come from
 * deriveStageStates over the real template, exactly as the page derives them.
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

/**
 * The canonical fixture: an off-plan scheme whose sales stage genuinely runs
 * alongside the build. Stage 7's own points sit at weeks 34 and 52, inside the
 * construction stage, while its gate closes at week 90, so a stage bar drawn
 * from the spread of its markers would misplace it and a bar drawn from the
 * strict previous gate would squeeze it into the final ten weeks. Only the
 * stage-state window puts it where the dates actually are.
 */
function canonicalBaseline() {
  return {
    version: 'test-1.0.0',
    projectStart: iso(0),
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
            milestones: [mkMs('m_hot', 'critical', iso(2), 'Heads of terms agreed')],
          },
        ],
        gate: {
          key: 'gate_0',
          name: 'Site acquired',
          baselineDate: iso(12),
          closesActivityKey: '0a',
        },
      },
      {
        stage: 3,
        name: 'Design and Planning Approvals',
        applicable: true,
        stageStart: iso(12),
        activities: [
          {
            key: '3a',
            name: 'Design and consent',
            durationWeeks: 18,
            milestones: [
              mkMs('m_plan', 'critical', iso(26), 'Planning consent granted'),
            ],
          },
        ],
        gate: {
          key: 'gate_3',
          name: 'Consent secured',
          baselineDate: iso(30),
          closesActivityKey: '3a',
        },
      },
      {
        stage: 5,
        name: 'Construction',
        applicable: true,
        stageStart: iso(30),
        activities: [
          {
            key: '5a',
            name: 'Build',
            durationWeeks: 50,
            milestones: [
              mkMs('m_found', 'standard', iso(40), 'Foundations complete'),
              mkMs('m_topout', 'standard', iso(64), 'Topping out'),
            ],
          },
        ],
        gate: {
          key: 'gate_5',
          name: 'Practical completion',
          baselineDate: iso(80),
          closesActivityKey: '5a',
        },
      },
      {
        stage: 7,
        name: 'Sales and Disposal',
        applicable: true,
        stageStart: iso(80),
        activities: [
          {
            key: '7a',
            name: 'Marketing and sales',
            durationWeeks: 10,
            milestones: [
              mkMs('m_launch', 'standard', iso(34), 'Sales launch'),
              mkMs('m_firstx', 'critical', iso(52), 'First unit exchanged'),
            ],
          },
        ],
        gate: {
          key: 'gate_7',
          name: 'Disposal complete',
          baselineDate: iso(90),
          closesActivityKey: '7a',
        },
      },
    ],
  };
}

// Today at week 45, mid-construction. The early stages are behind us, the
// consent gate passed three weeks late, and the sales launch ran three weeks
// late with it.
const TODAY = iso(45);
const STANDARD_TOLERANCE = 4;

const MET_VIEW = Object.freeze({
  m_hot: { met: true, metDate: iso(2) },
  gate_0: { met: true, metDate: iso(12) },
  m_plan: { met: true, metDate: iso(26) },
  gate_3: { met: true, metDate: iso(33) },
  m_launch: { met: true, metDate: iso(37) },
  m_found: { met: true, metDate: iso(42) },
});

// The off-plan trigger and the plain one, read exactly as the page reads them:
// through deriveStageStates over the real template, never a manual flag.
const OFF_PLAN_STATES = deriveStageStates(PROGRAMME_TEMPLATE, {
  fundingStructureType: 'off_plan_presales',
  country: 'united_kingdom',
});
const SEQUENTIAL_STATES = deriveStageStates(PROGRAMME_TEMPLATE, {
  fundingStructureType: 'debt_and_equity',
  country: 'united_kingdom',
});

// The full derivation the surface makes, then the chart over it.
function derive({ metView = MET_VIEW, stageStates = OFF_PLAN_STATES } = {}) {
  const programme = canonicalBaseline();
  const forecast = deriveForecast(programme, metView, TODAY);
  const rag = deriveRAG(programme, metView, TODAY, STANDARD_TOLERANCE);
  const rows = scheduleRows(programme, forecast, rag);
  const chart = programmeChart(programme, rows, {
    today: TODAY,
    stageStates,
    forecastCompletion: forecast.forecastCompletion,
  });
  return { programme, forecast, rag, rows, chart };
}

// The domain the canonical fixture sets: the project start at week 0 to the
// latest forecast, gate 7 rolled to week 93.
const DOMAIN_WEEKS = 93;
const frac = (weeks) => weeks / DOMAIN_WEEKS;

const trackFor = (chart, stage) => chart.tracks.find((t) => t.stage === stage);
const pointFor = (chart, stage, key) =>
  trackFor(chart, stage).points.find((p) => p.key === key);

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

describe('the domain and the axis', () => {
  it('spans exactly what it places, from the project start to the latest forecast', () => {
    const { chart } = derive();
    expect(chart.hasDomain).toBe(true);
    expect(chart.start.getTime()).toBe(epoch(0));
    expect(chart.end.getTime()).toBe(epoch(DOMAIN_WEEKS));
  });

  it('places one today line from the today it was handed, never a clock read', () => {
    const { chart } = derive();
    expect(chart.todayFrac).toBeCloseTo(frac(45), 12);

    // No today given, no line. The chart still draws.
    const noToday = programmeChart(
      canonicalBaseline(),
      derive().rows,
      { stageStates: OFF_PLAN_STATES }
    );
    expect(noToday.todayFrac).toBe(null);
    expect(noToday.hasDomain).toBe(true);
  });

  it('lays a quarter grid of real UTC quarters, the leading band drawing no boundary line', () => {
    const { chart } = derive();
    expect(chart.quarters.map((q) => q.label)).toEqual([
      'Q1 26',
      'Q2 26',
      'Q3 26',
      'Q4 26',
      'Q1 27',
      'Q2 27',
      'Q3 27',
      'Q4 27',
    ]);

    // The first band opens before the domain does, so it is clamped and draws
    // no gridline on the frame edge; every later band opens on a real boundary
    // inside the domain.
    expect(chart.quarters[0].startFrac).toBe(0);
    expect(chart.quarters[0].gridline).toBe(false);
    for (const band of chart.quarters.slice(1)) {
      expect(band.gridline).toBe(true);
      expect(band.startFrac).toBeGreaterThan(0);
    }
    // Clamped into the domain, ordered, and every band labelled at this length.
    expect(chart.quarters[chart.quarters.length - 1].endFrac).toBe(1);
    for (const band of chart.quarters) {
      expect(band.startFrac).toBeGreaterThanOrEqual(0);
      expect(band.endFrac).toBeLessThanOrEqual(1);
      expect(band.midFrac).toBeGreaterThan(band.startFrac - 1e-9);
      expect(band.labelled).toBe(true);
    }
  });

  it('thins the labels on a long programme but hides no boundary', () => {
    // Twelve years of programme: far past the label cap, so only the first
    // quarter of each year is labelled while every gridline stays.
    const long = {
      projectStart: iso(0),
      stages: [
        {
          stage: 0,
          name: 'Long',
          applicable: true,
          stageStart: iso(0),
          activities: [],
          gate: { key: 'gate_0', name: 'Long', baselineDate: iso(52 * 12) },
        },
      ],
    };
    const chart = programmeChart(long, [], { today: TODAY });
    expect(chart.quarters.length).toBeGreaterThan(16);
    for (const band of chart.quarters) {
      expect(band.labelled).toBe(band.quarter === 1);
    }
  });

  it('is honest with nothing to place: no domain, no quarters, no today', () => {
    const chart = programmeChart({ stages: [] }, [], { today: TODAY });
    expect(chart.hasDomain).toBe(false);
    expect(chart.start).toBe(null);
    expect(chart.end).toBe(null);
    expect(chart.todayFrac).toBe(null);
    expect(chart.quarters).toEqual([]);
    expect(chart.tracks).toEqual([]);
  });
});

describe('the stage tracks', () => {
  it('takes each sequential window from the previous applicable gate, the first from the project start', () => {
    const { chart } = derive();
    expect(chart.tracks.map((t) => t.stage)).toEqual([0, 3, 5, 7]);

    const s0 = trackFor(chart, 0);
    expect(s0.startFrac).toBe(0);
    expect(s0.endFrac).toBeCloseTo(frac(12), 12);
    expect(s0.concurrent).toBe(false);
    expect(s0.anchorLabel).toBe(null);

    const s3 = trackFor(chart, 3);
    expect(s3.startFrac).toBeCloseTo(frac(12), 12);
    expect(s3.endFrac).toBeCloseTo(frac(30), 12);

    const s5 = trackFor(chart, 5);
    expect(s5.startFrac).toBeCloseTo(frac(30), 12);
    expect(s5.endFrac).toBeCloseTo(frac(80), 12);

    // The bar's own label: its length in whole weeks, the two dates
    // subtracted, never a duration invented for the drawing.
    expect(s0.extentWeeks).toBe(12);
    expect(s3.extentWeeks).toBe(18);
    expect(s5.extentWeeks).toBe(50);
  });

  it('renders a concurrent stage 7 from sales launch, its own track and never a zero-width stage', () => {
    const { chart } = derive();
    const s7 = trackFor(chart, 7);

    expect(s7.concurrent).toBe(true);
    expect(s7.anchorLabel).toBe('sales launch');
    // The window opens at the stage 3 gate, consent, and closes at its own
    // gate: the whole remaining programme, not the ten weeks after handover.
    expect(s7.startFrac).toBeCloseTo(frac(30), 12);
    expect(s7.endFrac).toBeCloseTo(frac(90), 12);
    expect(s7.endFrac - s7.startFrac).toBeGreaterThan(0);
    expect(s7.extentWeeks).toBe(60);

    // Its own points fall inside the track, which is the point of the window:
    // under the strict reading they would sit weeks before the stage opened.
    for (const point of s7.points.filter((p) => p.kind === 'milestone')) {
      expect(point.baselineFrac).toBeGreaterThanOrEqual(s7.startFrac);
      expect(point.baselineFrac).toBeLessThanOrEqual(s7.endFrac);
    }

    // A concurrent stage does not push the stage after it: the spine chain is
    // unchanged, so stage 5 still opens at the stage 3 gate.
    expect(trackFor(chart, 5).startFrac).toBeCloseTo(frac(30), 12);
  });

  it('reads concurrency from the baseline: with no off-plan or Nigeria trigger stage 7 is sequential', () => {
    const { chart } = derive({ stageStates: SEQUENTIAL_STATES });
    const s7 = trackFor(chart, 7);
    expect(s7.concurrent).toBe(false);
    expect(s7.anchorLabel).toBe(null);
    // The strict window: the previous applicable gate to its own.
    expect(s7.startFrac).toBeCloseTo(frac(80), 12);
    expect(s7.endFrac).toBeCloseTo(frac(90), 12);
  });

  it('never draws a collapsed bar: an opening that does not precede the close falls back to an honest one', () => {
    // A stage whose previous gate lands on its own gate date. The derived
    // opening would give a zero-width bar, so the stage's own earliest
    // baseline date is used instead.
    const squeezed = {
      projectStart: iso(0),
      stages: [
        {
          stage: 0,
          name: 'First',
          applicable: true,
          stageStart: iso(0),
          activities: [],
          gate: { key: 'gate_0', name: 'First', baselineDate: iso(30) },
        },
        {
          stage: 1,
          name: 'Squeezed',
          applicable: true,
          stageStart: iso(30),
          activities: [
            {
              key: '1a',
              name: 'Work',
              milestones: [mkMs('m_early', 'standard', iso(20), 'Early point')],
            },
          ],
          gate: { key: 'gate_1', name: 'Squeezed', baselineDate: iso(30) },
        },
      ],
    };
    const forecast = deriveForecast(squeezed, {}, TODAY);
    const rag = deriveRAG(squeezed, {}, TODAY, STANDARD_TOLERANCE);
    const rows = scheduleRows(squeezed, forecast, rag);
    const chart = programmeChart(squeezed, rows, { today: TODAY });

    const squeezedTrack = chart.tracks.find((t) => t.stage === 1);
    expect(squeezedTrack.startFrac).toBeLessThan(squeezedTrack.endFrac);

    // With nothing earlier to fall back to, the stage draws its gate and no
    // bar rather than a zero-width mark pretending to be a stage.
    const bare = {
      projectStart: iso(30),
      stages: [
        {
          stage: 1,
          name: 'Bare',
          applicable: true,
          stageStart: iso(30),
          activities: [],
          gate: { key: 'gate_1', name: 'Bare', baselineDate: iso(30) },
        },
      ],
    };
    const bareChart = programmeChart(bare, [], { today: TODAY });
    expect(bareChart.tracks[0].startFrac).toBe(null);
    expect(bareChart.tracks[0].endFrac).not.toBe(null);
  });

  it('leaves a not-applicable stage off the chart entirely', () => {
    const programme = canonicalBaseline();
    programme.stages[1].applicable = false;
    const chart = programmeChart(programme, [], {
      today: TODAY,
      stageStates: OFF_PLAN_STATES,
    });
    expect(chart.tracks.map((t) => t.stage)).toEqual([0, 5, 7]);
  });
});

describe('the paired positions', () => {
  it('pairs a drifted milestone: solid at baseline, open at current, a drift bar between, the slip in weeks', () => {
    const { rows, chart } = derive();

    // Topping out: baseline week 64, rolled to week 66 by the two weeks the
    // foundations ran late. The register row and the chart point agree.
    const row = rows.find((r) => r.key === 'm_topout');
    expect(row.baselineDate.getTime()).toBe(epoch(64));
    expect(row.currentDate.getTime()).toBe(epoch(66));
    expect(row.varianceWeeks).toBe(2);

    const point = pointFor(chart, 5, 'm_topout');
    expect(point.baselineFrac).toBeCloseTo(frac(64), 12);
    expect(point.currentFrac).toBeCloseTo(frac(66), 12);
    expect(point.showCurrent).toBe(true);
    expect(point.drift.fromFrac).toBeCloseTo(frac(64), 12);
    expect(point.drift.toFrac).toBeCloseTo(frac(66), 12);
    expect(point.slipWeeks).toBe(2);
    expect(point.slipLabel).toBe('+2 wk');
    expect(point.criticality).toBe('standard');
    expect(point.met).toBe(false);
  });

  it('pairs a met point at its actual, and draws no second marker where the two positions agree', () => {
    const { chart } = derive();

    // Sales launch: met three weeks late, so the actual sits three weeks past
    // the baseline and the pair is drawn.
    const launch = pointFor(chart, 7, 'm_launch');
    expect(launch.met).toBe(true);
    expect(launch.baselineFrac).toBeCloseTo(frac(34), 12);
    expect(launch.currentFrac).toBeCloseTo(frac(37), 12);
    expect(launch.showCurrent).toBe(true);
    expect(launch.slipLabel).toBe('+3 wk');

    // Heads of terms: met exactly on its date, so one marker states it and no
    // open marker sits on top of the solid one.
    const hot = pointFor(chart, 0, 'm_hot');
    expect(hot.met).toBe(true);
    expect(hot.baselineFrac).toBeCloseTo(frac(2), 12);
    expect(hot.currentFrac).toBeCloseTo(frac(2), 12);
    expect(hot.showCurrent).toBe(false);
    expect(hot.drift).toBe(null);
    expect(hot.slipLabel).toBe(null);
  });

  it('a slipped gate reads through its stage bar forecast extension, never a competing marker', () => {
    const { chart } = derive();

    // Practical completion: baseline week 80, forecast week 82.
    const s5 = trackFor(chart, 5);
    expect(s5.forecastEndFrac).toBeCloseTo(frac(82), 12);
    expect(s5.gateSlipWeeks).toBe(2);
    expect(s5.gateSlipLabel).toBe('+2 wk');

    const gate5 = pointFor(chart, 5, 'gate_5');
    expect(gate5.kind).toBe('gate');
    expect(gate5.baselineFrac).toBeCloseTo(frac(80), 12);
    // The gate holds its current position as a fact, but never draws it: the
    // extension on the bar is the one statement of the slip.
    expect(gate5.currentFrac).toBeCloseTo(frac(82), 12);
    expect(gate5.showCurrent).toBe(false);
    expect(gate5.drift).toBe(null);
    expect(gate5.slipLabel).toBe('+2 wk');

    // Disposal: the launch slip carries through to a three-week extension.
    const s7 = trackFor(chart, 7);
    expect(s7.forecastEndFrac).toBeCloseTo(frac(93), 12);
    expect(s7.gateSlipWeeks).toBe(3);

    // A gate on its baseline raises no extension at all.
    const s0 = trackFor(chart, 0);
    expect(s0.forecastEndFrac).toBe(null);
    expect(s0.gateSlipWeeks).toBe(0);
    expect(s0.gateSlipLabel).toBe(null);
  });

  it('carries the register row facts through unchanged, so the drawing and the table never disagree', () => {
    const { rows, chart } = derive();
    const flat = chart.tracks.flatMap((t) => t.points);
    expect(flat.map((p) => p.key)).toEqual(rows.map((r) => r.key));
    for (const point of flat) {
      const row = rows.find((r) => r.key === point.key);
      expect(point.name).toBe(row.name);
      expect(point.kind).toBe(row.kind);
      expect(point.criticality).toBe(row.criticality);
      expect(point.met).toBe(row.met);
      expect(point.flagged).toBe(row.flagged);
      expect(point.flagColour).toBe(row.flagColour);
      expect(point.varianceWeeks).toBe(row.varianceWeeks);
      // Every point speaks its own facts, so the drawing is never their only
      // carrier.
      expect(point.label).toContain(row.name);
    }
  });

  it('is honest about an undated point: a position it has, a position it has not', () => {
    const programme = canonicalBaseline();
    const undated = programmeChart(
      programme,
      [
        {
          key: 'm_undated',
          name: 'Undated headline',
          kind: 'milestone',
          criticality: 'critical',
          stage: 5,
          met: false,
          flagged: false,
          flagColour: null,
          baselineDate: null,
          currentDate: iso(50),
          varianceWeeks: null,
          direction: null,
        },
      ],
      { today: TODAY, stageStates: OFF_PLAN_STATES }
    );
    const point = undated.tracks
      .find((t) => t.stage === 5)
      .points.find((p) => p.key === 'm_undated');
    expect(point.baselineFrac).toBe(null);
    expect(point.currentFrac).not.toBe(null);
    // With no baseline there is no drift to draw, but the current position is
    // still stated.
    expect(point.showCurrent).toBe(true);
    expect(point.drift).toBe(null);
    expect(point.slipWeeks).toBe(null);
    expect(point.slipLabel).toBe(null);
  });
});

describe('the completion caption', () => {
  it('states the forecast completion past the target, and the variance in the tracker language', () => {
    const { forecast, chart } = derive();
    expect(forecast.forecastCompletion.getTime()).toBe(epoch(93));

    expect(chart.completion.forecastDate.getTime()).toBe(epoch(93));
    // The target is the baseline's own completion, the latest applicable
    // gate's baseline date, the same rule the band's tile reads.
    expect(chart.completion.targetDate.getTime()).toBe(epoch(90));
    expect(chart.completion.varianceWeeks).toBe(3);
    expect(chart.completion.varianceLabel).toBe('+3 wk vs baseline');
  });

  it('reads on baseline where the forecast holds, and states nothing it cannot know', () => {
    const programme = canonicalBaseline();
    const chart = programmeChart(programme, [], {
      today: TODAY,
      stageStates: OFF_PLAN_STATES,
      forecastCompletion: iso(90),
    });
    expect(chart.completion.varianceWeeks).toBe(0);
    expect(chart.completion.varianceLabel).toBe('on baseline');

    const noForecast = programmeChart(programme, [], {
      today: TODAY,
      stageStates: OFF_PLAN_STATES,
    });
    expect(noForecast.completion.forecastDate).toBe(null);
    expect(noForecast.completion.varianceWeeks).toBe(null);
    expect(noForecast.completion.varianceLabel).toBe(null);
    expect(noForecast.completion.targetDate.getTime()).toBe(epoch(90));
  });
});

describe('slipText', () => {
  it('states the slip compactly under the half-week convention, silent on baseline', () => {
    expect(slipText(0)).toBe(null);
    expect(slipText(0.4)).toBe(null);
    expect(slipText(-0.4)).toBe(null);
    expect(slipText(3)).toBe('+3 wk');
    expect(slipText(2.6)).toBe('+3 wk');
    expect(slipText(-2)).toBe('-2 wk');
    expect(slipText(null)).toBe(null);
    expect(slipText(undefined)).toBe(null);
    expect(slipText(Number.NaN)).toBe(null);
  });
});

describe('nothing is mutated', () => {
  it('the chart writes to neither the baseline, the engine outputs, nor the given rows', () => {
    const programme = deepFreeze(canonicalBaseline());
    const metView = deepFreeze({ ...MET_VIEW });
    const forecast = deepFreeze(deriveForecast(programme, metView, TODAY));
    const rag = deepFreeze(
      deriveRAG(programme, metView, TODAY, STANDARD_TOLERANCE)
    );
    const rows = deepFreeze(scheduleRows(programme, forecast, rag));
    const states = deepFreeze(
      deriveStageStates(PROGRAMME_TEMPLATE, {
        fundingStructureType: 'off_plan_presales',
      })
    );

    const before = {
      forecast: JSON.stringify(forecast),
      rag: JSON.stringify(rag),
      rows: JSON.stringify(rows),
    };

    // Strict mode: any write to the frozen inputs throws, so completing is
    // the proof.
    const chart = programmeChart(programme, rows, {
      today: TODAY,
      stageStates: states,
      forecastCompletion: forecast.forecastCompletion,
    });
    expect(chart.tracks.length).toBe(4);

    expect(JSON.stringify(forecast)).toBe(before.forecast);
    expect(JSON.stringify(rag)).toBe(before.rag);
    expect(JSON.stringify(rows)).toBe(before.rows);
  });

  it('is deterministic: the same inputs give the same chart, twice', () => {
    const a = derive().chart;
    const b = derive().chart;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

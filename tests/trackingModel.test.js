import { describe, it, expect } from 'vitest';
import {
  TOLERANCE_SETTINGS,
  DEFAULT_TOLERANCE_KEY,
  toleranceWeeksFor,
  COLOUR_KEY,
  statusTile,
  completeTile,
  slippingTile,
  nextCriticalTile,
  forecastCompletionTile,
  varianceLabel,
  bandPosition,
  trackingReady,
  programmeTileTarget,
} from '../app/pulse/app/programme/trackingModel.js';
import { deriveProgress } from '../lib/engine/programmeProgress.js';
import { deriveRAG, RAG_STATUS } from '../lib/engine/programmeRAG.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';

/**
 * The Programme tracking display model (Phase 3.5). Proves the five tile
 * values derive correctly from the engines' outputs (the colour passed
 * through, the percent rounded here and only here, the slipping count equal
 * to the flagged list's length with the critical subset called out, the
 * next-critical pick the soonest unmet critical point including gates with
 * the honest done state, and the forecast completion passed through with the
 * variance derived at the surface); that the bounded tolerance dial maps its
 * three settings to two, four, and six weeks, defaults to Standard, and
 * changes the RAG derivation's input; that the routing decisions send a
 * project with no baseline to set-up and a baseline to tracking; and that
 * nothing here mutates an engine output.
 *
 * The engine inputs are built in the assembled-baseline shape with a fixed
 * UTC anchor, the same fixed-anchor style as the engine tests, and the
 * engines themselves produce the outputs the display model reads, so the
 * seam tested is the real one.
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

// The canonical two-applicable-stage fixture, plus a not-applicable stage
// whose early critical point and far-out gate must be excluded everywhere.
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
              mkMs('m1', 'critical', iso(2)),
              mkMs('m2', 'standard', iso(8)),
            ],
          },
          {
            key: '0b',
            name: '0b',
            durationWeeks: 2,
            milestones: [mkMs('m3', 'critical', iso(10))],
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
            milestones: [mkMs('m4', 'critical', iso(16))],
          },
        ],
        gate: {
          key: 'gate_1',
          name: 'Funding locked',
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
            milestones: [mkMs('m5', 'critical', iso(1))],
          },
        ],
        gate: {
          key: 'gate_2',
          name: 'Skipped',
          baselineDate: iso(99),
          closesActivityKey: '2a',
        },
      },
    ],
  };
}

// A single critical milestone behind by three weeks at the given today, its
// gate parked far out, for the tolerance dial's boundary behaviour.
function dialBaseline() {
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
            durationWeeks: 4,
            milestones: [mkMs('mc', 'critical', iso(10))],
          },
        ],
        gate: {
          key: 'gate_0',
          name: 'Gate',
          baselineDate: iso(500),
          closesActivityKey: '0a',
        },
      },
    ],
  };
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

describe('the bounded tolerance dial', () => {
  it('holds exactly three settings mapping to two, four, and six weeks', () => {
    expect(TOLERANCE_SETTINGS).toHaveLength(3);
    expect(TOLERANCE_SETTINGS.map((s) => s.key)).toEqual([
      'tight',
      'standard',
      'relaxed',
    ]);
    expect(toleranceWeeksFor('tight')).toBe(2);
    expect(toleranceWeeksFor('standard')).toBe(4);
    expect(toleranceWeeksFor('relaxed')).toBe(6);
  });

  it('defaults to Standard, four weeks', () => {
    expect(DEFAULT_TOLERANCE_KEY).toBe('standard');
    expect(toleranceWeeksFor(DEFAULT_TOLERANCE_KEY)).toBe(4);
  });

  it('falls back to the default for an unknown key', () => {
    expect(toleranceWeeksFor('loose')).toBe(4);
    expect(toleranceWeeksFor(null)).toBe(4);
    expect(toleranceWeeksFor(undefined)).toBe(4);
  });

  it('is frozen, settings and entries alike', () => {
    expect(Object.isFrozen(TOLERANCE_SETTINGS)).toBe(true);
    for (const setting of TOLERANCE_SETTINGS) {
      expect(Object.isFrozen(setting)).toBe(true);
    }
  });

  it('a changed setting changes the RAG derivation input', () => {
    // A critical milestone behind by exactly three weeks: beyond the Tight
    // tolerance (two weeks) but within Standard (four), so the dial alone
    // flips the colour.
    const baseline = dialBaseline();
    const today = iso(13);
    const tight = deriveRAG(baseline, {}, today, toleranceWeeksFor('tight'));
    const standard = deriveRAG(
      baseline,
      {},
      today,
      toleranceWeeksFor('standard')
    );
    const relaxed = deriveRAG(
      baseline,
      {},
      today,
      toleranceWeeksFor('relaxed')
    );
    expect(statusTile(tight).colour).toBe(RAG_STATUS.RED);
    expect(statusTile(standard).colour).toBe(RAG_STATUS.AMBER);
    expect(statusTile(relaxed).colour).toBe(RAG_STATUS.AMBER);
  });
});

describe('the colour key', () => {
  it('explains the three colours, one line each, and is frozen', () => {
    expect(COLOUR_KEY.map((k) => k.colour)).toEqual(['green', 'amber', 'red']);
    for (const entry of COLOUR_KEY) {
      expect(entry.label).toBeTruthy();
      expect(entry.line).toBeTruthy();
    }
    expect(Object.isFrozen(COLOUR_KEY)).toBe(true);
  });
});

describe('the Status tile', () => {
  it('passes the overall colour through, colour only', () => {
    const baseline = canonicalBaseline();
    const rag = deriveRAG(baseline, {}, iso(0), 4);
    expect(statusTile(rag)).toEqual({ colour: RAG_STATUS.GREEN });
  });

  it('is null-safe', () => {
    expect(statusTile(null)).toEqual({ colour: null });
    expect(statusTile({})).toEqual({ colour: null });
  });
});

describe('the Complete tile', () => {
  it('rounds the engine percent for display without mutating the engine output', () => {
    const baseline = canonicalBaseline();
    const met = { m1: { met: true, metDate: iso(2) } };
    const progress = deriveProgress(baseline, met);
    // The engine's figure is exact: (50 * 1 + 0 * 2 + 0 * 6) / 9.
    expect(progress.percentComplete).toBeCloseTo(50 / 9, 6);
    const tile = completeTile(progress);
    expect(tile.percent).toBe(6);
    // The rounding happened on the returned copy only.
    expect(progress.percentComplete).toBeCloseTo(50 / 9, 6);
    expect(progress.percentComplete).not.toBe(tile.percent);
  });

  it('sums points met over points held across counted activities of applicable stages', () => {
    const baseline = canonicalBaseline();
    const met = { m1: { met: true, metDate: iso(2) } };
    const tile = completeTile(deriveProgress(baseline, met));
    // 0a holds m1 and m2; 0b holds m3 and gate_0; 1a holds m4 and gate_1.
    // The not-applicable stage 2 contributes nothing.
    expect(tile.metPoints).toBe(1);
    expect(tile.totalPoints).toBe(6);
  });

  it('reports a null percent where the engine had nothing to average', () => {
    const tile = completeTile(deriveProgress({ stages: [] }, {}));
    expect(tile).toEqual({ percent: null, metPoints: 0, totalPoints: 0 });
  });
});

describe('the Slipping tile', () => {
  it('counts the flagged list, with the critical subset called out', () => {
    const baseline = canonicalBaseline();
    // At week 13: m1 critical behind 11w (red), m2 standard behind 5w
    // (amber), m3 critical behind 3w (amber), gate_0 overdue (red). m4 and
    // gate_1 are not yet due, and the not-applicable stage flags nothing.
    const rag = deriveRAG(baseline, {}, iso(13), 4);
    const tile = slippingTile(rag);
    expect(rag.flagged).toHaveLength(4);
    expect(tile.count).toBe(rag.flagged.length);
    expect(tile.criticalCount).toBe(3);
  });

  it('reads zero when nothing is behind', () => {
    const baseline = canonicalBaseline();
    const rag = deriveRAG(baseline, {}, iso(0), 4);
    expect(slippingTile(rag)).toEqual({ count: 0, criticalCount: 0 });
  });

  it('is null-safe', () => {
    expect(slippingTile(null)).toEqual({ count: 0, criticalCount: 0 });
  });
});

describe('the Next critical milestone tile', () => {
  it('picks the soonest unmet critical point, skipping the not-applicable stage', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, {}, iso(0));
    const tile = nextCriticalTile(baseline, forecast);
    // m5 in the not-applicable stage sits at week 1, sooner than m1 at week
    // 2, and must not be picked.
    expect(tile.done).toBe(false);
    expect(tile.key).toBe('m1');
    expect(tile.kind).toBe('milestone');
    expect(tile.stage).toBe(0);
    expect(tile.name).toBe('m1');
    expect(tile.date.getTime()).toBe(epoch(2));
  });

  it('never picks a standard milestone, however soon', () => {
    const baseline = canonicalBaseline();
    // m1 met: the soonest unmet point is the standard m2 at week 8, but the
    // pick must be the critical m3 at week 10.
    const met = { m1: { met: true, metDate: iso(2) } };
    const tile = nextCriticalTile(baseline, deriveForecast(baseline, met, iso(0)));
    expect(tile.key).toBe('m3');
  });

  it('includes gates, critical by nature', () => {
    const baseline = canonicalBaseline();
    const met = {
      m1: { met: true, metDate: iso(2) },
      m2: { met: true, metDate: iso(8) },
      m3: { met: true, metDate: iso(10) },
    };
    const tile = nextCriticalTile(baseline, deriveForecast(baseline, met, iso(11)));
    expect(tile.done).toBe(false);
    expect(tile.key).toBe('gate_0');
    expect(tile.kind).toBe('gate');
  });

  it('reads the forecast date, not the baseline date', () => {
    const baseline = canonicalBaseline();
    // Nothing met at week 13: m1 (baseline week 2) is overdue, so its
    // forecast floors at today. The tile must carry the engine's own date.
    const forecast = deriveForecast(baseline, {}, iso(13));
    const tile = nextCriticalTile(baseline, forecast);
    expect(tile.key).toBe('m1');
    expect(tile.date.getTime()).toBe(epoch(13));
    const engineNode = forecast.stages[0].activities[0].milestones[0];
    expect(tile.date.getTime()).toBe(engineNode.forecastDate.getTime());
  });

  it('breaks a tie deterministically, the earlier point in programme order', () => {
    const baseline = {
      stages: [
        {
          stage: 0,
          applicable: true,
          stageStart: iso(0),
          activities: [
            {
              key: '0a',
              durationWeeks: 4,
              milestones: [mkMs('mc', 'critical', iso(10))],
            },
          ],
          gate: {
            key: 'gate_0',
            name: 'Gate',
            baselineDate: iso(10),
            closesActivityKey: '0a',
          },
        },
      ],
    };
    const tile = nextCriticalTile(baseline, deriveForecast(baseline, {}, iso(0)));
    expect(tile.key).toBe('mc');
  });

  it('yields the honest done state when nothing critical remains unmet', () => {
    const baseline = canonicalBaseline();
    // Every critical point met; the standard m2 left unmet must not hold the
    // done state back.
    const met = {
      m1: { met: true, metDate: iso(2) },
      m3: { met: true, metDate: iso(10) },
      m4: { met: true, metDate: iso(16) },
      gate_0: { met: true, metDate: iso(12) },
      gate_1: { met: true, metDate: iso(20) },
    };
    const tile = nextCriticalTile(baseline, deriveForecast(baseline, met, iso(21)));
    expect(tile).toEqual({ done: true });
  });
});

describe('the Forecast completion tile', () => {
  it('passes the programme forecast completion through, on baseline when nothing has moved', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, {}, iso(0));
    const tile = forecastCompletionTile(baseline, forecast);
    expect(tile.date.getTime()).toBe(forecast.forecastCompletion.getTime());
    expect(tile.date.getTime()).toBe(epoch(20));
    // The baseline's own completion ignores the not-applicable stage's later
    // gate.
    expect(tile.baselineDate.getTime()).toBe(epoch(20));
    expect(tile.varianceWeeks).toBe(0);
    expect(varianceLabel(tile.varianceWeeks)).toBe('on baseline');
  });

  it('moves with the actuals: a late gate pushes the completion and the variance', () => {
    const baseline = canonicalBaseline();
    // Stage 0 done, its gate three weeks late: the drift carries into stage 1
    // and the completion lands three weeks past baseline.
    const met = {
      m1: { met: true, metDate: iso(2) },
      m2: { met: true, metDate: iso(8) },
      m3: { met: true, metDate: iso(10) },
      gate_0: { met: true, metDate: iso(15) },
    };
    const forecast = deriveForecast(baseline, met, iso(15));
    const tile = forecastCompletionTile(baseline, forecast);
    expect(tile.date.getTime()).toBe(epoch(23));
    expect(tile.varianceWeeks).toBeCloseTo(3, 6);
    expect(varianceLabel(tile.varianceWeeks)).toBe('+3 wk vs baseline');
  });

  it('shows an early finish as a negative variance', () => {
    const baseline = {
      stages: [
        {
          stage: 0,
          applicable: true,
          stageStart: iso(0),
          activities: [{ key: '0a', durationWeeks: 20, milestones: [] }],
          gate: {
            key: 'gate_0',
            name: 'Gate',
            baselineDate: iso(20),
            closesActivityKey: '0a',
          },
        },
      ],
    };
    const met = { gate_0: { met: true, metDate: iso(18) } };
    const tile = forecastCompletionTile(
      baseline,
      deriveForecast(baseline, met, iso(19))
    );
    expect(tile.date.getTime()).toBe(epoch(18));
    expect(tile.varianceWeeks).toBeCloseTo(-2, 6);
    expect(varianceLabel(tile.varianceWeeks)).toBe('-2 wk vs baseline');
  });

  it('measures the baseline completion over trackable points only', () => {
    // A keyless milestone dated after the gate can never carry a forecast
    // (the forecast engine skips it), so it must not stretch the baseline
    // side of the variance either: an untouched programme stays on baseline.
    const baseline = {
      stages: [
        {
          stage: 0,
          applicable: true,
          stageStart: iso(0),
          activities: [
            {
              key: '0a',
              durationWeeks: 20,
              milestones: [
                mkMs('m1', 'critical', iso(10)),
                { name: 'untracked', criticality: 'standard', baselineDate: iso(30) },
              ],
            },
          ],
          gate: {
            key: 'gate_0',
            name: 'Gate',
            baselineDate: iso(20),
            closesActivityKey: '0a',
          },
        },
      ],
    };
    const tile = forecastCompletionTile(
      baseline,
      deriveForecast(baseline, {}, iso(0))
    );
    expect(tile.baselineDate.getTime()).toBe(epoch(20));
    expect(tile.varianceWeeks).toBe(0);
    expect(varianceLabel(tile.varianceWeeks)).toBe('on baseline');
  });

  it('is null-safe where a side is missing', () => {
    const tile = forecastCompletionTile({ stages: [] }, { stages: [] });
    expect(tile).toEqual({ date: null, baselineDate: null, varianceWeeks: null });
    expect(varianceLabel(tile.varianceWeeks)).toBe(null);
  });
});

describe('varianceLabel display rounding', () => {
  it('rounds at the surface: near-zero reads on baseline', () => {
    expect(varianceLabel(0.4)).toBe('on baseline');
    expect(varianceLabel(-0.4)).toBe('on baseline');
  });

  it('rounds a fractional slip to whole weeks', () => {
    expect(varianceLabel(3.4)).toBe('+3 wk vs baseline');
    expect(varianceLabel(-1.6)).toBe('-2 wk vs baseline');
  });

  it('rounds the half-week boundary away from zero on both sides', () => {
    expect(varianceLabel(1.5)).toBe('+2 wk vs baseline');
    expect(varianceLabel(-1.5)).toBe('-2 wk vs baseline');
  });

  it('is null for a missing variance', () => {
    expect(varianceLabel(null)).toBe(null);
    expect(varianceLabel(Number.NaN)).toBe(null);
  });
});

describe('the band position eyebrow', () => {
  it('names the module and the stage position', () => {
    expect(bandPosition(3)).toBe('Programme summary, Stage 3 of 8');
    expect(bandPosition(0)).toBe('Programme summary, Stage 0 of 8');
  });

  it('falls back to the bare module name when the stage is not a number', () => {
    expect(bandPosition(null)).toBe('Programme summary');
    expect(bandPosition(undefined)).toBe('Programme summary');
    expect(bandPosition('3')).toBe('Programme summary');
  });
});

describe('the routing decisions', () => {
  it('no baseline points to set-up; a baseline renders tracking', () => {
    expect(trackingReady(null)).toBe(false);
    expect(trackingReady(undefined)).toBe(false);
    expect(trackingReady({ programme: null })).toBe(false);
    expect(trackingReady({ version: 1, programme: { stages: [] } })).toBe(true);
  });

  it('routes the workspace tile by state', () => {
    const locked = programmeTileTarget('p1', {
      briefLocked: false,
      hasBaseline: false,
    });
    expect(locked.state).toBe('locked');
    expect(locked.footer).toBe('Programme set-up opens once you lock the Brief.');

    const toSetup = programmeTileTarget('p1', {
      briefLocked: true,
      hasBaseline: false,
    });
    expect(toSetup.state).toBe('open');
    expect(toSetup.href).toBe('/pulse/app/programme/setup?project=p1');
    expect(toSetup.footer).toBe('Set up the operational baseline.');

    const toTracking = programmeTileTarget('p1', {
      briefLocked: true,
      hasBaseline: true,
    });
    expect(toTracking.state).toBe('open');
    expect(toTracking.href).toBe('/pulse/app/programme?project=p1');
    expect(toTracking.footer).toBe('Track delivery against the locked baseline.');
  });
});

describe('purity: the display model never mutates an engine output', () => {
  it('reads deep-frozen engine outputs without writing to them', () => {
    const baseline = deepFreeze(canonicalBaseline());
    const metView = deepFreeze({ m1: { met: true, metDate: iso(2) } });
    const progress = deepFreeze(deriveProgress(baseline, metView));
    const rag = deepFreeze(deriveRAG(baseline, metView, iso(13), 4));
    const forecast = deepFreeze(deriveForecast(baseline, metView, iso(13)));

    const before = {
      progress: JSON.stringify(progress),
      rag: JSON.stringify(rag),
      forecast: JSON.stringify(forecast),
    };

    // Every helper runs over the frozen outputs; a write would throw in
    // strict mode.
    statusTile(rag);
    completeTile(progress);
    slippingTile(rag);
    nextCriticalTile(baseline, forecast);
    const completion = forecastCompletionTile(baseline, forecast);
    varianceLabel(completion.varianceWeeks);

    expect(JSON.stringify(progress)).toBe(before.progress);
    expect(JSON.stringify(rag)).toBe(before.rag);
    expect(JSON.stringify(forecast)).toBe(before.forecast);
  });
});

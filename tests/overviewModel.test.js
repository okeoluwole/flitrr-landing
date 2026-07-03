import { describe, it, expect } from 'vitest';
import {
  LOOKAHEAD_DAYS,
  GATE_DIRECTIONS,
  GATE_REVIEW_STAGE,
  nextGateCard,
  directionLabel,
  gateReviewHref,
  needsAttention,
  ATTENTION_REASONS,
  attentionReason,
  behindLabel,
  nextThirtyDays,
} from '../app/pulse/app/programme/overviewModel.js';
import { deriveRAG, RAG_CONDITIONS } from '../lib/engine/programmeRAG.js';
import { deriveForecast } from '../lib/engine/programmeForecast.js';

/**
 * The Programme Overview tab display model (Phase 3.6). Proves the three
 * blocks derive correctly from what the page already holds: the Next Gate
 * card picks the next unpassed gate in spine order off the forecast tree's
 * met flags (skipping not-applicable stages), carries its baseline, forecast,
 * and exact variance with the direction plain, links only where the Gate
 * module genuinely reviews that gate, and reads done when every gate is
 * passed; the Needs attention ordering is red before amber and furthest
 * behind first within a colour, on a copy, responding to the tolerance
 * because the re-derived RAG output is what it reads; the Next 30 days window
 * filters unmet points on forecast dates against the today the page holds,
 * bounds inclusive on UTC calendar days, soonest first; and no helper mutates
 * an engine output.
 *
 * The engine inputs are built in the assembled-baseline shape with a fixed
 * UTC anchor, the same fixed-anchor style as the engine and trackingModel
 * tests, and the engines themselves produce the outputs the display model
 * reads, so the seam tested is the real one.
 */

const ANCHOR = Date.UTC(2026, 0, 5); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// An ISO date a whole number of weeks after the anchor, the string form the
// frozen baseline carries after its jsonb round trip.
const iso = (weeks) => new Date(ANCHOR + weeks * MS_PER_WEEK).toISOString();
// An ISO date a whole number of days after the anchor.
const isoDays = (days) => new Date(ANCHOR + days * MS_PER_DAY).toISOString();
// The epoch for a whole number of weeks after the anchor.
const epoch = (weeks) => ANCHOR + weeks * MS_PER_WEEK;

const mkMs = (key, criticality, baselineDate, name = key) => ({
  key,
  name,
  criticality,
  baselineDate,
});

// The canonical fixture: three applicable stages around a not-applicable one,
// so spine-order picks, the skip, and the done state are all exercised on the
// one shape.
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

const allGatesMet = {
  gate_0: { met: true, metDate: iso(12) },
  gate_1: { met: true, metDate: iso(20) },
  gate_3: { met: true, metDate: iso(28) },
};

describe('the Next Gate card', () => {
  it('picks the first unpassed gate in spine order, on baseline on day one', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, {}, iso(0));
    const card = nextGateCard(baseline, forecast);
    expect(card.done).toBe(false);
    expect(card.key).toBe('gate_0');
    expect(card.stage).toBe(0);
    expect(card.name).toBe('Site acquired');
    expect(card.baselineDate.getTime()).toBe(epoch(12));
    // Nothing met and today at the start: the roll reproduces the baseline.
    expect(card.forecastDate.getTime()).toBe(epoch(12));
    expect(card.varianceWeeks).toBe(0);
    expect(card.direction).toBe(GATE_DIRECTIONS.ON_BASELINE);
  });

  it('moves to the next stage gate once a gate is passed', () => {
    const baseline = canonicalBaseline();
    const met = { gate_0: { met: true, metDate: iso(12) } };
    const forecast = deriveForecast(baseline, met, iso(12));
    const card = nextGateCard(baseline, forecast);
    expect(card.key).toBe('gate_1');
    expect(card.stage).toBe(1);
  });

  it('skips a not-applicable stage entirely', () => {
    const baseline = canonicalBaseline();
    const met = {
      gate_0: { met: true, metDate: iso(12) },
      gate_1: { met: true, metDate: iso(20) },
    };
    const forecast = deriveForecast(baseline, met, iso(20));
    const card = nextGateCard(baseline, forecast);
    // gate_2 sits between in stage order but its stage is not applicable.
    expect(card.key).toBe('gate_3');
    expect(card.stage).toBe(3);
  });

  it('reads behind, with the exact variance, when an upstream actual pushes the forecast late', () => {
    const baseline = canonicalBaseline();
    // gate_0 passed three weeks late: the roll pushes gate_1's forecast to
    // week 23 against its week-20 baseline.
    const met = { gate_0: { met: true, metDate: iso(15) } };
    const forecast = deriveForecast(baseline, met, iso(15));
    const card = nextGateCard(baseline, forecast);
    expect(card.key).toBe('gate_1');
    expect(card.baselineDate.getTime()).toBe(epoch(20));
    expect(card.forecastDate.getTime()).toBe(epoch(23));
    expect(card.varianceWeeks).toBe(3);
    expect(card.direction).toBe(GATE_DIRECTIONS.BEHIND);
  });

  it('reads ahead when an upstream actual pulls the forecast early', () => {
    const baseline = canonicalBaseline();
    // gate_0 passed two weeks early: gate_1's forecast pulls to week 18.
    const met = { gate_0: { met: true, metDate: iso(10) } };
    const forecast = deriveForecast(baseline, met, iso(10));
    const card = nextGateCard(baseline, forecast);
    expect(card.key).toBe('gate_1');
    expect(card.forecastDate.getTime()).toBe(epoch(18));
    expect(card.varianceWeeks).toBe(-2);
    expect(card.direction).toBe(GATE_DIRECTIONS.AHEAD);
  });

  it('reads done when every gate in the programme is passed', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, allGatesMet, iso(28));
    // The not-applicable stage's unpassed gate cannot hold the card open.
    expect(nextGateCard(baseline, forecast)).toEqual({ done: true });
  });

  it('carries a null variance and direction for an undated gate', () => {
    const baseline = canonicalBaseline();
    baseline.stages[0].gate.baselineDate = null;
    const forecast = deriveForecast(baseline, {}, iso(0));
    const card = nextGateCard(baseline, forecast);
    expect(card.key).toBe('gate_0');
    expect(card.baselineDate).toBeNull();
    expect(card.varianceWeeks).toBeNull();
    expect(card.direction).toBeNull();
  });

  it('is null-safe', () => {
    expect(nextGateCard(null, null)).toEqual({ done: true });
    expect(nextGateCard({ stages: [] }, { stages: [] })).toEqual({
      done: true,
    });
  });
});

describe('the direction label', () => {
  it('states the three directions plainly under the half-week convention', () => {
    expect(directionLabel(3)).toBe('3 wk behind baseline');
    expect(directionLabel(-2)).toBe('2 wk ahead of baseline');
    expect(directionLabel(0)).toBe('on baseline');
    expect(directionLabel(0.4)).toBe('on baseline');
    expect(directionLabel(-0.4)).toBe('on baseline');
    expect(directionLabel(0.6)).toBe('1 wk behind baseline');
    expect(directionLabel(-0.6)).toBe('1 wk ahead of baseline');
  });

  it('is null where there is no variance to state', () => {
    expect(directionLabel(null)).toBeNull();
    expect(directionLabel(undefined)).toBeNull();
    expect(directionLabel(Number.NaN)).toBeNull();
  });
});

describe('the gate review link', () => {
  it('links the stage whose gate the Gate module reviews, and no other', () => {
    const projectId = '7cbb767e-0000-0000-0000-000000000000';
    expect(GATE_REVIEW_STAGE).toBe(1);
    expect(gateReviewHref(projectId, 1)).toBe(
      `/pulse/app/gate?project=${projectId}`
    );
    for (const stage of [0, 2, 3, 4, 5, 6, 7, null, undefined]) {
      expect(gateReviewHref(projectId, stage)).toBeNull();
    }
  });

  it('never links without a project id', () => {
    expect(gateReviewHref(null, 1)).toBeNull();
    expect(gateReviewHref('', 1)).toBeNull();
    expect(gateReviewHref('   ', 1)).toBeNull();
  });
});

describe('the Needs attention ordering', () => {
  it('orders red before amber, furthest behind first within a colour', () => {
    const baseline = canonicalBaseline();
    // At week 13, tolerance four: m1 critical behind 11w (red), m2 standard
    // behind 5w (amber), m3 critical behind 3w (amber), gate_0 overdue by 1w
    // (red). The not-applicable stage flags nothing.
    const rag = deriveRAG(baseline, {}, iso(13), 4);
    const ordered = needsAttention(rag);
    expect(ordered.map((i) => i.key)).toEqual(['m1', 'gate_0', 'm2', 'm3']);
    expect(ordered.map((i) => i.colour)).toEqual([
      'red',
      'red',
      'amber',
      'amber',
    ]);
  });

  it('carries each item through untouched, fields and all', () => {
    const baseline = canonicalBaseline();
    const rag = deriveRAG(baseline, {}, iso(13), 4);
    const ordered = needsAttention(rag);
    const m1 = ordered.find((i) => i.key === 'm1');
    expect(m1.kind).toBe('milestone');
    expect(m1.criticality).toBe('critical');
    expect(m1.stage).toBe(0);
    expect(m1.weeksBehind).toBe(11);
    expect(m1.condition).toBe(RAG_CONDITIONS.CRITICAL_BEYOND_TOLERANCE);
    const gate = ordered.find((i) => i.key === 'gate_0');
    expect(gate.kind).toBe('gate');
    expect(gate.criticality).toBe('critical');
    expect(gate.condition).toBe(RAG_CONDITIONS.GATE_OVERDUE);
  });

  it('responds to the tolerance: the re-derived list reorders', () => {
    const baseline = canonicalBaseline();
    // Tightened to two weeks, m3 (3w behind, critical) turns red and jumps
    // the amber block.
    const tight = needsAttention(deriveRAG(baseline, {}, iso(13), 2));
    expect(tight.map((i) => i.key)).toEqual(['m1', 'm3', 'gate_0', 'm2']);
    expect(tight.find((i) => i.key === 'm3').colour).toBe('red');
    // Relaxed to six, m2 the standard item still flags amber but m3 sits
    // amber too, unchanged from Standard.
    const relaxed = needsAttention(deriveRAG(baseline, {}, iso(13), 6));
    expect(relaxed.map((i) => i.key)).toEqual(['m1', 'gate_0', 'm2', 'm3']);
  });

  it('orders furthest behind first within a colour, against the engine emission order', () => {
    // One stage whose milestones sit out of date order, so the engine emits
    // each colour's items in ASCENDING slip order and only the within-colour
    // sort can put them right: mA standard 5w behind before mB standard 9w,
    // mC critical 7w before mD critical 11w (tolerance two, both red).
    const baseline = {
      stages: [
        {
          stage: 0,
          applicable: true,
          stageStart: iso(0),
          activities: [
            {
              key: '0a',
              milestones: [
                mkMs('mA', 'standard', iso(8)),
                mkMs('mB', 'standard', iso(4)),
                mkMs('mC', 'critical', iso(6)),
                mkMs('mD', 'critical', iso(2)),
              ],
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
    const rag = deriveRAG(baseline, {}, iso(13), 2);
    expect(rag.flagged.map((i) => i.key)).toEqual(['mA', 'mB', 'mC', 'mD']);
    const ordered = needsAttention(rag);
    expect(ordered.map((i) => i.key)).toEqual(['mD', 'mC', 'mB', 'mA']);
  });

  it('orders a breach with no observed slip after the behind items of its colour', () => {
    // A confirmed local floor breached by the stage 0 gate placement (twelve
    // weeks against a twenty-week floor) with today before the gate date, so
    // the engine flags it red with weeksBehind null; the stage 1 critical
    // milestone is red and observably behind. The engine emits the breach
    // first (stage order); the ordering must put the behind item ahead of it.
    const baseline = {
      stages: [
        {
          stage: 0,
          applicable: true,
          stageStart: iso(0),
          activities: [{ key: '0a', milestones: [] }],
          gate: {
            key: 'gate_0',
            name: 'Floored gate',
            baselineDate: iso(12),
            closesActivityKey: '0a',
          },
        },
        {
          stage: 1,
          applicable: true,
          stageStart: iso(12),
          activities: [
            { key: '1a', milestones: [mkMs('mX', 'critical', iso(3))] },
          ],
          gate: {
            key: 'gate_1',
            name: 'Far gate',
            baselineDate: iso(500),
            closesActivityKey: '1a',
          },
        },
      ],
    };
    const rag = deriveRAG(baseline, {}, iso(10), 4, {
      localFloors: { 0: { floorWeeks: 20 } },
    });
    const breach = rag.flagged.find((i) => i.key === 'gate_0');
    expect(breach.condition).toBe(RAG_CONDITIONS.HARD_FLOOR_BREACH);
    expect(breach.weeksBehind).toBeNull();
    expect(rag.flagged.map((i) => i.key)).toEqual(['gate_0', 'mX']);
    const ordered = needsAttention(rag);
    expect(ordered.map((i) => i.key)).toEqual(['mX', 'gate_0']);
    expect(ordered.map((i) => i.colour)).toEqual(['red', 'red']);
  });

  it('orders on a copy: the engine flagged list is untouched', () => {
    const baseline = canonicalBaseline();
    const rag = deriveRAG(baseline, {}, iso(13), 4);
    const before = rag.flagged.map((i) => i.key);
    needsAttention(rag);
    expect(rag.flagged.map((i) => i.key)).toEqual(before);
  });

  it('is empty when nothing is flagged, and null-safe', () => {
    const baseline = canonicalBaseline();
    expect(needsAttention(deriveRAG(baseline, {}, iso(0), 4))).toEqual([]);
    expect(needsAttention(null)).toEqual([]);
    expect(needsAttention({})).toEqual([]);
  });
});

describe('the attention wording', () => {
  it('carries one plain reason line per engine condition, frozen', () => {
    for (const condition of Object.values(RAG_CONDITIONS)) {
      expect(attentionReason(condition)).toBeTruthy();
    }
    expect(attentionReason('unknown_condition')).toBeNull();
    expect(Object.isFrozen(ATTENTION_REASONS)).toBe(true);
  });

  it('rounds the behind label for display, never to a dishonest zero', () => {
    expect(behindLabel(11)).toBe('11 wk behind');
    expect(behindLabel(1)).toBe('1 wk behind');
    expect(behindLabel(0.7)).toBe('1 wk behind');
    expect(behindLabel(0.3)).toBe('under 1 wk behind');
    expect(behindLabel(null)).toBeNull();
    expect(behindLabel(undefined)).toBeNull();
  });
});

describe('the Next 30 days lookahead', () => {
  it('lists the unmet points forecast within the window, soonest first', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, {}, iso(0));
    const items = nextThirtyDays(baseline, forecast, iso(0));
    // m1 at week 2 (day 14) is in; everything later sits past day 30. The
    // not-applicable stage's early point never appears.
    expect(items.map((i) => i.key)).toEqual(['m1']);
    expect(items[0]).toEqual({
      key: 'm1',
      name: 'Heads of terms',
      kind: 'milestone',
      criticality: 'critical',
      stage: 0,
      forecastDate: new Date(epoch(2)),
    });
  });

  it('includes gates, critical by their nature, and sorts across stages', () => {
    const baseline = canonicalBaseline();
    // At week 10 with m1 and m2 met: m3 (week 10, due today), gate_0 (week
    // 12), and nothing further inside day 30 (m4 at week 16 is out).
    const met = {
      m1: { met: true, metDate: iso(2) },
      m2: { met: true, metDate: iso(8) },
    };
    const forecast = deriveForecast(baseline, met, iso(10));
    const items = nextThirtyDays(baseline, forecast, iso(10));
    expect(items.map((i) => i.key)).toEqual(['m3', 'gate_0']);
    expect(items[1].kind).toBe('gate');
    expect(items[1].criticality).toBe('critical');
    expect(items[1].name).toBe('Site acquired');
  });

  it('never lists a met point, even one dated inside the window', () => {
    const baseline = canonicalBaseline();
    const met = { m1: { met: true, metDate: iso(2) } };
    const forecast = deriveForecast(baseline, met, iso(1));
    const items = nextThirtyDays(baseline, forecast, iso(1));
    expect(items.map((i) => i.key)).not.toContain('m1');
  });

  it('holds both bounds inclusive on UTC calendar days', () => {
    // A hand-built pair, one point per day around each bound, so the bounds
    // are pinned exactly: today's own day is in, day 30 is in, day 31 is out,
    // and the day before today is out (only a hand-built tree can place an
    // unmet forecast in the past; the real roll floors at today).
    const mk = (key, days) => ({
      programme: {
        key,
        name: key,
        criticality: 'standard',
        baselineDate: isoDays(days),
      },
      forecast: { key, met: false, forecastDate: new Date(ANCHOR + days * MS_PER_DAY) },
    });
    const points = [mk('dayBefore', -1), mk('day0', 0), mk('day30', 30), mk('day31', 31)];
    const programme = {
      stages: [
        {
          stage: 0,
          applicable: true,
          activities: [{ key: '0a', milestones: points.map((p) => p.programme) }],
          gate: null,
        },
      ],
    };
    const forecast = {
      stages: [
        {
          stage: 0,
          applicable: true,
          activities: [{ key: '0a', milestones: points.map((p) => p.forecast) }],
          gate: null,
        },
      ],
    };
    const items = nextThirtyDays(programme, forecast, isoDays(0));
    expect(items.map((i) => i.key)).toEqual(['day0', 'day30']);
  });

  it('compares on the UTC day, so a clock-time today never drops a today-dated point', () => {
    const baseline = canonicalBaseline();
    const forecast = deriveForecast(baseline, {}, iso(2));
    // Today at 14:23 UTC on m1's own forecast day: the point is due today
    // and must be in the window.
    const todayWithClock = new Date(epoch(2) + 14.5 * 60 * 60 * 1000).toISOString();
    const items = nextThirtyDays(baseline, forecast, todayWithClock);
    expect(items.map((i) => i.key)).toContain('m1');
  });

  it('is empty when the window is quiet, and null-safe', () => {
    const baseline = canonicalBaseline();
    // Every point met: nothing unmet remains anywhere.
    const met = {
      m1: { met: true, metDate: iso(2) },
      m2: { met: true, metDate: iso(8) },
      m3: { met: true, metDate: iso(10) },
      m4: { met: true, metDate: iso(16) },
      m6: { met: true, metDate: iso(24) },
      ...allGatesMet,
    };
    const forecast = deriveForecast(baseline, met, iso(28));
    expect(nextThirtyDays(baseline, forecast, iso(28))).toEqual([]);
    expect(nextThirtyDays(null, null, iso(0))).toEqual([]);
    expect(nextThirtyDays(canonicalBaseline(), null, null)).toEqual([]);
  });

  it('honours the exported window size', () => {
    expect(LOOKAHEAD_DAYS).toBe(30);
  });
});

describe('nothing mutates an engine output', () => {
  it('every helper leaves the programme, RAG, and forecast outputs exactly as given', () => {
    const baseline = canonicalBaseline();
    const met = { gate_0: { met: true, metDate: iso(15) } };
    const rag = deriveRAG(baseline, met, iso(15), 4);
    const forecast = deriveForecast(baseline, met, iso(15));

    const baselineBefore = structuredClone(baseline);
    const ragBefore = structuredClone(rag);
    const forecastBefore = structuredClone(forecast);

    nextGateCard(baseline, forecast);
    needsAttention(rag);
    nextThirtyDays(baseline, forecast, iso(15));

    expect(baseline).toEqual(baselineBefore);
    expect(rag).toEqual(ragBefore);
    expect(forecast).toEqual(forecastBefore);
  });
});

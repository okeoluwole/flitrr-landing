import { describe, it, expect } from 'vitest';
import {
  deriveAttention,
  ATTENTION_KINDS,
  ATTENTION_TRIGGERS,
  ATTENTION_MODULES,
  ATTENTION_CAP,
} from '../app/pulse/app/dashboard/attentionModel.js';
import { buildObjectiveIndex } from '../lib/engine/criticality.js';

/**
 * The attention assembly (M9.3, Band 3). Proves it composes without inventing:
 * a flagged gate sorts above everything, protected before flexible, the M7.2
 * dedupe collapses a risk and its promoted action to one row, an accepted risk
 * appears only when the monitor flags it, unlinked items stay out of the
 * framework ranking, needs-your-response surfaces a risk the monitor missed,
 * the cap holds at five with a true overflow across all sources, and the calm
 * project returns an empty list.
 *
 * Fixed epochs and ISO dates keep every assertion off the wall clock; the
 * monitor reads the passed-in now, never the system clock.
 */

const NOW = Date.parse('2026-07-15T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const RECENT = new Date(NOW - DAY).toISOString();

// Three objectives: two protected (cost, quality), one flexible (time).
const OBJECTIVES = [
  { id: 'obj_cost', objective_type: 'cost', classification: 'non_negotiable' },
  { id: 'obj_time', objective_type: 'time', classification: 'flexible' },
  { id: 'obj_quality', objective_type: 'quality', classification: 'non_negotiable' },
];

function byId() {
  return buildObjectiveIndex(OBJECTIVES).byId;
}

// A risk row shaped as the register and the monitor read it. Defaults to a
// Serious (high x high), watching, never-reviewed risk: on a protected
// objective that fires the monitor and reads critical-and-unmanaged.
function risk(id, objectiveId, overrides = {}) {
  return {
    id,
    description: `risk ${id}`,
    linked_objective_id: objectiveId,
    likelihood: 'high',
    impact: 'high',
    status: 'watching',
    last_reviewed_at: null,
    response_note: null,
    updated_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

// An action row. Defaults to an open, hand-logged action; link it to a
// protected objective to make it critical.
function action(id, objectiveId, overrides = {}) {
  return {
    id,
    description: `action ${id}`,
    linked_objective_id: objectiveId,
    criticality_override: null,
    status: 'to_do',
    stage: 2,
    source: null,
    source_id: null,
    reason: null,
    ...overrides,
  };
}

// A minimal health stub, only the shape the assembly reads: per-objective
// milestone joins and the gates array.
function health({ objectives = [], gates = [] } = {}) {
  return { objectives, gates };
}
function objRow(type, isProtected, milestones = []) {
  return { type, isProtected, items: { milestones } };
}
function milestone(key, stage, flag, name) {
  return { key, name: name ?? `milestone ${key}`, stage, flag };
}
function gate(key, stage, colour, name) {
  return { key, name: name ?? `gate ${key}`, stage, colour };
}

function run({ risks = [], actions = [], health: h = health() }) {
  return deriveAttention({
    risks,
    actions,
    health: h,
    objectivesById: byId(),
    nowMs: NOW,
  });
}

describe('deriveAttention: order', () => {
  it('sorts a flagged gate above everything, including a Serious protected risk', () => {
    const result = run({
      risks: [risk('r_cost', 'obj_cost')],
      health: health({ gates: [gate('gate_2', 2, 'red')] }),
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].kind).toBe(ATTENTION_KINDS.GATE);
    expect(result.items[1].kind).toBe(ATTENTION_KINDS.RISK);
    expect(result.items[1].id).toBe('r_cost');
  });

  it('ranks protected-objective items above flexible-objective items', () => {
    // A flexible risk is inserted first; the protected risk must still lead.
    const result = run({
      risks: [risk('r_time', 'obj_time'), risk('r_cost', 'obj_cost')],
    });
    expect(result.items.map((i) => i.id)).toEqual(['r_cost', 'r_time']);
    expect(result.items[0].isProtected).toBe(true);
    expect(result.items[1].isProtected).toBe(false);
  });

  it('within the protected block, holds risks then actions then milestones', () => {
    const result = run({
      risks: [risk('r_cost', 'obj_cost')],
      actions: [action('a_q', 'obj_quality')],
      health: health({
        objectives: [objRow('cost', true, [milestone('m_cost', 3, 'red')])],
      }),
    });
    expect(result.items.map((i) => i.kind)).toEqual([
      ATTENTION_KINDS.RISK,
      ATTENTION_KINDS.ACTION,
      ATTENTION_KINDS.MILESTONE,
    ]);
  });
});

describe('deriveAttention: the M7.2 dedupe', () => {
  it('collapses a risk and its open promoted action to one row, the action, naming the risk', () => {
    const promoted = action('a1', 'obj_cost', {
      source: 'risk',
      source_id: 'r_cost',
      reason: 'Raised from a critical risk scored serious.',
      description: 'Mitigate: risk r_cost',
    });
    const result = run({
      risks: [risk('r_cost', 'obj_cost')],
      actions: [promoted],
    });
    expect(result.items).toHaveLength(1);
    const row = result.items[0];
    expect(row.kind).toBe(ATTENTION_KINDS.ACTION);
    expect(row.id).toBe('a1');
    expect(row.raisedFrom).toBe('Raised from a critical risk scored serious.');
    // The risk itself never appears as its own row.
    expect(result.items.some((i) => i.kind === ATTENTION_KINDS.RISK)).toBe(false);
    expect(result.total).toBe(1);
  });

  it('a done promoted action lifts the dedupe: the risk returns as its own row', () => {
    const doneAction = action('a1', 'obj_cost', {
      source: 'risk',
      source_id: 'r_cost',
      status: 'done',
    });
    const result = run({
      risks: [risk('r_cost', 'obj_cost')],
      actions: [doneAction],
    });
    // The done action is gone; the still-qualifying risk is the one row.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe(ATTENTION_KINDS.RISK);
    expect(result.items[0].id).toBe('r_cost');
  });
});

describe('deriveAttention: accepted and closed risks', () => {
  it('an accepted risk the monitor does not flag stays off the list', () => {
    const accepted = risk('r_acc', 'obj_cost', {
      status: 'accepted',
      likelihood: 'low',
      impact: 'low', // minor
      last_reviewed_at: RECENT,
      response_note: 'noted',
    });
    const result = run({ risks: [accepted] });
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('an accepted risk the monitor flags does appear', () => {
    const accepted = risk('r_acc', 'obj_cost', {
      status: 'accepted', // Serious high x high still trips escalated-severity
      last_reviewed_at: RECENT,
      response_note: 'noted',
    });
    const result = run({ risks: [accepted] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('r_acc');
    expect(result.items[0].trigger.key).toBe(ATTENTION_TRIGGERS.ESCALATED_SEVERITY);
  });

  it('a closed risk never appears', () => {
    const result = run({ risks: [risk('r_x', 'obj_cost', { status: 'closed' })] });
    expect(result.total).toBe(0);
  });
});

describe('deriveAttention: needs-your-response and unlinked', () => {
  it('surfaces a critical risk being acted on but not yet tracked, that the monitor missed', () => {
    const acting = risk('r_nyr', 'obj_cost', {
      status: 'acting',
      likelihood: 'low',
      impact: 'low', // minor: the monitor does not escalate a critical risk below moderate
      last_reviewed_at: RECENT,
      response_note: 'in hand',
    });
    const result = run({ risks: [acting] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe(ATTENTION_KINDS.RISK);
    expect(result.items[0].trigger.key).toBe(ATTENTION_TRIGGERS.NEEDS_RESPONSE);
  });

  it('excludes an unlinked risk: it sits outside the objective framework', () => {
    const unlinked = risk('r_unl', null); // Serious, watching, but no objective link
    const result = run({ risks: [unlinked] });
    expect(result.total).toBe(0);
  });

  it('does not headline a standard risk flagged only by not-yet-engaged', () => {
    // Never-reviewed, moderate, on a flexible objective: the monitor flags it
    // (not-yet-engaged), but the Band 3 line would misread it as critical, so
    // it stays in the register, not here.
    const r = risk('r_std', 'obj_time', {
      likelihood: 'medium',
      impact: 'medium',
      status: 'watching',
      last_reviewed_at: null,
    });
    const result = run({ risks: [r] });
    expect(result.total).toBe(0);
  });

  it('still headlines a never-reviewed critical risk with not-yet-engaged', () => {
    // Minor and being acted on with a note, so escalated-severity and
    // critical-and-unmanaged stay silent: not-yet-engaged is the sole trigger,
    // and on a protected objective the line reads true.
    const r = risk('r_crit', 'obj_cost', {
      likelihood: 'low',
      impact: 'low',
      status: 'acting',
      response_note: 'looking into it',
      last_reviewed_at: null,
    });
    const result = run({ risks: [r] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].trigger.key).toBe(ATTENTION_TRIGGERS.NOT_YET_ENGAGED);
  });
});

describe('deriveAttention: programme rows', () => {
  it('emits milestone-red, milestone-amber, and gate triggers with the served objective', () => {
    const result = run({
      health: health({
        objectives: [
          objRow('cost', true, [milestone('m_cost', 3, 'red')]),
          objRow('time', false, [milestone('m_time', 4, 'amber')]),
        ],
        gates: [gate('gate_5', 5, 'red')],
      }),
    });
    // Gate first, then the protected red milestone, then the flexible amber one.
    expect(result.items.map((i) => i.kind)).toEqual([
      ATTENTION_KINDS.GATE,
      ATTENTION_KINDS.MILESTONE,
      ATTENTION_KINDS.MILESTONE,
    ]);
    const gateRow = result.items[0];
    expect(gateRow.trigger.key).toBe(ATTENTION_TRIGGERS.GATE_RED);
    expect(gateRow.objectiveType).toBeNull();
    expect(gateRow.stage).toBe(5);

    const redMs = result.items[1];
    expect(redMs.trigger.key).toBe(ATTENTION_TRIGGERS.MILESTONE_RED);
    expect(redMs.objectiveType).toBe('cost');
    expect(redMs.isProtected).toBe(true);

    const amberMs = result.items[2];
    expect(amberMs.trigger.key).toBe(ATTENTION_TRIGGERS.MILESTONE_AMBER);
    expect(amberMs.objectiveType).toBe('time');
    expect(amberMs.isProtected).toBe(false);
  });
});

describe('deriveAttention: the cap and the overflow', () => {
  it('caps at five and counts the true overflow across all sources', () => {
    // Four protected risks and three flagged protected milestones: seven items,
    // two of them beyond the cap, and the overflow is milestones (the source
    // sorted last), so the footer points at the Programme.
    const risks = [
      risk('r1', 'obj_cost'),
      risk('r2', 'obj_cost'),
      risk('r3', 'obj_cost'),
      risk('r4', 'obj_cost'),
    ];
    const h = health({
      objectives: [
        objRow('quality', true, [
          milestone('m1', 3, 'red'),
          milestone('m2', 3, 'red'),
          milestone('m3', 3, 'red'),
        ]),
      ],
    });
    const result = run({ risks, health: h });
    expect(result.items).toHaveLength(ATTENTION_CAP);
    expect(result.total).toBe(7);
    expect(result.overflow).toBe(2);
    expect(result.overflowModule).toBe(ATTENTION_MODULES.PROGRAMME);
  });

  it('reports no overflow when the total sits at the cap', () => {
    const risks = Array.from({ length: 5 }, (_, i) => risk(`r${i}`, 'obj_cost'));
    const result = run({ risks });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.overflow).toBe(0);
    expect(result.overflowModule).toBeNull();
  });
});

describe('deriveAttention: the empty state', () => {
  it('returns an empty list on a calm project', () => {
    const result = run({ risks: [], actions: [], health: health() });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.overflow).toBe(0);
    expect(result.overflowModule).toBeNull();
  });

  it('an open critical action becomes a row with the open-critical trigger', () => {
    const result = run({ actions: [action('a1', 'obj_cost')] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe(ATTENTION_KINDS.ACTION);
    expect(result.items[0].trigger.key).toBe(ATTENTION_TRIGGERS.OPEN_CRITICAL_ACTION);
    expect(result.items[0].module).toBe(ATTENTION_MODULES.ACTIONS);
    // A hand-logged action carries no raised-from provenance.
    expect(result.items[0].raisedFrom).toBeNull();
  });

  it('a playbook-promoted action carries no raised-from line: only a risk is named', () => {
    const a = action('a_pb', 'obj_cost', {
      source: 'playbook',
      source_id: 'play_1',
      reason: 'A long playbook rationale that is not a raised-from line.',
    });
    const result = run({ actions: [a] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].raisedFrom).toBeNull();
  });

  it('a standard (flexible-linked) action is not critical, so it does not appear', () => {
    const result = run({ actions: [action('a1', 'obj_time')] });
    expect(result.total).toBe(0);
  });
});

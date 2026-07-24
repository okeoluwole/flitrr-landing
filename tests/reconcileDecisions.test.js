import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import { deriveRealityCheck } from '../lib/engine/programmeRealityCheck.js';
import { assembleProgramme } from '../lib/engine/programmeAssembly.js';
import {
  reconcileBaseline,
  referenceFromChoices,
} from '../lib/engine/programmeReconciliation.js';
import { buildObjectiveIndex } from '../lib/engine/criticality.js';
import {
  RECONCILE_DECISIONS,
  allowedDecisions,
  agreedDate,
  isDecisionValid,
  checkAmendedDate,
  canProceed,
  proceedBlockers,
  blockerLine,
  firstBlockingKey,
  buildResolutions,
  isVariance,
  toDateInputValue,
} from '../app/pulse/app/programme/setup/reconcileModel.js';
import {
  latestDecisionsByKey,
  decisionUnchanged,
  decisionRowFrom,
  verificationActionFrom,
  verificationReason,
  planDecisionWrites,
  describeDecision,
  DECISION_LABEL,
} from '../app/pulse/app/programme/setup/reconcileDecisionStore.js';
import { finaliseProgrammeForLock } from '../app/pulse/app/programme/setup/reviewLockModel.js';

/**
 * The one decision grammar at Reconcile dates (Note 14). Proves that every
 * flagged date ends in a RECORDED decision, and that each of the three outcomes
 * the VERIFY LOCALLY card was missing now exists and writes what it claims:
 *
 *   Confirm, verified locally  -> the attestation, with who, when and the note
 *   Amend the date             -> the operational date is set here, recorded as
 *                                 a variance the lock-time reconciliation reads
 *                                 as EXPLAINED, and the locked Brief untouched
 *   Verify later               -> the flow proceeds and an open verification
 *                                 action is raised on the Action Log
 *
 * It also proves the disabled-button affordance: what blocks the proceed is
 * counted and named, so a selected keep with an empty reason never again reads
 * as "keeping your date is not allowed".
 *
 * Fixtures come from the real engines (deriveRealityCheck, assembleProgramme,
 * reconcileBaseline) so the grammar is tested against genuine output, not a
 * hand-mocked shape. A fixed UTC anchor keeps every date deterministic.
 */

const T = PROGRAMME_TEMPLATE;
const { ACCEPTED, KEPT, AMENDED, VERIFIED, DEFERRED } = RECONCILE_DECISIONS;

const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);

const PID = '7cbb767e-0000-4000-8000-000000000000';
const USER = '11111111-2222-4333-8444-555555555555';
const BRIEF = '99999999-8888-4777-8666-555555555555';

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

const gate = (result, stage) =>
  result.items.find((i) => i.kind === 'gate' && i.stage === stage);

// Stage 3 at 56 weeks is location-sensitive with no confirmed floor, so it is
// the flag_verify card: the one PULSE refuses to put a number on.
const VERIFY_CHECK = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }));
const VERIFY_ITEM = gate(VERIFY_CHECK, 3);

// Stage 0 at 31 weeks is out of band but not location-sensitive, so it is the
// recommendation card.
const PROPOSE_CHECK = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
const PROPOSE_ITEM = gate(PROPOSE_CHECK, 0);

// Stage 5 at 78 weeks against a confirmed 30-week floor is the force card.
const FORCE_CHECK = deriveRealityCheck(
  START,
  T,
  makeChoices({ 5: { gate: w(78) } }),
  { localFloors: { 5: { floorWeeks: 30 } } }
);
const FORCE_ITEM = gate(FORCE_CHECK, 5);

// ---------------------------------------------------------------------------

describe('every flagged date now ends in a recorded decision', () => {
  it('gives the VERIFY LOCALLY card three answers, not one checkbox', () => {
    // The gap Note 14 closes: attest-only covered one outcome of three. A
    // developer who had not checked, or who found a different date, had nowhere
    // to say so.
    expect(allowedDecisions(VERIFY_ITEM)).toEqual([VERIFIED, AMENDED, DEFERRED]);
  });

  it('never offers an accept on a VERIFY LOCALLY card', () => {
    // PULSE refuses to invent a jurisdictional number, so the card carries no
    // recommendation and there is nothing to accept. That refusal is kept.
    expect(VERIFY_ITEM.recommendedDate).toBeNull();
    expect(allowedDecisions(VERIFY_ITEM)).not.toContain(ACCEPTED);
    expect(isDecisionValid(VERIFY_ITEM, { decision: ACCEPTED })).toBe(false);
  });

  it('keeps the recommendation card even-handed and adds the amend', () => {
    expect(allowedDecisions(PROPOSE_ITEM)).toEqual([ACCEPTED, KEPT, AMENDED]);
  });

  it('still refuses to let a breached hard floor be kept', () => {
    expect(allowedDecisions(FORCE_ITEM)).toEqual([ACCEPTED, AMENDED]);
    expect(
      isDecisionValid(FORCE_ITEM, { decision: KEPT, note: 'It will be fine.' })
    ).toBe(false);
  });
});

describe('Confirm, verified locally: the attestation and its record', () => {
  const state = { decision: VERIFIED, note: 'Checked with the Lagos planning office.' };

  it('is valid on the decision alone, the note being optional', () => {
    expect(isDecisionValid(VERIFY_ITEM, { decision: VERIFIED, note: '' })).toBe(true);
    expect(isDecisionValid(VERIFY_ITEM, state)).toBe(true);
  });

  it('keeps the developer own date, so an attestation moves nothing', () => {
    expect(agreedDate(VERIFY_ITEM, VERIFIED, state)).toEqual(VERIFY_ITEM.developerDate);
    const [res] = buildResolutions(VERIFY_CHECK, { gate_3: state });
    expect(isVariance(res)).toBe(false);
  });

  it('writes the attestation with who, when and the note', () => {
    const [res] = buildResolutions(VERIFY_CHECK, { gate_3: state });
    const row = decisionRowFrom(res, {
      projectId: PID,
      sourceBriefId: BRIEF,
      decidedBy: USER,
    });
    expect(row.decision).toBe(VERIFIED);
    expect(row.note).toBe('Checked with the Lagos planning office.');
    expect(row.decided_by).toBe(USER);
    // Stamped against the locked Brief version: that is what puts the decision
    // in the Brief approvals history alongside the lock and the gates. decided_at
    // is the database default, so the record carries a when without this pure
    // shaping ever reading a clock.
    expect(row.source_brief_id).toBe(BRIEF);
    expect(row).not.toHaveProperty('decided_at');
    // It raises no action: nothing is owed after a confirmation.
    expect(row.action_id).toBeNull();
  });
});

describe('Amend the date: the operational date is set, the Brief is not rewritten', () => {
  const amendState = {
    decision: AMENDED,
    note: 'The consultant confirmed a 26 week programme.',
    amendedDate: iso(w(26)),
  };

  it('requires a date, and is invalid without one', () => {
    expect(isDecisionValid(VERIFY_ITEM, { decision: AMENDED, note: '', amendedDate: '' })).toBe(false);
    expect(checkAmendedDate(VERIFY_ITEM, { amendedDate: '' })).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(isDecisionValid(VERIFY_ITEM, amendState)).toBe(true);
  });

  it('refuses an amend that still breaches a confirmed hard floor', () => {
    // The floor mechanic survives the widening: amend is not a back door.
    const belowFloor = { decision: AMENDED, note: '', amendedDate: iso(w(10)) };
    expect(checkAmendedDate(FORCE_ITEM, belowFloor).reason).toBe('below_floor');
    expect(isDecisionValid(FORCE_ITEM, belowFloor)).toBe(false);
    // On or after the floor-compliant recommendation, it is accepted.
    const compliant = {
      decision: AMENDED,
      note: '',
      amendedDate: toDateInputValue(FORCE_ITEM.recommendedDate),
    };
    expect(isDecisionValid(FORCE_ITEM, compliant)).toBe(true);
  });

  it('agrees the amended date, not the developer date and not the recommendation', () => {
    const agreed = agreedDate(PROPOSE_ITEM, AMENDED, amendState);
    expect(toDateInputValue(agreed)).toBe(iso(w(26)));
    expect(toDateInputValue(agreed)).not.toBe(toDateInputValue(PROPOSE_ITEM.developerDate));
    expect(toDateInputValue(agreed)).not.toBe(toDateInputValue(PROPOSE_ITEM.recommendedDate));
  });

  it('records the variance from the Brief, with the Brief date kept alongside', () => {
    const [res] = buildResolutions(PROPOSE_CHECK, { gate_0: amendState });
    expect(isVariance(res)).toBe(true);
    const row = decisionRowFrom(res, {
      projectId: PID,
      sourceBriefId: BRIEF,
      decidedBy: USER,
    });
    expect(row.decision).toBe(AMENDED);
    expect(row.agreed_date).toBe(iso(w(26)));
    // The developer's own Brief date is preserved on the record, so the variance
    // is legible as a variance rather than as a rewritten history.
    expect(row.brief_date).toBe(iso(w(31)));
    expect(row.note).toBe('The consultant confirmed a 26 week programme.');
  });
});

describe('an amend is a variance the lock-time check reads as explained', () => {
  // The whole reason the amend wires into Session A0's reconciliation engine
  // rather than sitting beside it: an amended date differs from the Brief's, and
  // an unexplained difference blocks the lock. The recorded resolution is what
  // makes it explained.
  const choices = makeChoices({ 0: { gate: w(31) } });
  const objectives = [
    { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
    { id: 'obj-cost', objective_type: 'cost', classification: 'non_negotiable' },
  ];
  const amendState = { decision: AMENDED, note: 'Consultant confirmed.', amendedDate: iso(w(26)) };
  const resolutions = buildResolutions(PROPOSE_CHECK, { gate_0: amendState });

  function reconcileWith(resolutionSet) {
    const assembled = assembleProgramme(START, T, choices, resolutionSet, objectives);
    return {
      assembled,
      result: reconcileBaseline({
        assembled,
        reference: referenceFromChoices(choices),
        resolutions: resolutionSet,
        targetCompletionDate: null,
      }),
    };
  }

  it('assembles the amended date onto the baseline', () => {
    const { assembled } = reconcileWith(resolutions);
    const stage0 = assembled.stages.find((s) => s.stage === 0);
    expect(toDateInputValue(stage0.gate.baselineDate)).toBe(iso(w(26)));
  });

  it('passes the reconciliation check with the resolution present', () => {
    const { result } = reconcileWith(resolutions);
    const gateDiffs = result.differences.filter((d) => d.key === 'gate_0');
    expect(gateDiffs).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('blocks the lock with a named difference when the same date has no resolution', () => {
    // Strip the recorded decision and assemble the same amended date by hand.
    // Without the record, the identical baseline is an unexplained mismatch: the
    // decision is doing real governance work, not decorating the screen.
    const { assembled } = reconcileWith(resolutions);
    const unexplained = reconcileBaseline({
      assembled,
      reference: referenceFromChoices(choices),
      resolutions: [],
      targetCompletionDate: null,
    });
    expect(unexplained.ok).toBe(false);
    expect(unexplained.differences.some((d) => d.key === 'gate_0')).toBe(true);
  });

  it('freezes the decision set into v1, so the baseline carries its approvals trail', () => {
    const { assembled, result } = reconcileWith(resolutions);
    const finalised = finaliseProgrammeForLock(assembled, result, false, resolutions);
    expect(finalised.reconciliation.decisions).toHaveLength(1);
    expect(finalised.reconciliation.decisions[0].key).toBe('gate_0');
    expect(finalised.reconciliation.decisions[0].decision).toBe(AMENDED);
    // The assembled programme itself is untouched by the attaching.
    expect(finalised.stages).toBe(assembled.stages);
  });
});

describe('Verify later: the flow proceeds and an open action is raised', () => {
  const deferState = { decision: DEFERRED, note: '' };
  const [deferred] = buildResolutions(VERIFY_CHECK, { gate_3: deferState });
  const objectives = [
    { id: 'obj-time', objective_type: 'time', classification: 'non_negotiable' },
  ];
  const { byId } = buildObjectiveIndex(objectives);

  it('does not block the proceed: the check is owed, not required now', () => {
    expect(isDecisionValid(VERIFY_ITEM, deferState)).toBe(true);
    expect(canProceed(VERIFY_CHECK, { gate_3: deferState })).toBe(true);
  });

  it('proceeds on the developer own date, changing nothing about the baseline', () => {
    expect(deferred.agreedDate).toEqual(VERIFY_ITEM.developerDate);
    expect(isVariance(deferred)).toBe(false);
  });

  it('plans exactly one open verification action for the deferral', () => {
    const plan = planDecisionWrites({
      resolutions: [deferred],
      existingRows: [],
      objectiveIdFor: () => 'obj-time',
    });
    expect(plan.toRecord).toHaveLength(1);
    expect(plan.toRaise).toHaveLength(1);
    expect(plan.toRaise[0].linkedObjectiveId).toBe('obj-time');
  });

  it('raises no action for any other decision', () => {
    for (const state of [
      { decision: VERIFIED, note: '' },
      { decision: AMENDED, note: '', amendedDate: iso(w(50)) },
    ]) {
      const [res] = buildResolutions(VERIFY_CHECK, { gate_3: state });
      const plan = planDecisionWrites({ resolutions: [res], existingRows: [] });
      expect(plan.toRecord).toHaveLength(1);
      expect(plan.toRaise).toEqual([]);
    }
  });

  it('builds an Action Log item that derives its criticality from the objective served', () => {
    const action = verificationActionFrom(deferred, {
      projectId: PID,
      linkedObjectiveId: 'obj-time',
      objectivesById: byId,
    });
    expect(action.project_id).toBe(PID);
    expect(action.description).toContain('Verify locally');
    expect(action.linked_objective_id).toBe('obj-time');
    // Time is non-negotiable here, so the cascade stamps critical. Nothing is
    // entered by hand; the module pattern is honoured.
    expect(action.criticality).toBe('critical');
    expect(action.stage).toBe(VERIFY_ITEM.stage);
    expect(action.source).toBe('programme');
    expect(action.reason).toBe(verificationReason(deferred));
    expect(action.reason).toContain(VERIFY_ITEM.name);
  });

  it('stamps standard when the objective served is flexible', () => {
    const flexible = buildObjectiveIndex([
      { id: 'obj-time', objective_type: 'time', classification: 'flexible' },
    ]).byId;
    const action = verificationActionFrom(deferred, {
      projectId: PID,
      linkedObjectiveId: 'obj-time',
      objectivesById: flexible,
    });
    expect(action.criticality).toBe('standard');
  });

  it('leaves a gate deferral unlinked rather than inventing a link', () => {
    // A gate serves no single objective. The Action Log surfaces an unlinked
    // action as needing a link, which is honest; a silent standard would not be.
    const action = verificationActionFrom(deferred, { projectId: PID });
    expect(action.linked_objective_id).toBeNull();
    expect(action.criticality).toBe('standard');
  });

  it('carries the raised action id back onto the decision record', () => {
    const row = decisionRowFrom(deferred, {
      projectId: PID,
      sourceBriefId: BRIEF,
      decidedBy: USER,
      actionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    expect(row.decision).toBe(DEFERRED);
    expect(row.action_id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  });
});

describe('the write plan is append-only and idempotent', () => {
  const verifyState = { decision: VERIFIED, note: 'Checked.' };
  const [verified] = buildResolutions(VERIFY_CHECK, { gate_3: verifyState });

  it('writes nothing when a re-proceed changes no decision', () => {
    const existing = [
      {
        point_key: 'gate_3',
        decision: VERIFIED,
        agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
        note: 'Checked.',
        decided_at: '2026-07-24T10:00:00.000Z',
      },
    ];
    expect(decisionUnchanged(verified, existing[0])).toBe(true);
    const plan = planDecisionWrites({ resolutions: [verified], existingRows: existing });
    expect(plan.toRecord).toEqual([]);
    expect(plan.toRaise).toEqual([]);
  });

  it('appends a new row when the decision changes', () => {
    const existing = [
      {
        point_key: 'gate_3',
        decision: DEFERRED,
        agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
        note: null,
        action_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        decided_at: '2026-07-24T10:00:00.000Z',
      },
    ];
    const plan = planDecisionWrites({ resolutions: [verified], existingRows: existing });
    expect(plan.toRecord).toHaveLength(1);
    expect(plan.toRaise).toEqual([]);
  });

  it('re-proceeding on an unchanged deferral writes nothing and raises nothing', () => {
    const [deferred] = buildResolutions(VERIFY_CHECK, { gate_3: { decision: DEFERRED, note: '' } });
    const existing = [
      {
        point_key: 'gate_3',
        decision: DEFERRED,
        agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
        note: null,
        action_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        decided_at: '2026-07-24T10:00:00.000Z',
      },
    ];
    const plan = planDecisionWrites({ resolutions: [deferred], existingRows: existing });
    expect(plan.toRecord).toEqual([]);
    expect(plan.toRaise).toEqual([]);
  });

  it('does not raise a second action for a point already carrying a live deferral', () => {
    // The record changes (the agreed date moved) but the outstanding work
    // already exists, so it is recorded once and never duplicated on the log.
    const held = {
      point_key: 'gate_3',
      decision: DEFERRED,
      agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
      note: null,
      action_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      decided_at: '2026-07-24T10:00:00.000Z',
    };
    const moved = {
      key: 'gate_3',
      kind: 'gate',
      stage: 3,
      name: VERIFY_ITEM.name,
      tier: VERIFY_ITEM.tier,
      developerDate: VERIFY_ITEM.developerDate,
      recommendedDate: null,
      agreedDate: w(60),
      decision: DEFERRED,
      note: null,
    };
    const plan = planDecisionWrites({ resolutions: [moved], existingRows: [held] });
    expect(plan.toRecord).toHaveLength(1);
    expect(plan.toRaise).toEqual([]);
  });

  it('raises a fresh action when a confirmed point is deferred again', () => {
    // Deferred, then confirmed, then deferred again: a new check is genuinely
    // owed, so a new action is raised rather than suppressed.
    const [deferred] = buildResolutions(VERIFY_CHECK, { gate_3: { decision: DEFERRED, note: '' } });
    const existing = [
      {
        point_key: 'gate_3',
        decision: DEFERRED,
        agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
        note: null,
        action_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        decided_at: '2026-07-01T09:00:00.000Z',
      },
      {
        point_key: 'gate_3',
        decision: VERIFIED,
        agreed_date: toDateInputValue(VERIFY_ITEM.developerDate),
        note: 'Checked.',
        action_id: null,
        decided_at: '2026-07-20T09:00:00.000Z',
      },
    ];
    const plan = planDecisionWrites({ resolutions: [deferred], existingRows: existing });
    expect(plan.toRecord).toHaveLength(1);
    expect(plan.toRaise).toHaveLength(1);
  });

  it('reads the latest row per point as the current decision', () => {
    const rows = [
      { point_key: 'gate_3', decision: DEFERRED, decided_at: '2026-07-01T09:00:00.000Z' },
      { point_key: 'gate_3', decision: VERIFIED, decided_at: '2026-07-20T09:00:00.000Z' },
      { point_key: 'gate_5', decision: ACCEPTED, decided_at: '2026-07-05T09:00:00.000Z' },
    ];
    const latest = latestDecisionsByKey(rows);
    expect(latest.get('gate_3').decision).toBe(VERIFIED);
    expect(latest.get('gate_5').decision).toBe(ACCEPTED);
    expect(latest.size).toBe(2);
  });

  it('skips a resolution carrying no decision at all', () => {
    const [undecided] = buildResolutions(VERIFY_CHECK, { gate_3: { decision: null, note: '' } });
    const plan = planDecisionWrites({ resolutions: [undecided], existingRows: [] });
    expect(plan.toRecord).toEqual([]);
  });
});

describe('the disabled-button affordance names what is missing', () => {
  // The test symptom, reproduced: "Keep your date" selected with the reason
  // field empty rendered the Assemble programme button disabled with nothing
  // said, which read as "keeping your date is not allowed". The mechanic is
  // right; only the affordance was wrong.
  const keepNoReason = { gate_0: { decision: KEPT, note: '', amendedDate: '' } };

  it('names the missing reason rather than leaving the button silent', () => {
    expect(canProceed(PROPOSE_CHECK, keepNoReason)).toBe(false);
    const blockers = proceedBlockers(PROPOSE_CHECK, keepNoReason);
    expect(blockers.reasonsRequired).toBe(1);
    expect(blockers.undecided).toBe(0);
    expect(blockerLine(blockers)).toBe('1 reason required');
  });

  it('counts undecided dates separately from missing reasons', () => {
    const check = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(31) }, 3: { gate: w(56) }, 7: { gate: w(176) } })
    );
    const decisions = {
      gate_0: { decision: KEPT, note: '', amendedDate: '' },
      gate_3: { decision: null, note: '', amendedDate: '' },
      gate_7: { decision: null, note: '', amendedDate: '' },
    };
    const blockers = proceedBlockers(check, decisions);
    expect(blockers).toMatchObject({
      blocked: true,
      reasonsRequired: 1,
      undecided: 2,
      total: 3,
    });
    expect(blockerLine(blockers)).toBe('1 reason required, 2 dates undecided');
  });

  it('names an amend with no date, and one that breaches its floor', () => {
    const missing = proceedBlockers(PROPOSE_CHECK, {
      gate_0: { decision: AMENDED, note: '', amendedDate: '' },
    });
    expect(blockerLine(missing)).toBe('1 date to set');

    const below = proceedBlockers(FORCE_CHECK, {
      gate_5: { decision: AMENDED, note: '', amendedDate: iso(w(10)) },
    });
    expect(blockerLine(below)).toBe('1 date below its hard floor');
  });

  it('says nothing at all when nothing is blocking', () => {
    const ready = { gate_0: { decision: KEPT, note: 'Contractor is committed.' } };
    expect(canProceed(PROPOSE_CHECK, ready)).toBe(true);
    const blockers = proceedBlockers(PROPOSE_CHECK, ready);
    expect(blockers.blocked).toBe(false);
    expect(blockerLine(blockers)).toBeNull();
  });

  it('points at the first gap so the developer is not left hunting', () => {
    const check = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(31) }, 3: { gate: w(56) } })
    );
    expect(
      firstBlockingKey(check, {
        gate_0: { decision: ACCEPTED, note: '' },
        gate_3: { decision: null, note: '' },
      })
    ).toBe('gate_3');
    expect(
      firstBlockingKey(check, {
        gate_0: { decision: ACCEPTED, note: '' },
        gate_3: { decision: VERIFIED, note: '' },
      })
    ).toBeNull();
  });
});

describe('the recorded decisions read back before the lock', () => {
  it('describes each outcome in plain words', () => {
    const [verified] = buildResolutions(VERIFY_CHECK, {
      gate_3: { decision: VERIFIED, note: 'Checked with the LPA.' },
    });
    expect(describeDecision(verified)).toContain('Confirmed, verified locally');

    const [amended] = buildResolutions(PROPOSE_CHECK, {
      gate_0: { decision: AMENDED, note: 'Consultant confirmed.', amendedDate: iso(w(26)) },
    });
    expect(describeDecision(amended)).toContain('Amended the date');
    expect(describeDecision(amended)).toContain('Consultant confirmed.');

    const [deferred] = buildResolutions(VERIFY_CHECK, {
      gate_3: { decision: DEFERRED, note: '' },
    });
    expect(describeDecision(deferred)).toContain('an open action was raised');
  });

  it('carries no em or en dash in any decision label', () => {
    for (const label of Object.values(DECISION_LABEL)) {
      expect(label).not.toMatch(/[–—]/);
    }
  });
});

describe('pure and deterministic', () => {
  it('mutates neither the reality check nor the decisions passed in', () => {
    const decisions = {
      gate_3: { decision: AMENDED, note: 'x', amendedDate: iso(w(50)) },
    };
    const before = JSON.stringify(decisions);
    const checkBefore = JSON.stringify(VERIFY_CHECK);
    buildResolutions(VERIFY_CHECK, decisions);
    proceedBlockers(VERIFY_CHECK, decisions);
    canProceed(VERIFY_CHECK, decisions);
    expect(JSON.stringify(decisions)).toBe(before);
    expect(JSON.stringify(VERIFY_CHECK)).toBe(checkBefore);
  });

  it('shapes a decision row without reading a clock or inventing an id', () => {
    const [res] = buildResolutions(VERIFY_CHECK, { gate_3: { decision: VERIFIED, note: '' } });
    const a = decisionRowFrom(res, { projectId: PID, sourceBriefId: BRIEF, decidedBy: USER });
    const b = decisionRowFrom(res, { projectId: PID, sourceBriefId: BRIEF, decidedBy: USER });
    expect(a).toEqual(b);
    expect(a).not.toHaveProperty('id');
  });
});

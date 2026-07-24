import { describe, it, expect } from 'vitest';
import { PROGRAMME_TEMPLATE } from '../lib/engine/programmeTemplate.js';
import {
  deriveRealityCheck,
  RECONCILE_TIERS,
} from '../lib/engine/programmeRealityCheck.js';
import {
  RECONCILE_DECISIONS,
  flaggedItems,
  allowedDecisions,
  decisionNeedsReason,
  agreedDate,
  isDecisionValid,
  canProceed,
  initialDecisions,
  reconcileSummary,
  buildResolutions,
} from '../app/pulse/app/programme/setup/reconcileModel.js';

/**
 * The reconcile-decision helper (Programme module Phase 1.2). Proves the pure
 * logic the reconcile screen renders over: only flagged items appear, each
 * tier's decisions are correct, accept agrees the recommendation (never the
 * advised date), keep needs a reason, force is accept-only and blocks until
 * accepted, flag_verify is acknowledged and never blocks, proceed is gated until
 * every flagged item is validly decided, the emitted resolution set is correct,
 * and the clean skip path yields nothing to reconcile.
 *
 * Fixtures are built from the real engine (deriveRealityCheck) so the helper is
 * tested against genuine output, not a hand-mocked shape. A fixed UTC anchor
 * keeps the dates independent of the test runner's timezone.
 */

const T = PROGRAMME_TEMPLATE;
const { ACCEPTED, KEPT, AMENDED, VERIFIED, DEFERRED } = RECONCILE_DECISIONS;
const START = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05, a Monday
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// A Date a whole number of weeks after the fixed anchor, in UTC.
const w = (weeks) => new Date(START.getTime() + weeks * MS_PER_WEEK);
const iso = (date) => date.toISOString().slice(0, 10);
const sameDay = (a, b) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime();

// Build the developer's programme choices from a compact per-stage spec, the
// same shape loadProgrammeChoices returns:
//   { [stage]: { gate?: Date, na?: boolean, milestones?: { [key]: Date } } }
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
const milestone = (result, stage, key) =>
  result.items.find(
    (i) => i.kind === 'milestone' && i.stage === stage && i.key === key
  );

// One representative input that produces all four tiers at once (mirrors the
// engine's own four-tier fixture): stage 0 within_norm, stage 3 flag_verify,
// stage 5 force, stage 7 propose.
const FOUR_TIERS = deriveRealityCheck(
  START,
  T,
  makeChoices({
    0: { gate: w(12) }, // within_norm
    3: { gate: w(56) }, // flag_verify: location-sensitive, no confirmed floor
    5: { gate: w(78) }, // force: confirmed floor breached
    7: { gate: w(176) }, // propose: span out of band, not location-sensitive
  }),
  { localFloors: { 5: { floorWeeks: 30 } } }
);

describe('only flagged items are selected', () => {
  it('excludes within_norm items and keeps propose, force and flag_verify in engine order', () => {
    const flagged = flaggedItems(FOUR_TIERS);
    expect(flagged.map((i) => i.key)).toEqual(['gate_3', 'gate_5', 'gate_7']);
    expect(flagged.every((i) => i.tier !== RECONCILE_TIERS.WITHIN_NORM)).toBe(true);
    // The within_norm gate_0 is present in the engine result but never flagged.
    expect(gate(FOUR_TIERS, 0).tier).toBe(RECONCILE_TIERS.WITHIN_NORM);
    expect(flagged.some((i) => i.key === 'gate_0')).toBe(false);
  });

  it('returns an empty list when nothing is flagged', () => {
    const clean = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(12) }, 1: { gate: w(20) } })
    );
    expect(clean.anyFlagged).toBe(false);
    expect(flaggedItems(clean)).toEqual([]);
  });

  it('is robust to an empty or absent reality check', () => {
    expect(flaggedItems(undefined)).toEqual([]);
    expect(flaggedItems(null)).toEqual([]);
    expect(flaggedItems({})).toEqual([]);
    expect(flaggedItems({ items: [] })).toEqual([]);
  });
});

describe('a propose offers accept, keep and amend', () => {
  // Stage 0 gate at 31 weeks: band 10 to 30, so propose. Recommended back to the
  // activity-sum typical (12 + 8 = 20 weeks); advised is the gateWeeks date (12
  // weeks). Developer date 31 weeks. All three differ, so the choices are clear.
  const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
  const item = gate(r, 0);

  // Note 14 widened the grammar: the recommendation card keeps its two even
  // choices and gains the amend, for when neither offered date is right.
  it('permits exactly accepted, kept and amended', () => {
    expect(item.tier).toBe(RECONCILE_TIERS.PROPOSE);
    expect(allowedDecisions(item)).toEqual([ACCEPTED, KEPT, AMENDED]);
  });

  it('accept agrees the recommended date, not the advised date and not the developer date', () => {
    // The recommendation, the advised date and the developer date are genuinely
    // three different dates here, so the assertion is meaningful.
    expect(sameDay(item.recommendedDate, w(20))).toBe(true);
    expect(sameDay(item.advisedDate, w(12))).toBe(true);
    expect(sameDay(item.developerDate, w(31))).toBe(true);

    const agreed = agreedDate(item, ACCEPTED);
    expect(sameDay(agreed, item.recommendedDate)).toBe(true);
    expect(sameDay(agreed, item.advisedDate)).toBe(false);
    expect(sameDay(agreed, item.developerDate)).toBe(false);
  });

  it('keep agrees the developer date and carries the reason', () => {
    expect(sameDay(agreedDate(item, KEPT), item.developerDate)).toBe(true);
    expect(decisionNeedsReason(KEPT)).toBe(true);
    expect(decisionNeedsReason(ACCEPTED)).toBe(false);
  });

  it('keep without a reason is not a valid, proceedable decision; with a reason it is', () => {
    expect(isDecisionValid(item, { decision: KEPT, note: '' })).toBe(false);
    expect(isDecisionValid(item, { decision: KEPT, note: '   ' })).toBe(false);
    expect(
      isDecisionValid(item, { decision: KEPT, note: 'Contractor confirmed the run.' })
    ).toBe(true);
  });

  it('accept is valid with no note', () => {
    expect(isDecisionValid(item, { decision: ACCEPTED, note: '' })).toBe(true);
  });
});

describe('a force offers accept or a floor-compliant amend, never a keep', () => {
  // Stage 3 gate below a confirmed 20 week floor: force. The only fixture that
  // produces a force in the region-neutral data is a supplied, breached floor.
  const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(36) } }), {
    localFloors: { 3: { floorWeeks: 20 } },
  });
  const item = gate(r, 3);

  it('is a force with a floor-compliant recommendation', () => {
    expect(item.tier).toBe(RECONCILE_TIERS.FORCE);
    expect(item.recommendedDate).not.toBeNull();
  });

  // The hard-floor mechanic survives the Note 14 widening untouched: a force can
  // never be KEPT, and an amend below the floor is refused just as a keep is.
  it('permits accepted and amended, never kept', () => {
    expect(allowedDecisions(item)).toEqual([ACCEPTED, AMENDED]);
    expect(isDecisionValid(item, { decision: KEPT, note: 'I would rather keep mine.' })).toBe(false);
  });

  it('accept agrees the floor-compliant recommended date', () => {
    expect(sameDay(agreedDate(item, ACCEPTED), item.recommendedDate)).toBe(true);
  });

  it('an unresolved force blocks proceed; accepting it clears the block', () => {
    expect(canProceed(r, { gate_3: { decision: null, note: '' } })).toBe(false);
    expect(canProceed(r, initialDecisions(r))).toBe(false);
    expect(canProceed(r, { gate_3: { decision: ACCEPTED, note: '' } })).toBe(true);
  });
});

describe('a flag_verify is acknowledged, keeps the developer date, and does not block', () => {
  // Stage 3 location-sensitive with no confirmed floor: flag_verify.
  const r = deriveRealityCheck(START, T, makeChoices({ 3: { gate: w(56) } }));
  const item = gate(r, 3);

  it('carries no recommendation', () => {
    expect(item.tier).toBe(RECONCILE_TIERS.FLAG_VERIFY);
    expect(item.recommendedDate).toBeNull();
  });

  // Note 14: the card is no longer attest-only. It can never be ACCEPTED (there
  // is no jurisdictional number to accept), but it now ends in one of three
  // recorded decisions rather than a single checkbox.
  it('permits verified, amended and deferred, and verified keeps the developer date', () => {
    expect(allowedDecisions(item)).toEqual([VERIFIED, AMENDED, DEFERRED]);
    expect(sameDay(agreedDate(item, VERIFIED), item.developerDate)).toBe(true);
  });

  it('is resolved by acknowledgement alone, the note being optional', () => {
    expect(isDecisionValid(item, { decision: VERIFIED, note: '' })).toBe(true);
    expect(
      isDecisionValid(item, { decision: VERIFIED, note: 'Checked with the LPA.' })
    ).toBe(true);
  });

  it('blocks proceed only until acknowledged, never as a hard floor', () => {
    expect(canProceed(r, { gate_3: { decision: null, note: '' } })).toBe(false);
    expect(canProceed(r, { gate_3: { decision: VERIFIED, note: '' } })).toBe(true);
  });
});

describe('proceed is gated until every flagged item has a valid decision', () => {
  // A propose (stage 0) and a flag_verify (stage 3) together.
  const r = deriveRealityCheck(
    START,
    T,
    makeChoices({ 0: { gate: w(31) }, 3: { gate: w(56) } })
  );

  it('starts undecided and so cannot proceed', () => {
    const decisions = initialDecisions(r);
    expect(Object.keys(decisions).sort()).toEqual(['gate_0', 'gate_3']);
    expect(Object.values(decisions).every((d) => d.decision === null)).toBe(true);
    expect(canProceed(r, decisions)).toBe(false);
  });

  it('still cannot proceed with only one item decided', () => {
    expect(
      canProceed(r, {
        gate_0: { decision: ACCEPTED, note: '' },
        gate_3: { decision: null, note: '' },
      })
    ).toBe(false);
  });

  it('cannot proceed while a keep is missing its reason', () => {
    expect(
      canProceed(r, {
        gate_0: { decision: KEPT, note: '' },
        gate_3: { decision: VERIFIED, note: '' },
      })
    ).toBe(false);
  });

  it('proceeds once every flagged item is validly decided', () => {
    expect(
      canProceed(r, {
        gate_0: { decision: KEPT, note: 'Holding to the funder deadline.' },
        gate_3: { decision: VERIFIED, note: '' },
      })
    ).toBe(true);
  });
});

describe('the emitted resolution set', () => {
  const r = deriveRealityCheck(
    START,
    T,
    makeChoices({ 0: { gate: w(31) }, 3: { gate: w(56) } })
  );
  const decisions = {
    gate_0: { decision: ACCEPTED, note: '' },
    gate_3: { decision: VERIFIED, note: 'Confirmed the determination period.' },
  };

  it('produces one resolution per flagged item, in engine order, excluding within_norm', () => {
    const resolutions = buildResolutions(r, decisions);
    expect(resolutions.map((x) => x.key)).toEqual(['gate_0', 'gate_3']);
  });

  it('carries the right fields for an accepted propose', () => {
    const res = buildResolutions(r, decisions)[0];
    const item = gate(r, 0);
    expect(res).toMatchObject({
      key: 'gate_0',
      kind: 'gate',
      stage: 0,
      tier: RECONCILE_TIERS.PROPOSE,
      decision: ACCEPTED,
      note: null,
    });
    expect(sameDay(res.developerDate, item.developerDate)).toBe(true);
    expect(sameDay(res.recommendedDate, item.recommendedDate)).toBe(true);
    expect(sameDay(res.agreedDate, item.recommendedDate)).toBe(true);
  });

  it('carries the right fields for an acknowledged flag_verify, keeping the developer date and the note', () => {
    const res = buildResolutions(r, decisions)[1];
    const item = gate(r, 3);
    expect(res).toMatchObject({
      key: 'gate_3',
      kind: 'gate',
      stage: 3,
      tier: RECONCILE_TIERS.FLAG_VERIFY,
      decision: VERIFIED,
      recommendedDate: null,
      note: 'Confirmed the determination period.',
    });
    expect(sameDay(res.agreedDate, item.developerDate)).toBe(true);
  });

  it('records a kept divergence with its reason and the developer date as agreed', () => {
    const r2 = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
    const res = buildResolutions(r2, {
      gate_0: { decision: KEPT, note: '  Funder deadline is fixed.  ' },
    })[0];
    const item = gate(r2, 0);
    expect(res.decision).toBe(KEPT);
    expect(res.note).toBe('Funder deadline is fixed.'); // trimmed
    expect(sameDay(res.agreedDate, item.developerDate)).toBe(true);
  });

  it('drops a stale note on an accepted decision (keep reason typed, then switched to accept)', () => {
    // The screen preserves a typed note in state when the developer toggles from
    // keep to accept, so the resolution must not carry it: an accepted decision
    // emits note null, and the agreed date is the recommendation.
    const r2 = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
    const res = buildResolutions(r2, {
      gate_0: { decision: ACCEPTED, note: 'A reason left over from keeping.' },
    })[0];
    const item = gate(r2, 0);
    expect(res.decision).toBe(ACCEPTED);
    expect(res.note).toBeNull();
    expect(sameDay(res.agreedDate, item.recommendedDate)).toBe(true);
  });

  it('emits nothing when nothing is flagged', () => {
    const clean = deriveRealityCheck(
      START,
      T,
      makeChoices({ 0: { gate: w(12) }, 1: { gate: w(20) } })
    );
    expect(buildResolutions(clean, {})).toEqual([]);
  });
});

describe('a milestone propose is handled the same way as a gate propose', () => {
  // Stage 0 heads_of_terms at 10 weeks: offset band 3 to 9, so propose;
  // recommended back to the curated 6 week offset.
  const r = deriveRealityCheck(
    START,
    T,
    makeChoices({ 0: { milestones: { heads_of_terms: w(10) } } })
  );
  const item = milestone(r, 0, 'heads_of_terms');

  it('offers accept, keep and amend, accept agreeing the recommended offset', () => {
    expect(item.kind).toBe('milestone');
    expect(allowedDecisions(item)).toEqual([ACCEPTED, KEPT, AMENDED]);
    expect(sameDay(agreedDate(item, ACCEPTED), item.recommendedDate)).toBe(true);
    expect(sameDay(agreedDate(item, KEPT), item.developerDate)).toBe(true);
  });

  it('keys the resolution by the milestone stable key', () => {
    const res = buildResolutions(r, {
      heads_of_terms: { decision: ACCEPTED, note: '' },
    })[0];
    expect(res.key).toBe('heads_of_terms');
    expect(res.kind).toBe('milestone');
  });
});

describe('initialDecisions seeds no default selection', () => {
  it('gives every flagged item a null decision, an empty note and no amended date, and nothing for within_norm', () => {
    const decisions = initialDecisions(FOUR_TIERS);
    const blank = { decision: null, note: '', amendedDate: '' };
    expect(Object.keys(decisions).sort()).toEqual(['gate_3', 'gate_5', 'gate_7']);
    expect(decisions.gate_3).toEqual(blank);
    expect(decisions.gate_5).toEqual(blank);
    expect(decisions.gate_7).toEqual(blank);
    expect(decisions.gate_0).toBeUndefined();
  });

  it('seeds nothing for a clean reality check', () => {
    const clean = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(12) } }));
    expect(initialDecisions(clean)).toEqual({});
    expect(canProceed(clean, initialDecisions(clean))).toBe(true);
  });
});

describe('reconcileSummary tallies the tiers for the footer', () => {
  it('counts the flagged total, the within-range total and each tier', () => {
    expect(reconcileSummary(FOUR_TIERS)).toEqual({
      flagged: 3,
      withinNorm: 1,
      propose: 1,
      force: 1,
      flagVerify: 1,
    });
  });

  it('reads zero on an empty reality check', () => {
    expect(reconcileSummary(undefined)).toEqual({
      flagged: 0,
      withinNorm: 0,
      propose: 0,
      force: 0,
      flagVerify: 0,
    });
  });
});

describe('allowedDecisions and agreedDate are defensive on odd input', () => {
  it('permits nothing for a within_norm item or an unknown tier', () => {
    expect(allowedDecisions({ tier: RECONCILE_TIERS.WITHIN_NORM })).toEqual([]);
    expect(allowedDecisions({ tier: 'something_else' })).toEqual([]);
    expect(allowedDecisions(null)).toEqual([]);
    expect(allowedDecisions(undefined)).toEqual([]);
  });

  it('returns null agreed date for no decision or a null item', () => {
    expect(agreedDate({ recommendedDate: w(1) }, null)).toBeNull();
    expect(agreedDate(null, ACCEPTED)).toBeNull();
  });
});

describe('pure and deterministic', () => {
  it('does not mutate the reality check or the decisions passed in', () => {
    const r = deriveRealityCheck(START, T, makeChoices({ 0: { gate: w(31) } }));
    const rSnapshot = JSON.stringify(r);
    const decisions = { gate_0: { decision: ACCEPTED, note: '' } };
    const dSnapshot = JSON.stringify(decisions);
    buildResolutions(r, decisions);
    canProceed(r, decisions);
    flaggedItems(r);
    expect(JSON.stringify(r)).toBe(rSnapshot);
    expect(JSON.stringify(decisions)).toBe(dSnapshot);
  });
});

import { describe, it, expect } from 'vitest';
import {
  computeAppraisal,
  baseCaseInputs,
  ENGINE_VERSION,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  JV_PARTNER_CONTRIBUTES,
  PROMOTE_HURDLE_BASIS,
  INTEREST_BASIS,
  BUILD_DRAWDOWN_PROFILE,
  FUNDING_SEQUENCE,
  YES,
  NO,
} from '../lib/stack/engine/index.js';

/**
 * Sub-step 1.10: the full parity harness, the Bucket 1 acceptance gate. It
 * checks the assembled result against the workbook headline, proves the engine
 * is deterministic, and fuzzes the reconciliation invariants across the whole
 * input space and all five strategies. The invariants are the model's own
 * acceptance checks: they must read zero for every input, not only the base case.
 */

// A small deterministic PRNG (mulberry32), so the fuzz is reproducible without
// the system clock or Math.random.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInputs(rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const between = (lo, hi) => lo + rng() * (hi - lo);

  const gdv = between(1_000_000, 10_000_000);
  const constructionStartMonth = 2 + Math.floor(rng() * 5); // 2 to 6
  const constructionEndMonth = constructionStartMonth + 6 + Math.floor(rng() * 18);
  const completionSaleMonth = constructionEndMonth + Math.floor(rng() * 6);

  const inputs = {
    ...baseCaseInputs(),
    fundingStrategy: pick([
      FUNDING_STRATEGY.SELF_FUNDED,
      FUNDING_STRATEGY.DEBT_FINANCED,
      FUNDING_STRATEGY.JOINT_VENTURE,
      FUNDING_STRATEGY.OFF_PLAN,
    ]),
    debtStructure: pick([DEBT_STRUCTURE.SENIOR_ONLY, DEBT_STRUCTURE.SENIOR_PLUS_MEZZ]),
    jvPartnerContributes: pick([
      JV_PARTNER_CONTRIBUTES.CASH,
      JV_PARTNER_CONTRIBUTES.LAND,
      JV_PARTNER_CONTRIBUTES.BOTH,
    ]),
    seniorAlongsideJv: pick([YES, NO]),
    ownLand: pick([YES, NO]),
    gdv,
    salesCostsRate: between(0, 0.04),
    constructionCost: gdv * between(0.35, 0.65),
    professionalFees: gdv * between(0.02, 0.08),
    statutory: gdv * between(0, 0.03),
    acquisitionLegal: gdv * between(0, 0.01),
    landValue: gdv * between(0.05, 0.2),
    sdlt: gdv * between(0, 0.02),
    programmeMonths: completionSaleMonth,
    constructionStartMonth,
    constructionEndMonth,
    completionSaleMonth,
    devManagementFeeRate: between(0.01, 0.03),
    seniorLtcCap: between(0.4, 0.7),
    seniorLtgdvCap: between(0.4, 0.65),
    seniorInterestRate: between(0.05, 0.12),
    seniorArrangementFee: between(0.01, 0.02),
    seniorExitFee: between(0.005, 0.02),
    preferredReturnRate: between(0.06, 0.12),
    cashEquityPartnerSplit: between(0.4, 0.8),
    residualProfitToCapital: between(0.3, 0.7),
    targetProfitOnCost: between(0.12, 0.25),
    mezzanineCombinedLtc: between(0.65, 0.85),
    mezzanineInterestRate: between(0.1, 0.14),
    promoteHurdleBasis: pick([
      PROMOTE_HURDLE_BASIS.PREFERRED_RETURN,
      PROMOTE_HURDLE_BASIS.EQUITY_MULTIPLE,
    ]),
    equityMultipleHurdle: between(1.2, 1.5),
    modelPresales: pick([YES, NO]),
    presaleProportionNdv: between(0.3, 0.6),
    corporationTaxRate: between(0, 0.3),
    useGpCatchupCarry: pick([YES, NO]),
    carriedInterest: between(0.1, 0.3),
    constructionContingency: between(0, 0.1),
    holdingCostPerMonth: between(0, 5000),
    interestBasis: pick([INTEREST_BASIS.OPENING_BALANCE, INTEREST_BASIS.AVERAGE_BALANCE]),
    buildDrawdownProfile: pick([BUILD_DRAWDOWN_PROFILE.EVEN, BUILD_DRAWDOWN_PROFILE.S_CURVE]),
    buildCostInflation: between(0, 0.08),
    salesValueGrowth: between(0, 0.08),
    fundingSequence: pick([FUNDING_SEQUENCE.DEBT_FIRST, FUNDING_SEQUENCE.EQUITY_FIRST]),
    reportingCurrency: pick(['GBP', 'USD', 'NGN']),
  };

  // Keep the fuzz in the model's supported domain. The mezzanine is sized on the
  // total project cost, but only fills the cash gap. When contributed land or
  // pre-sale receipts shrink that gap below the mezzanine, the mezzanine
  // oversizes and the cash reconciliation does not hold, in the workbook as well
  // as here. So the mezzanine branch is fuzzed without contributed land or
  // pre-sales; that combination is pinned separately below.
  if (
    inputs.fundingStrategy === FUNDING_STRATEGY.DEBT_FINANCED &&
    inputs.debtStructure === DEBT_STRUCTURE.SENIOR_PLUS_MEZZ
  ) {
    inputs.ownLand = NO;
    inputs.modelPresales = NO;
  }

  return inputs;
}

const ZERO = 1e-4; // effectively zero for money, well inside the workbook's own tolerance

function invariantsZero(result) {
  expect(Math.abs(result.invariants.cashUsesReconciliation)).toBeLessThan(ZERO);
  expect(Math.abs(result.invariants.waterfallReconciliation)).toBeLessThan(ZERO);
  expect(Math.abs(result.invariants.sourcesLessUses)).toBeLessThan(ZERO);
}

describe('computeAppraisal assembles the full base case result', () => {
  const result = computeAppraisal(baseCaseInputs());

  it('reproduces the workbook headline through the assembled result', () => {
    expect(result.returns.projectProfit).toBeCloseTo(614632.6913, 2);
    expect(result.returns.profitOnCost).toBeCloseTo(0.194605, 6);
    expect(result.returns.equity.irr).toBeCloseTo(0.322505, 6);
    expect(result.decision.decision).toBe('CONSIDER');
    expect(result.waterfall.parties.sponsor.profit).toBeCloseTo(332161.9113, 2);
    expect(result.comparison.selfFunded.profit).toBeCloseTo(930059, 2);
    expect(result.sensitivity.viability.grid[2][2]).toBeCloseTo(0.194605, 6);
    expect(result.sensitivity.jvTerms.grid[2][2]).toBeCloseTo(2.51306, 5);
  });

  it('holds every reconciliation at zero', () => {
    invariantsZero(result);
  });
});

describe('the engine is deterministic', () => {
  it('gives an identical result for the same inputs', () => {
    const a = computeAppraisal(baseCaseInputs());
    const b = computeAppraisal(baseCaseInputs());
    expect(a).toEqual(b);
  });
});

describe('every strategy produces a coherent, reconciling result', () => {
  const routes = [
    { fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED },
    { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_ONLY },
    { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ },
    { fundingStrategy: FUNDING_STRATEGY.JOINT_VENTURE },
    { fundingStrategy: FUNDING_STRATEGY.OFF_PLAN },
  ];

  for (const route of routes) {
    it(`reconciles and decides for ${route.fundingStrategy} ${route.debtStructure ?? ''}`.trim(), () => {
      const result = computeAppraisal({ ...baseCaseInputs(), ...route });
      expect(Number.isFinite(result.returns.projectProfit)).toBe(true);
      expect(['GO', 'CONSIDER', 'NO GO']).toContain(result.decision.decision);
      invariantsZero(result);
    });
  }
});

describe('the invariants hold across the whole input space (fuzz)', () => {
  it('reconciles for 300 random schemes across all strategies', () => {
    const rng = makeRng(1234567);
    for (let n = 0; n < 300; n += 1) {
      const inputs = randomInputs(rng);
      const result = computeAppraisal(inputs);
      expect(Number.isFinite(result.returns.projectProfit)).toBe(true);
      invariantsZero(result);
    }
  });
});

describe('known limitation, faithfully reproduced: an oversized mezzanine', () => {
  // The workbook sizes the mezzanine on the total project cost, but only fills
  // the cash gap. When contributed land or pre-sale receipts shrink that gap
  // below the mezzanine, the mezzanine oversizes, the cash equity floors at
  // zero, and the cash reconciliation does not read zero. The workbook's own B26
  // audit cell fails the same way. The engine reproduces this rather than
  // diverging from the verified spec; the fix is a product decision, and the
  // front end should not offer these combinations.
  it('mezzanine on large contributed land floors the cash equity and breaks the cash reconciliation', () => {
    const result = computeAppraisal({
      ...baseCaseInputs(),
      fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED,
      debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ,
      ownLand: YES,
      landValue: 2000000,
    });
    expect(result.switches.useMezzanine).toBe(true);
    expect(result.switches.landContributedEquity).toBe(true);
    expect(result.funding.totalCashEquity).toBe(0); // floored
    expect(Math.abs(result.invariants.cashUsesReconciliation)).toBeGreaterThan(1);
    // The waterfall still reconciles; only the cash side is affected.
    expect(Math.abs(result.invariants.waterfallReconciliation)).toBeLessThan(ZERO);
  });

  it('mezzanine with heavy pre-sales floors the cash equity the same way', () => {
    const result = computeAppraisal({
      ...baseCaseInputs(),
      fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED,
      debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ,
      modelPresales: YES,
      presaleProportionNdv: 0.6,
    });
    expect(result.funding.totalCashEquity).toBe(0);
    expect(Math.abs(result.invariants.cashUsesReconciliation)).toBeGreaterThan(1);
    expect(Math.abs(result.invariants.waterfallReconciliation)).toBeLessThan(ZERO);
  });
});

describe('the engine version stamp (sub-step 3.1)', () => {
  it('exports a semantic version for the scheme store to stamp on save', () => {
    // stack_schemes.engine_version (migration 028) records what computed a
    // saved scheme; the save action reads this constant. Semver-shaped so a
    // later engine can be ordered against it.
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

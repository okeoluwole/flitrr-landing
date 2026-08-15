import { describe, it, expect } from 'vitest';
import {
  baseCaseInputs,
  deriveSwitches,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  INTEREST_BASIS,
  BUILD_DRAWDOWN_PROFILE,
  FUNDING_SEQUENCE,
  YES,
} from '../lib/stack/engine/inputs.js';
import {
  presaleReceiptVector,
  seniorSchedule,
  fundingSummary,
} from '../lib/stack/engine/seniorDebt.js';
import { netDevelopmentValue, costOutflowVector } from '../lib/stack/engine/costModel.js';

/**
 * Sub-step 1.3: the senior debt schedule and the funding outputs (Engine rows 6
 * to 31). This is the milestone step: it produces the finance cost of 264,676
 * and the cash-uses reconciliation that must read zero. The base case is checked
 * cell for cell against the workbook's cached values; the toggles are checked
 * against the figures recorded in the workbook's own build log.
 */

function summaryFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  return fundingSummary(i, deriveSwitches(i));
}

const RECON_EPS = 1e-6;

describe('fundingSummary base case matches the workbook cell for cell', () => {
  const f = summaryFor();

  it('reproduces the senior redemption and its parts', () => {
    expect(f.seniorClosingAtCompletion).toBeCloseTo(1856987.1446, 2); // B17
    expect(f.seniorArrangementFee).toBeCloseTo(26043.219, 2); // B18
    expect(f.seniorExitFee).toBeCloseTo(18569.8714, 2); // B19
    expect(f.seniorRedemption).toBeCloseTo(1901600.235, 2); // B20
  });

  it('reproduces the finance cost of 264,676', () => {
    expect(f.totalInterest).toBeCloseTo(220063.2182, 2); // sum of B11
    expect(f.totalFinanceCost).toBeCloseTo(264676.3087, 2); // B21
  });

  it('reproduces the peak exposure and the drawn total', () => {
    expect(f.peakSeniorDebt).toBeCloseTo(1856987.1446, 2); // B22
    expect(f.totalSeniorDrawn).toBeCloseTo(1636923.9264, 2); // B12
  });

  it('reproduces the cash equity and its sponsor and partner split', () => {
    expect(f.totalCashEquity).toBeCloseTo(731767.0736, 2); // B23
    expect(f.sponsorCashEquity).toBeCloseTo(219530.1221, 2); // B24
    expect(f.partnerCashEquity).toBeCloseTo(512236.9515, 2); // B25
  });

  it('reconciles: funded cash uses equal cash uses (B26 = 0)', () => {
    expect(Math.abs(f.cashUsesReconciliation)).toBeLessThan(RECON_EPS);
  });
});

describe('the senior schedule is a sound recurrence', () => {
  const i = baseCaseInputs();
  const s = deriveSwitches(i);
  const ndv = netDevelopmentValue(i);
  const cost = costOutflowVector(i, s);
  const presale = presaleReceiptVector(i, cost, ndv);
  const { totals } = summaryFor();
  const sched = seniorSchedule(i, cost, presale, totals.seniorFacilityLimit);

  it('opens at zero and each closing is opening plus interest plus draw', () => {
    expect(sched.opening[0]).toBe(0);
    for (let idx = 0; idx < sched.closing.length; idx += 1) {
      expect(sched.closing[idx]).toBeCloseTo(
        sched.opening[idx] + sched.interest[idx] + sched.draws[idx],
        6,
      );
    }
  });

  it('caps each draw at the remaining headroom, though rolled interest may exceed the facility', () => {
    const facility = totals.seniorFacilityLimit;
    const rate = sched.monthlyRate;
    // Each draw is bounded by the headroom left under the facility after this
    // month's interest, so a new draw never pushes the balance past the cap.
    for (let idx = 0; idx < sched.draws.length; idx += 1) {
      const headroom = Math.max(0, facility - (sched.opening[idx] + sched.opening[idx] * rate));
      expect(sched.draws[idx]).toBeLessThanOrEqual(headroom + 1e-6);
    }
    // Total principal drawn stays under the facility; the balance passes the
    // facility only because interest rolls up on top of it.
    expect(sched.draws.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(facility + 1e-6);
    expect(sched.closing[sched.closing.length - 1]).toBeGreaterThan(facility);
  });
});

describe('finance cost tracks the toggles (workbook build-log figures)', () => {
  it('average balance adds interest over opening balance', () => {
    const base = summaryFor().totalFinanceCost;
    const avg = summaryFor({ interestBasis: INTEREST_BASIS.AVERAGE_BALANCE }).totalFinanceCost;
    expect(avg).toBeCloseTo(271171, 0);
    expect(avg - base).toBeCloseTo(6495, 0);
  });

  it('S-curve back-loading lowers the finance cost', () => {
    expect(summaryFor({ buildDrawdownProfile: BUILD_DRAWDOWN_PROFILE.S_CURVE }).totalFinanceCost).toBeCloseTo(
      255903,
      0,
    );
  });

  it('equity first lowers the finance cost', () => {
    expect(summaryFor({ fundingSequence: FUNDING_SEQUENCE.EQUITY_FIRST }).totalFinanceCost).toBeCloseTo(
      253602,
      0,
    );
  });

  it('off-plan pre-sales cut the rolled-up interest sharply', () => {
    const f = summaryFor({ modelPresales: YES });
    expect(f.totalFinanceCost).toBeCloseTo(89800, 0);
    expect(f.presaleReduction).toBeGreaterThan(0);
  });
});

describe('routes without senior debt', () => {
  it('self-funded draws no senior, carries no finance cost, and reconciles', () => {
    const f = summaryFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED });
    expect(f.totals.seniorFacilityLimit).toBe(0);
    expect(f.totalSeniorDrawn).toBe(0);
    expect(f.totalFinanceCost).toBe(0);
    expect(f.totalCashEquity).toBeCloseTo(f.totals.totalCashUses, 2);
    expect(Math.abs(f.cashUsesReconciliation)).toBeLessThan(RECON_EPS);
  });
});

describe('the mezzanine branch', () => {
  it('sizes a mezzanine top-up and still reconciles', () => {
    const f = summaryFor({
      fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED,
      debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ,
    });
    expect(f.mezzanineFacility).toBeGreaterThan(0);
    expect(f.mezzanineRedemption).toBeGreaterThan(f.mezzanineFacility); // interest rolled up
    expect(Math.abs(f.cashUsesReconciliation)).toBeLessThan(RECON_EPS);
  });
});

describe('the reconciliation holds across every strategy', () => {
  it('reads zero for all five routes', () => {
    const routes = [
      { fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED },
      { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_ONLY },
      { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ },
      { fundingStrategy: FUNDING_STRATEGY.JOINT_VENTURE },
      { fundingStrategy: FUNDING_STRATEGY.OFF_PLAN },
    ];
    for (const route of routes) {
      expect(Math.abs(summaryFor(route).cashUsesReconciliation)).toBeLessThan(RECON_EPS);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  baseCaseInputs,
  deriveSwitches,
  FUNDING_STRATEGY,
  BUILD_DRAWDOWN_PROFILE,
  YES,
  NO,
} from '../lib/stack/engine/inputs.js';
import {
  netDevelopmentValue,
  effectiveBuildCost,
  costTotals,
  costOutflowVector,
} from '../lib/stack/engine/costModel.js';

/**
 * Sub-step 1.2: the cost model. Parity is against the workbook's Inputs derived
 * sizing (C25, C50 to C54, C97) and the Engine tab cost-outflow row (row 5).
 * The base case totals must match to the unit; the monthly vector must match the
 * known per-month figures and, above all, sum to the total cash uses.
 */

function inputs(overrides = {}) {
  return { ...baseCaseInputs(), ...overrides };
}

function totalsFor(overrides = {}) {
  const i = inputs(overrides);
  return costTotals(i, deriveSwitches(i));
}

function vectorFor(overrides = {}) {
  const i = inputs(overrides);
  return costOutflowVector(i, deriveSwitches(i));
}

describe('netDevelopmentValue (Inputs C25)', () => {
  it('is GDV net of sales costs in the base case', () => {
    expect(netDevelopmentValue(baseCaseInputs())).toBeCloseTo(3773000, 2);
  });

  it('grows GDV to the sale month before netting sales costs', () => {
    // 3% annual growth over 30 months lifts NDV above the base.
    const grown = netDevelopmentValue(inputs({ salesValueGrowth: 0.03 }));
    expect(grown).toBeCloseTo(4062374, 0);
  });
});

describe('effectiveBuildCost (Inputs C97)', () => {
  it('equals the base construction cost with no contingency or inflation', () => {
    expect(effectiveBuildCost(baseCaseInputs())).toBeCloseTo(2014249, 2);
  });

  it('lifts the build by the contingency', () => {
    expect(effectiveBuildCost(inputs({ constructionContingency: 0.05 }))).toBeCloseTo(
      2114961.45,
      2,
    );
  });

  it('escalates the build to the construction midpoint by inflation', () => {
    // Matches the workbook build inflation test: 5% pa gives about 2,158,397.
    expect(effectiveBuildCost(inputs({ buildCostInflation: 0.05 }))).toBeCloseTo(2158397, 0);
  });
});

describe('costTotals (Inputs C50 to C54), base case', () => {
  it('reproduces the workbook sizing exactly', () => {
    const t = totalsFor();
    expect(t.devManagementFee).toBeCloseTo(77000, 2); // C50
    expect(t.cashDevCost).toBeCloseTo(2291691, 2); // C51
    expect(t.totalCashUses).toBeCloseTo(2368691, 2); // C52
    expect(t.totalProjectCost).toBeCloseTo(2893691, 2); // C53
    expect(t.seniorFacilityLimit).toBeCloseTo(1736214.6, 1); // C54, LTC binds
  });

  it('the LTC cap binds below the LTGDV cap in the base case', () => {
    const i = baseCaseInputs();
    const t = costTotals(i, deriveSwitches(i));
    const ltc = i.seniorLtcCap * t.totalProjectCost;
    const ltgdv = i.seniorLtgdvCap * i.gdv;
    expect(t.seniorFacilityLimit).toBeCloseTo(ltc, 6);
    expect(ltc).toBeLessThan(ltgdv);
  });
});

describe('costTotals, land treatment', () => {
  it('a cash land purchase adds land and SDLT to cash uses and no contributed land', () => {
    // Self-funded, land not owned: land is bought for cash, SDLT applies.
    const t = totalsFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED, ownLand: NO });
    // cash dev cost + fee + land + SDLT, and no separate contributed-land add.
    expect(t.totalCashUses).toBeCloseTo(2291691 + 77000 + 525000 + 26250, 2);
    expect(t.totalProjectCost).toBeCloseTo(t.totalCashUses, 6);
  });

  it('owned land is contributed at valuation, outside cash uses, no SDLT', () => {
    const t = totalsFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED, ownLand: YES });
    expect(t.totalCashUses).toBeCloseTo(2291691 + 77000, 2);
    expect(t.totalProjectCost).toBeCloseTo(t.totalCashUses + 525000, 2);
  });

  it('the senior facility is zero on a route with no senior debt', () => {
    expect(totalsFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED }).seniorFacilityLimit).toBe(0);
  });
});

describe('costOutflowVector (Engine row 5), base case', () => {
  const v = vectorFor();

  it('has one entry per programme month', () => {
    expect(v).toHaveLength(30);
  });

  it('sums to the total cash uses', () => {
    const sum = v.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(2368691, 2);
  });

  it('spreads acquisition and 30% of fees over the pre-construction months', () => {
    // Months 1 to 6: (7,875 + 0.3 x 221,567) / 6 = 12,390.85 each.
    for (let m = 0; m < 6; m += 1) {
      expect(v[m]).toBeCloseTo(12390.85, 2);
    }
  });

  it('spreads the build pool evenly over the construction months', () => {
    // Months 7 to 27: (2,014,249 + 0.7 x 221,567 + 48,000 + 77,000) / 21.
    for (let m = 6; m < 27; m += 1) {
      expect(v[m]).toBeCloseTo(109254.57, 2);
    }
  });

  it('spends nothing after construction ends', () => {
    expect(v[27]).toBe(0);
    expect(v[28]).toBe(0);
    expect(v[29]).toBe(0);
  });
});

describe('costOutflowVector, drawdown profile', () => {
  it('S-curve keeps the same total but back-loads the build', () => {
    const even = vectorFor();
    const sCurve = vectorFor({ buildDrawdownProfile: BUILD_DRAWDOWN_PROFILE.S_CURVE });
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    expect(sum(sCurve)).toBeCloseTo(sum(even), 2);
    // The first construction month draws far less under the S-curve.
    expect(sCurve[6]).toBeLessThan(even[6]);
    // A mid-construction month draws more than the even rate.
    expect(sCurve[16]).toBeGreaterThan(even[16]);
  });
});

describe('costOutflowVector, land purchase timing', () => {
  it('lands the cash land purchase and SDLT in month 1 only', () => {
    const v = vectorFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED, ownLand: NO });
    // Month 1 carries the pre-construction spread plus land and SDLT.
    expect(v[0]).toBeCloseTo(12390.85 + 525000 + 26250, 2);
    // Month 2 carries only the pre-construction spread.
    expect(v[1]).toBeCloseTo(12390.85, 2);
  });
});

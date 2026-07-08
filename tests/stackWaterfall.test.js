import { describe, it, expect } from 'vitest';
import {
  baseCaseInputs,
  deriveSwitches,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  PROMOTE_HURDLE_BASIS,
  YES,
} from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { distributionWaterfall } from '../lib/stack/engine/waterfall.js';

/**
 * Sub-step 1.5: the distribution waterfall (Waterfall tab). The base joint
 * venture case is checked against the workbook cell for cell, including the
 * known party profits. The reconciliation must read zero for every route, and
 * the waterfall must collapse to all profit to the developer with no partner.
 * The equity-multiple hurdle and the GP catch-up branch are checked against the
 * figures in the workbook build log.
 */

function waterfallFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  return distributionWaterfall(i, s, fundingSummary(i, s));
}

const EPS = 1e-6;

describe('the base joint venture waterfall matches the workbook', () => {
  const w = waterfallFor();

  it('reproduces the capital contributed by party', () => {
    expect(w.capital.sponsor).toBeCloseTo(219530.1221, 2);
    expect(w.capital.partner).toBeCloseTo(512236.9515, 2);
    expect(w.capital.landowner).toBe(525000);
    expect(w.capital.total).toBeCloseTo(1256767.0736, 2);
  });

  it('reproduces the tier flows', () => {
    expect(w.proceedsToEquity).toBeCloseTo(1871399.765, 2); // F12
    expect(w.returnOfCapitalPool).toBeCloseTo(1256767.0736, 2); // F15
    expect(w.proceedsAfterCapital).toBeCloseTo(614632.6913, 2); // F17
    expect(w.prefAccrued.total).toBeCloseTo(220851.2629, 2); // F21
    expect(w.residual).toBeCloseTo(393781.4284, 2); // F26
    expect(w.totalToCapital).toBeCloseTo(196890.7142, 2); // F27
    expect(w.promoteToSponsor).toBeCloseTo(196890.7142, 2); // C28
  });

  it('reproduces the known party profits', () => {
    expect(w.parties.sponsor.profit).toBeCloseTo(332161.9113, 2); // C35
    expect(w.parties.partner.profit).toBeCloseTo(135966.1264, 2); // D35
    expect(w.parties.landowner.profit).toBeCloseTo(223504.6536, 2); // E35
  });

  it('reproduces the party multiples and the sponsor fee income', () => {
    expect(w.parties.sponsor.multiple).toBeCloseTo(2.51306, 4); // C36
    expect(w.parties.partner.multiple).toBeCloseTo(1.26544, 4); // D36
    expect(w.parties.landowner.multiple).toBeCloseTo(1.42572, 4); // E36
    expect(w.parties.sponsor.devFee).toBeCloseTo(77000, 2); // C31
    expect(w.parties.sponsor.cash).toBeCloseTo(551692.0334, 2); // C33
  });

  it('reconciles: NDV equals senior redemption plus all takes (F39 = 0)', () => {
    expect(Math.abs(w.reconciliation)).toBeLessThan(EPS);
  });

  it('the party profits sum to project profit plus the development fee', () => {
    const sum =
      w.parties.sponsor.profit + w.parties.partner.profit + w.parties.landowner.profit;
    // 614,633 project profit plus the 77,000 fee the sponsor earns on top.
    expect(sum).toBeCloseTo(614632.6913 + 77000, 1);
  });
});

describe('the waterfall collapses with no partner', () => {
  it('gives the whole residual to the developer on a self-funded scheme', () => {
    const w = waterfallFor({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED });
    expect(w.capital.partner).toBe(0);
    expect(w.capital.landowner).toBe(0);
    expect(w.parties.partner.received).toBe(0);
    expect(w.parties.landowner.received).toBe(0);
    expect(w.prefAccrued.total).toBe(0); // pref inactive off the JV route
    // The sponsor takes all the residual as to-capital plus promote.
    expect(w.parties.sponsor.received).toBeCloseTo(
      w.returnOfCapitalPool + w.residual,
      2,
    );
    expect(Math.abs(w.reconciliation)).toBeLessThan(EPS);
  });
});

describe('the equity-multiple hurdle basis', () => {
  it('lifts the pref pool to a flat multiple and cuts the sponsor promote', () => {
    const w = waterfallFor({ promoteHurdleBasis: PROMOTE_HURDLE_BASIS.EQUITY_MULTIPLE });
    // 0.3 x total capital of 1,256,767 = 377,030 (workbook build log).
    expect(w.prefAccrued.total).toBeCloseTo(377030, 0);
    expect(w.promoteToSponsor).toBeCloseTo(118801, 0);
    expect(w.parties.sponsor.multiple).toBeCloseTo(2.29, 2);
    expect(Math.abs(w.reconciliation)).toBeLessThan(EPS);
  });
});

describe('the GP catch-up and carry branch', () => {
  it('takes a catch-up of 25% of the LP pref and lowers the sponsor multiple', () => {
    const w = waterfallFor({ useGpCatchupCarry: YES });
    // (0.2 / 0.8) x (partner pref + landowner pref) = 49,243 (workbook build log).
    expect(w.catchup).toBeCloseTo(49243, 0);
    expect(w.parties.sponsor.multiple).toBeCloseTo(2.22, 2);
    expect(Math.abs(w.reconciliation)).toBeLessThan(EPS);
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
      expect(Math.abs(waterfallFor(route).reconciliation)).toBeLessThan(EPS);
    }
  });
});

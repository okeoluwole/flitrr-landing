import { describe, it, expect } from 'vitest';
import {
  baseCaseInputs,
  deriveSwitches,
  resolveCurrencySymbol,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  JV_PARTNER_CONTRIBUTES,
  YES,
  NO,
} from '../lib/stack/engine/inputs.js';

/**
 * Sub-step 1.1: the input contract and the derived strategy switches (Inputs
 * C13 to C20). These lock the branch logic that every later engine module reads,
 * and pin the base case to the workbook's own derived values, so a regression in
 * the switch rules is caught before it reaches the cost model or the waterfall.
 */

// Build an input set from the base case with overrides, so each test states
// only what it changes.
function inputs(overrides = {}) {
  return { ...baseCaseInputs(), ...overrides };
}

describe('baseCaseInputs is the workbook base case', () => {
  it('is the Joint venture, land-for-equity, senior-alongside scheme', () => {
    const i = baseCaseInputs();
    expect(i.fundingStrategy).toBe(FUNDING_STRATEGY.JOINT_VENTURE);
    expect(i.jvPartnerContributes).toBe(JV_PARTNER_CONTRIBUTES.BOTH);
    expect(i.seniorAlongsideJv).toBe(YES);
    expect(i.ownLand).toBe(NO);
    expect(i.gdv).toBe(3850000);
    expect(i.constructionCost).toBe(2014249);
    expect(i.landValue).toBe(525000);
    expect(i.targetProfitOnCost).toBe(0.2);
    expect(i.reportingCurrency).toBe('GBP');
  });

  it('returns a fresh object each call, so callers cannot leak state', () => {
    const a = baseCaseInputs();
    a.gdv = 1;
    expect(baseCaseInputs().gdv).toBe(3850000);
  });
});

describe('deriveSwitches reproduces the base case switches (Inputs C13 to C20)', () => {
  it('matches the workbook derived values exactly', () => {
    expect(deriveSwitches(baseCaseInputs())).toEqual({
      useSeniorDebt: true, // C13 = 1
      useMezzanine: false, // C14 = 0
      partnerProvidesCash: true, // C15 = 1
      partnerProvidesLand: true, // C16 = 1
      landContributedEquity: true, // C17 = 1
      landCashPurchase: false, // C18 = 0
      partnerCashSplitEffective: 0.7, // C19 = 0.7
      prefPromoteActive: true, // C20 = 1
    });
  });
});

describe('deriveSwitches on the Self-funded route', () => {
  it('uses no debt, no partner, no pref, and buys the land for cash when not owned', () => {
    const s = deriveSwitches(inputs({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED }));
    expect(s.useSeniorDebt).toBe(false);
    expect(s.useMezzanine).toBe(false);
    expect(s.partnerProvidesCash).toBe(false);
    expect(s.partnerProvidesLand).toBe(false);
    expect(s.prefPromoteActive).toBe(false);
    expect(s.partnerCashSplitEffective).toBe(0);
    expect(s.landContributedEquity).toBe(false);
    expect(s.landCashPurchase).toBe(true);
  });

  it('contributes the land as equity when the developer already owns it', () => {
    const s = deriveSwitches(
      inputs({ fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED, ownLand: YES }),
    );
    expect(s.landContributedEquity).toBe(true);
    expect(s.landCashPurchase).toBe(false);
  });
});

describe('deriveSwitches on the Debt-financed route', () => {
  it('senior loan only: senior on, mezzanine off', () => {
    const s = deriveSwitches(
      inputs({
        fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED,
        debtStructure: DEBT_STRUCTURE.SENIOR_ONLY,
      }),
    );
    expect(s.useSeniorDebt).toBe(true);
    expect(s.useMezzanine).toBe(false);
    expect(s.prefPromoteActive).toBe(false);
    expect(s.partnerProvidesCash).toBe(false);
  });

  it('senior plus mezzanine: both on', () => {
    const s = deriveSwitches(
      inputs({
        fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED,
        debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ,
      }),
    );
    expect(s.useSeniorDebt).toBe(true);
    expect(s.useMezzanine).toBe(true);
  });
});

describe('deriveSwitches on the Joint venture route', () => {
  it('senior sits alongside only when chosen', () => {
    expect(deriveSwitches(inputs({ seniorAlongsideJv: YES })).useSeniorDebt).toBe(true);
    expect(deriveSwitches(inputs({ seniorAlongsideJv: NO })).useSeniorDebt).toBe(false);
  });

  it('partner brings Cash: cash on, land off, effective split applies', () => {
    const s = deriveSwitches(
      inputs({ jvPartnerContributes: JV_PARTNER_CONTRIBUTES.CASH, ownLand: YES }),
    );
    expect(s.partnerProvidesCash).toBe(true);
    expect(s.partnerProvidesLand).toBe(false);
    expect(s.partnerCashSplitEffective).toBe(0.7);
    // Land is contributed here only because the developer owns it, not the partner.
    expect(s.landContributedEquity).toBe(true);
  });

  it('partner brings Land: land on, cash off, effective split falls to zero', () => {
    const s = deriveSwitches(
      inputs({ jvPartnerContributes: JV_PARTNER_CONTRIBUTES.LAND, ownLand: NO }),
    );
    expect(s.partnerProvidesCash).toBe(false);
    expect(s.partnerProvidesLand).toBe(true);
    expect(s.partnerCashSplitEffective).toBe(0);
    // The partner's land makes it contributed equity even though the developer
    // does not own it.
    expect(s.landContributedEquity).toBe(true);
    expect(s.landCashPurchase).toBe(false);
  });

  it('partner brings Both: cash and land on, pref and promote active', () => {
    const s = deriveSwitches(inputs({ jvPartnerContributes: JV_PARTNER_CONTRIBUTES.BOTH }));
    expect(s.partnerProvidesCash).toBe(true);
    expect(s.partnerProvidesLand).toBe(true);
    expect(s.prefPromoteActive).toBe(true);
  });

  it('a JV with no partner land and no owned land buys the land for cash', () => {
    const s = deriveSwitches(
      inputs({ jvPartnerContributes: JV_PARTNER_CONTRIBUTES.CASH, ownLand: NO }),
    );
    expect(s.landContributedEquity).toBe(false);
    expect(s.landCashPurchase).toBe(true);
  });
});

describe('deriveSwitches on the Off-plan route', () => {
  it('uses senior (bridge) and no partner or pref', () => {
    const s = deriveSwitches(inputs({ fundingStrategy: FUNDING_STRATEGY.OFF_PLAN }));
    expect(s.useSeniorDebt).toBe(true);
    expect(s.useMezzanine).toBe(false);
    expect(s.partnerProvidesCash).toBe(false);
    expect(s.prefPromoteActive).toBe(false);
  });
});

describe('resolveCurrencySymbol', () => {
  it('maps the known currencies (Inputs C79)', () => {
    expect(resolveCurrencySymbol('GBP')).toBe('£');
    expect(resolveCurrencySymbol('USD')).toBe('$');
    expect(resolveCurrencySymbol('NGN')).toBe('₦');
  });

  it('falls back to the raw code for an unknown currency', () => {
    expect(resolveCurrencySymbol('ZZZ')).toBe('ZZZ');
  });
});

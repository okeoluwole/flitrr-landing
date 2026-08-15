import { describe, it, expect } from 'vitest';
import {
  baseCaseInputs,
  deriveSwitches,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  NO,
} from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { sourcesAndUses } from '../lib/stack/engine/sizing.js';

/**
 * Sub-step 1.4: sources and uses (Summary D5 to E25). Total sources must equal
 * total uses for every route, and the base case breakdown must match the
 * workbook. This is one of the model's named acceptance checks.
 */

function snuFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  return sourcesAndUses(i, s, fundingSummary(i, s));
}

const EPS = 1e-6;

describe('sourcesAndUses base case', () => {
  const { uses, sources, sourcesLessUses } = snuFor();

  it('lists the uses and totals to the project cost', () => {
    expect(uses.landAtValue).toBe(525000);
    expect(uses.sdlt).toBe(0); // land contributed, no SDLT
    expect(uses.construction).toBeCloseTo(2014249, 2);
    expect(uses.professionalFees).toBe(221567);
    expect(uses.statutory).toBe(48000);
    expect(uses.acquisitionLegal).toBe(7875);
    expect(uses.devManagementFee).toBeCloseTo(77000, 2);
    expect(uses.total).toBeCloseTo(2893691, 2);
  });

  it('lists the sources and totals to the project cost', () => {
    expect(sources.seniorDebt).toBeCloseTo(1636923.9264, 2);
    expect(sources.mezzanine).toBe(0);
    expect(sources.presaleReceipts).toBe(0);
    expect(sources.sponsorEquity).toBeCloseTo(219530.1221, 2);
    expect(sources.partnerEquity).toBeCloseTo(512236.9515, 2);
    expect(sources.contributedLand).toBe(525000);
    expect(sources.total).toBeCloseTo(2893691, 2);
  });

  it('balances: sources equal uses', () => {
    expect(Math.abs(sourcesLessUses)).toBeLessThan(EPS);
  });
});

describe('sourcesAndUses on a cash land purchase', () => {
  it('carries SDLT in the uses and no contributed land, and still balances', () => {
    const { uses, sources, sourcesLessUses } = snuFor({
      fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED,
      ownLand: NO,
    });
    expect(uses.sdlt).toBe(26250);
    expect(sources.contributedLand).toBe(0);
    expect(Math.abs(sourcesLessUses)).toBeLessThan(EPS);
  });
});

describe('sources equal uses for every strategy', () => {
  it('balances on all five routes', () => {
    const routes = [
      { fundingStrategy: FUNDING_STRATEGY.SELF_FUNDED },
      { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_ONLY },
      { fundingStrategy: FUNDING_STRATEGY.DEBT_FINANCED, debtStructure: DEBT_STRUCTURE.SENIOR_PLUS_MEZZ },
      { fundingStrategy: FUNDING_STRATEGY.JOINT_VENTURE },
      { fundingStrategy: FUNDING_STRATEGY.OFF_PLAN },
    ];
    for (const route of routes) {
      expect(Math.abs(snuFor(route).sourcesLessUses)).toBeLessThan(EPS);
    }
  });
});

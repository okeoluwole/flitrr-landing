import { describe, it, expect } from 'vitest';
import { baseCaseInputs, deriveSwitches } from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { distributionWaterfall } from '../lib/stack/engine/waterfall.js';
import {
  irr,
  annualisedIrr,
  equityMultiple,
  returnsAndMetrics,
} from '../lib/stack/engine/returns.js';

/**
 * Sub-step 1.6: returns and metrics (Engine rows 33 to 53, Summary return
 * metrics and residual land value). This is the headline step. The base case is
 * checked against the workbook cell for cell, including the 614,633 profit and
 * every IRR and multiple; the toggles are checked against the workbook build log.
 */

function metricsFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  const f = fundingSummary(i, s);
  const w = distributionWaterfall(i, s, f);
  return returnsAndMetrics(i, s, f, w);
}

describe('the IRR and multiple helpers', () => {
  it('solves a simple periodic IRR', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 9);
  });

  it('annualises the monthly rate by compounding', () => {
    expect(annualisedIrr([-100, 110])).toBeCloseTo(Math.pow(1.1, 12) - 1, 9);
  });

  it('takes the equity multiple as inflows over outflows', () => {
    expect(equityMultiple([-100, 60, 60])).toBeCloseTo(1.2, 9);
  });

  it('returns null when there is no sign change', () => {
    expect(irr([100, 200])).toBeNull();
    expect(equityMultiple([10, 20])).toBeNull();
  });
});

describe('base case returns match the workbook', () => {
  const r = metricsFor();

  it('reproduces the profits', () => {
    expect(r.projectProfitUnlevered).toBeCloseTo(879309, 2); // M7
    expect(r.projectProfit).toBeCloseTo(614632.6913, 2); // M8, the headline
    expect(r.afterTaxProjectProfit).toBeCloseTo(460974.5185, 2); // M9
  });

  it('reproduces profit on cost and on GDV', () => {
    expect(r.profitOnCost).toBeCloseTo(0.194605, 6); // B32
    expect(r.profitOnGdv).toBeCloseTo(0.159645, 6); // E32
  });

  it('reproduces the project, equity and after-tax IRR and multiple', () => {
    expect(r.project.irr).toBeCloseTo(0.208634, 6); // B38
    expect(r.project.multiple).toBeCloseTo(1.303871, 5); // B39
    expect(r.equity.irr).toBeCloseTo(0.322505, 6); // B40
    expect(r.equity.multiple).toBeCloseTo(1.489059, 5); // B41
    expect(r.afterTax.irr).toBeCloseTo(0.25043, 6); // B45
    expect(r.afterTax.multiple).toBeCloseTo(1.366794, 5); // B46
  });

  it('reproduces the per-party IRRs, including the high sponsor rate', () => {
    expect(r.perParty.sponsorIrr).toBeCloseTo(5.046577, 4); // B51
    expect(r.perParty.partnerIrr).toBeCloseTo(0.609074, 5); // B52
    expect(r.perParty.landownerIrr).toBeCloseTo(0.15808, 5); // B53
  });

  it('reproduces the residual land value and the break-even headroom', () => {
    expect(r.residualLandValue).toBeCloseTo(510799.358, 2); // B35
    expect(r.breakEven.gdvFallToBreakEven).toBeCloseTo(0.162903, 6);
    expect(r.breakEven.gdvAtBreakEven).toBeCloseTo(3222823.7843, 2);
    expect(r.breakEven.marginVsTarget).toBeCloseTo(-0.005395, 6);
  });
});

describe('returns track the toggles (workbook build-log figures)', () => {
  it('contingency lowers the profit', () => {
    expect(metricsFor({ constructionContingency: 0.05 }).projectProfit).toBeCloseTo(504262, 0);
  });

  it('a void holding cost lowers the profit by the holding total', () => {
    // 5,000 per month over the 3-month void: 614,633 to 599,633.
    expect(metricsFor({ holdingCostPerMonth: 5000 }).projectProfit).toBeCloseTo(599633, 0);
  });

  it('sales growth lifts the profit', () => {
    expect(metricsFor({ salesValueGrowth: 0.03 }).projectProfit).toBeCloseTo(904006, 0);
  });

  it('build inflation lowers the profit', () => {
    expect(metricsFor({ buildCostInflation: 0.05 }).projectProfit).toBeCloseTo(456661, 0);
  });
});

describe('the tax layer is additive', () => {
  it('reproduces the after-tax figures at 25%', () => {
    const r = metricsFor();
    expect(r.afterTaxProjectProfit).toBeCloseTo(460974.5185, 2);
    expect(r.afterTax.irr).toBeCloseTo(0.25043, 6);
  });

  it('at 0% tax the after-tax view equals the pre-tax view', () => {
    const r = metricsFor({ corporationTaxRate: 0 });
    expect(r.afterTax.profit).toBeCloseTo(r.projectProfit, 6);
    expect(r.afterTax.irr).toBeCloseTo(r.equity.irr, 9);
    expect(r.corporationTax).toBe(0);
  });
});

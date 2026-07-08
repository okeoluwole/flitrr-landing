import { describe, it, expect } from 'vitest';
import { baseCaseInputs, deriveSwitches } from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { distributionWaterfall } from '../lib/stack/engine/waterfall.js';
import { returnsAndMetrics } from '../lib/stack/engine/returns.js';
import { fundingComparison } from '../lib/stack/engine/comparison.js';

/**
 * Sub-step 1.8: the five-route comparison (Comparison tab, Summary routes
 * block). The four closed-form routes and the live selected route are checked
 * against the workbook's cached values. Each shows the developer's own slice.
 */

function comparisonFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  const f = fundingSummary(i, s);
  const w = distributionWaterfall(i, s, f);
  const r = returnsAndMetrics(i, s, f, w);
  return fundingComparison(i, f, w, r);
}

describe('the five-route comparison matches the workbook', () => {
  const c = comparisonFor();

  it('self-funded: most cash in, no debt, highest profit on cost', () => {
    expect(c.selfFunded.cashIn).toBeCloseTo(2842941, 2);
    expect(c.selfFunded.profit).toBeCloseTo(930059, 2);
    expect(c.selfFunded.returnOnCash).toBeCloseTo(1.32715, 4);
    expect(c.selfFunded.profitOnCost).toBeCloseTo(0.327147, 6);
  });

  it('bank-financed: senior debt lowers cash in and adds interest', () => {
    expect(c.bankFinanced.cashIn).toBeCloseTo(1390908.88, 2);
    expect(c.bankFinanced.profit).toBeCloseTo(676326.52, 2);
    expect(c.bankFinanced.returnOnCash).toBeCloseTo(1.48625, 4);
    expect(c.bankFinanced.profitOnCost).toBeCloseTo(0.218404, 6);
  });

  it('mixed: senior plus mezzanine, least cash in of the debt routes', () => {
    expect(c.mixed.cashIn).toBeCloseTo(916137.74, 2);
    expect(c.mixed.profit).toBeCloseTo(582509.46, 2);
    expect(c.mixed.returnOnCash).toBeCloseTo(1.63583, 4);
    expect(c.mixed.profitOnCost).toBeCloseTo(0.182577, 6);
  });

  it('off-plan: pre-sales fund the build, less interest', () => {
    expect(c.offPlan.cashIn).toBeCloseTo(1339783.39, 2);
    expect(c.offPlan.profit).toBeCloseTo(864371.51, 2);
    expect(c.offPlan.returnOnCash).toBeCloseTo(1.64516, 4);
    expect(c.offPlan.profitOnCost).toBeCloseTo(0.297175, 6);
  });

  it('selected joint venture: the developer slice, live from the engine', () => {
    expect(c.selected.strategy).toBe('Joint venture');
    expect(c.selected.cashIn).toBeCloseTo(219530.12, 2);
    expect(c.selected.profit).toBeCloseTo(332161.91, 2);
    expect(c.selected.returnOnCash).toBeCloseTo(2.51306, 4);
    expect(c.selected.profitOnCost).toBeCloseTo(0.194605, 6);
  });
});

describe('the comparison reads the developer slice', () => {
  it('the JV developer profit is their share, below the project profit', () => {
    const c = comparisonFor();
    // The selected JV shows the sponsor slice 332,162, not the 614,633 project
    // profit, because the partner and landowner take shares.
    expect(c.selected.profit).toBeLessThan(614632);
    // The self-funded developer keeps the whole project profit.
    expect(c.selfFunded.profit).toBeGreaterThan(c.selected.profit);
  });

  it('the selected route reflects whichever strategy is chosen', () => {
    const c = comparisonFor({ fundingStrategy: 'Self-funded' });
    expect(c.selected.strategy).toBe('Self-funded');
  });
});

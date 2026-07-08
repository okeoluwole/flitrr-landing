import { describe, it, expect } from 'vitest';
import { baseCaseInputs, deriveSwitches } from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { distributionWaterfall } from '../lib/stack/engine/waterfall.js';
import { returnsAndMetrics } from '../lib/stack/engine/returns.js';
import { viabilityGrid, jvTermsGrid } from '../lib/stack/engine/sensitivity.js';

/**
 * Sub-step 1.9: the two sensitivity grids (Sensitivity tab). Grid 1 re-derives
 * profit on cost as GDV and build cost move; grid 2 re-derives the sponsor
 * multiple as the preferred return and promote move. Both are checked at the
 * corners and the base cell against the workbook.
 */

function context(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  const f = fundingSummary(i, s);
  const w = distributionWaterfall(i, s, f);
  const r = returnsAndMetrics(i, s, f, w);
  return { inputs: i, funding: f, waterfall: w, returns: r };
}

describe('grid 1, scheme viability', () => {
  const { inputs, funding, returns } = context();
  const g = viabilityGrid(inputs, funding);

  it('has the workbook axes: six build rows and five GDV columns', () => {
    expect(g.buildDeltas).toEqual([-0.1, -0.05, 0, 0.05, 0.1, 0.15]);
    expect(g.gdvDeltas).toEqual([-0.1, -0.05, 0, 0.05, 0.1]);
    expect(g.grid).toHaveLength(6);
    expect(g.grid[0]).toHaveLength(5);
  });

  it('the base cell equals the engine profit on cost', () => {
    expect(g.grid[2][2]).toBeCloseTo(returns.profitOnCost, 9);
    expect(g.grid[2][2]).toBeCloseTo(0.194605, 6);
  });

  it('matches the workbook at the corners', () => {
    expect(g.grid[0][0]).toBeCloseTo(0.148382, 6); // build -10%, GDV -10%
    expect(g.grid[0][2]).toBeCloseTo(0.27598, 6); // build -10%, GDV base
    expect(g.grid[5][4]).toBeCloseTo(0.199334, 6); // build +15%, GDV +10%
  });

  it('profit on cost rises with GDV and falls with build cost', () => {
    // Along a row, higher GDV lifts profit on cost.
    expect(g.grid[2][4]).toBeGreaterThan(g.grid[2][0]);
    // Down a column, higher build cost lowers profit on cost.
    expect(g.grid[5][2]).toBeLessThan(g.grid[0][2]);
  });
});

describe('grid 2, the joint venture deal terms', () => {
  const { inputs, waterfall } = context();
  const g = jvTermsGrid(inputs, waterfall);

  it('has the workbook axes: five pref rows and five promote columns', () => {
    expect(g.prefRates).toEqual([0.06, 0.08, 0.1, 0.12, 0.15]);
    expect(g.promoteShares).toEqual([0.3, 0.4, 0.5, 0.6, 0.7]);
    expect(g.grid).toHaveLength(5);
    expect(g.grid[0]).toHaveLength(5);
  });

  it('the base cell equals the base sponsor multiple', () => {
    expect(g.grid[2][2]).toBeCloseTo(waterfall.parties.sponsor.multiple, 6);
    expect(g.grid[2][2]).toBeCloseTo(2.51306, 5);
  });

  it('matches the workbook at the corners', () => {
    expect(g.grid[0][0]).toBeCloseTo(2.3481, 4); // pref 6%, promote 30%
    expect(g.grid[0][2]).toBeCloseTo(2.71249, 4); // pref 6%, promote 50%
    expect(g.grid[4][4]).toBeCloseTo(2.45825, 4); // pref 15%, promote 70%
  });

  it('a bigger promote lifts the sponsor multiple, a higher pref lowers it', () => {
    // Along a row, a bigger promote to the sponsor lifts the multiple.
    expect(g.grid[2][4]).toBeGreaterThan(g.grid[2][0]);
    // Down a column, a higher preferred return lowers the sponsor multiple.
    expect(g.grid[4][2]).toBeLessThan(g.grid[0][2]);
  });
});

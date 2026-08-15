import { describe, it, expect } from 'vitest';
import { baseCaseInputs, deriveSwitches } from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { monthlyCashflow } from '../lib/stack/engine/cashflow.js';

/**
 * The monthly cashflow (Cashflow tab). The base case is checked against the
 * workbook's cached net movement, cumulative position and peak funding, and the
 * cumulative must end at the project profit.
 */

function cashflowFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  return monthlyCashflow(i, s, fundingSummary(i, s));
}

describe('the base case monthly cashflow matches the workbook', () => {
  const cf = cashflowFor();

  it('has one row per programme month', () => {
    expect(cf.rows).toHaveLength(30);
  });

  it('reproduces the month 1 net movement and its phases', () => {
    const first = cf.rows[0];
    expect(first.acquisition).toBeCloseTo(-526312.5, 2);
    expect(first.finance).toBeCloseTo(-26043.22, 2);
    expect(first.netMovement).toBeCloseTo(-563434.07, 2); // Cashflow C24
  });

  it('ends the cumulative position at the project profit', () => {
    const last = cf.rows[cf.rows.length - 1];
    expect(last.cumulative).toBeCloseTo(614632.69, 2); // Cashflow AK25
  });

  it('reproduces the peak funding requirement', () => {
    expect(cf.peakFunding).toBeCloseTo(-3125973.71, 2); // Cashflow C27
  });

  it('the phase totals reconcile', () => {
    const sum = (key) => cf.rows.reduce((total, row) => total + row[key], 0);
    expect(sum('construction')).toBeCloseTo(-2062249, 2); // build plus statutory
    expect(sum('sales')).toBeCloseTo(3773000, 2); // the net development value
    expect(sum('finance')).toBeCloseTo(-264676.31, 2); // the finance cost
    expect(sum('netMovement')).toBeCloseTo(614632.69, 2); // the project profit
  });
});

describe('the cashflow tracks the calendar', () => {
  it('starts the net sale value at the completion month', () => {
    const cf = cashflowFor();
    const saleRow = cf.rows[baseCaseInputs().completionSaleMonth - 1];
    // The sale month carries the net development value in.
    expect(saleRow.sales).toBeGreaterThan(0);
    // Months before the sale carry no sales in the base case (pre-sales off).
    expect(cf.rows[0].sales).toBe(0);
  });
});

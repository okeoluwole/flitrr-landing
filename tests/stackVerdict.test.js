import { describe, it, expect } from 'vitest';
import { baseCaseInputs, deriveSwitches } from '../lib/stack/engine/inputs.js';
import { fundingSummary } from '../lib/stack/engine/seniorDebt.js';
import { distributionWaterfall } from '../lib/stack/engine/waterfall.js';
import { returnsAndMetrics } from '../lib/stack/engine/returns.js';
import { decisionBand, verdictSentence } from '../lib/stack/engine/verdict.js';

/**
 * Sub-step 1.7: the verdict (Summary A3, A19, A20, K29). The base case sentence
 * must match the workbook to the character, and every decision shade must fire
 * on the right margin.
 */

function readFor(overrides = {}) {
  const i = { ...baseCaseInputs(), ...overrides };
  const s = deriveSwitches(i);
  const f = fundingSummary(i, s);
  const w = distributionWaterfall(i, s, f);
  const r = returnsAndMetrics(i, s, f, w);
  return { inputs: i, funding: f, returns: r, band: decisionBand(i, r), sentence: verdictSentence(i, f, r) };
}

describe('decisionBand base case', () => {
  const { band } = readFor();
  it('is a CONSIDER, below target, 0.5 points under', () => {
    expect(band.decision).toBe('CONSIDER');
    expect(band.viability).toBe('Below target');
    expect(band.pointsVsTarget).toBeCloseTo(-0.5, 6);
    expect(band.aboveTarget).toBe(false);
  });
});

describe('the verdict sentence matches the workbook exactly', () => {
  it('reproduces the base case Summary A3 (NGN instance)', () => {
    const { sentence } = readFor({ reportingCurrency: 'NGN' });
    expect(sentence).toBe(
      'This scheme is funded by Joint venture and makes about ₦614,633 profit, a 19.5% profit on cost. ' +
        'That is 0.5 points below your 20.0% target. ' +
        'That is marginally under your target, broadly in line, so treat it as Consider. ' +
        'As a safety cushion, sale values could come in about 16.3% below plan before the profit disappears.',
    );
  });

  it('uses the reporting currency symbol (GBP by default)', () => {
    expect(readFor().sentence).toContain('£614,633');
  });
});

describe('the decision shades fire on the right margin', () => {
  it('a strong margin reads a confident GO', () => {
    const { band, sentence } = readFor({ targetProfitOnCost: 0.1 });
    expect(band.decision).toBe('GO');
    expect(band.viability).toBe('On or above target');
    expect(sentence).toContain('comfortably clears your hurdle');
  });

  it('a slim margin above target still reads GO', () => {
    const { band, sentence } = readFor({ targetProfitOnCost: 0.16 });
    expect(band.decision).toBe('GO');
    expect(sentence).toContain('clears your hurdle, so this is a Go');
  });

  it('a small shortfall reads a marginal CONSIDER', () => {
    const { band, sentence } = readFor();
    expect(band.decision).toBe('CONSIDER');
    expect(sentence).toContain('marginally under your target');
  });

  it('a larger shortfall reads a thin CONSIDER', () => {
    const { band, sentence } = readFor({ targetProfitOnCost: 0.23 });
    expect(band.decision).toBe('CONSIDER');
    expect(sentence).toContain('thinner than you would like');
  });

  it('well short of the hurdle reads NO GO', () => {
    const { band, sentence } = readFor({ targetProfitOnCost: 0.3 });
    expect(band.decision).toBe('NO GO');
    expect(sentence).toContain('well short of your hurdle');
  });

  it('a loss reads NO GO and drops the safety-cushion line', () => {
    const { band, sentence } = readFor({ gdv: 2000000 });
    expect(band.decision).toBe('NO GO');
    expect(sentence).toContain('the scheme loses money');
    expect(sentence).not.toContain('safety cushion');
  });

  it('a profit on cost that rounds to the target reads "in line"', () => {
    const { sentence } = readFor({ targetProfitOnCost: 0.195 });
    expect(sentence).toContain('in line with your 19.5% target');
  });
});

import { describe, it, expect } from 'vitest';
import {
  deriveSeverity,
  SEVERITY_RANK,
} from '../lib/engine/severity.js';

/**
 * Characterization net (A1) for the risk severity derivation, captured at its
 * current home in riskModel before Step A6 lifts deriveSeverity and
 * SEVERITY_RANK into lib/engine/severity. These assertions pin the present
 * behaviour so that move can be proven identical.
 */

describe('deriveSeverity across the likelihood-by-impact grid', () => {
  // Each cell is likelihood by impact (low, medium, high), the product banded
  // per the M6.1 spec: 1 to 2 Minor, 3 to 4 Worth watching, 6 to 9 Serious.
  const cases = [
    ['low', 'low', 'minor', 'Minor'],
    ['low', 'medium', 'minor', 'Minor'],
    ['low', 'high', 'moderate', 'Worth watching'],
    ['medium', 'low', 'minor', 'Minor'],
    ['medium', 'medium', 'moderate', 'Worth watching'],
    ['medium', 'high', 'serious', 'Serious'],
    ['high', 'low', 'moderate', 'Worth watching'],
    ['high', 'medium', 'serious', 'Serious'],
    ['high', 'high', 'serious', 'Serious'],
  ];

  for (const [likelihood, impact, key, label] of cases) {
    it(`${likelihood} likelihood and ${impact} impact is ${label}`, () => {
      expect(deriveSeverity(likelihood, impact)).toEqual({ key, label });
    });
  }
});

describe('deriveSeverity when a score is missing', () => {
  it('is unscored when likelihood or impact is absent or unknown', () => {
    const unscored = { key: 'unscored', label: 'Not yet scored' };
    expect(deriveSeverity(undefined, 'high')).toEqual(unscored);
    expect(deriveSeverity('high', null)).toEqual(unscored);
    expect(deriveSeverity('high', 'bogus')).toEqual(unscored);
    expect(deriveSeverity(undefined, undefined)).toEqual(unscored);
  });
});

describe('SEVERITY_RANK orders by urgency', () => {
  it('serious is most urgent and unscored least', () => {
    expect(SEVERITY_RANK).toEqual({
      serious: 0,
      moderate: 1,
      minor: 2,
      unscored: 3,
    });
  });
});

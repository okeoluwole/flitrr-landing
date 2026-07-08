/**
 * Display formatting for the STACK read-only views (client-safe). Money rounds
 * to whole units with thousands separators and the reporting currency symbol;
 * percentages and multiples read to a sensible precision; an undefined IRR reads
 * "n/a", matching the engine's null. Numbers carry the .tnum class at the call
 * site for tabular figures.
 */

import { resolveCurrencySymbol } from '../../lib/stack/engine/inputs.js';

// Empty-value glyph. Not an em or en dash (house rule); "n/a" is what the engine
// and the workbook use for an undefined figure.
const EMPTY = 'n/a';

export function money(value, currency) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  const symbol = resolveCurrencySymbol(currency);
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(rounded).toLocaleString('en-GB')}`;
}

export function percent(value, dp = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${(value * 100).toFixed(dp)}%`;
}

export function multiple(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toFixed(2)}x`;
}

export function irr(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return percent(value);
}

export function count(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
    return EMPTY;
  }
  return Math.round(Number(value)).toLocaleString('en-GB');
}

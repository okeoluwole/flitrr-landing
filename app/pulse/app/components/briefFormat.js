/**
 * Pure formatting helpers for the PULSE Brief (Step 8).
 *
 * No imports, no side effects: safe to use in assembly (briefModel),
 * the read ruleset (pulseRead), and the lens summaries (briefLens).
 *
 * Punctuation discipline (framework Section 0): no em dashes or en dashes
 * in any rendered output. Hyphenated compounds keep their hyphens.
 *
 * The brief never computes on these figures (no loan-to-value, no profit).
 * These helpers only present what the developer entered.
 */

// Currency symbol by code. Only GBP is captured today; the map leaves room
// for the framework's geography tailoring (for example NGN) without a code
// change here. Unknown codes fall back to the bare number.
const CURRENCY_SYMBOL = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  NGN: '₦',
};

// Round to one decimal and drop a trailing ".0", so 9.2 stays "9.2" and
// 10.0 becomes "10".
function trimOneDecimal(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * Parse a user-entered numeric string for display or storage. Strips
 * currency symbols, thousands separators and spaces, then parses. Returns a
 * finite number or null. Mirrors the wizard's cleanNumeric so the live
 * preview reflects exactly what would be saved.
 */
export function toNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const stripped = String(v).replace(/[^0-9.-]/g, '');
  if (stripped === '' || stripped === '-' || stripped === '.') return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compact currency for headline display: "£6.4m", "£640k", "£9.2m".
 * Returns null for a null/blank/unparseable value, so callers can omit the
 * figure entirely rather than print a placeholder (the brief never shows a
 * figure the developer has not entered).
 */
export function formatCurrency(value, currency = 'GBP') {
  const n = toNumber(value);
  if (n == null) return null;
  const symbol = CURRENCY_SYMBOL[currency] ?? '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  let body;
  if (abs >= 1e9) body = `${trimOneDecimal(abs / 1e9)}bn`;
  else if (abs >= 1e6) body = `${trimOneDecimal(abs / 1e6)}m`;
  else if (abs >= 1e3) body = `${trimOneDecimal(abs / 1e3)}k`;
  else body = String(Math.round(abs));

  return `${sign}${symbol}${body}`;
}

/**
 * Percentage display: 28 becomes "28%", 28.5 becomes "28.5%". Returns null
 * for a null/blank/unparseable value.
 */
export function formatPercent(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return `${trimOneDecimal(n)}%`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a stored DATE ('YYYY-MM-DD') as "Aug 2027". Parses the parts by
 * hand rather than via Date() to avoid a timezone shift moving the month.
 * Returns null for a missing or malformed value.
 */
export function formatMonthYear(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${MONTHS[month - 1]} ${m[1]}`;
}

/**
 * Join names into a readable list: [] -> "", [a] -> "a", [a,b] -> "a and b",
 * [a,b,c] -> "a, b and c". Used wherever an insight or summary names the
 * actual objectives involved.
 */
export function formatList(names) {
  const list = (names ?? []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

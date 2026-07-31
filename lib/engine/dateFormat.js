/**
 * The date layer (Note 10 date half, Note 16 date rendering, Note 8 full-precision
 * dates). The one place PULSE decides how a date is written and how a typed date
 * is read. Two jobs, deliberately in one module because they are two halves of
 * the same contract: what the developer types in, and what the app writes back.
 *
 * THE DISPLAY FORMAT IS APP-WIDE, NOT A GEOGRAPHY SETTING. Every date PULSE
 * renders reads "23 Jul 2026": day, three-letter month, four-digit year. That
 * form is unambiguous in every jurisdiction, which is the whole point. There is
 * exactly one display formatter (formatDisplayDate) and no second one anywhere.
 * A named month cannot be misread as a day, so a baseline reads the same to a
 * developer in Leeds and a developer in Lagos.
 *
 * THE INPUT FORMAT IS A GEOGRAPHY SETTING, resolved through
 * lib/engine/geography.js, because entry conventions genuinely differ by
 * jurisdiction even where display does not. Both currently configured
 * geographies use dd/mm/yyyy, so DATE_INPUT_FORMATS holds one member today; the
 * indirection exists so a future geography is a configuration entry rather than
 * a code change.
 *
 * WHY THIS MODULE EXISTS AT ALL, the bug it closes. Every date in PULSE was
 * entered through a native <input type="date">. A native date input renders in
 * the BROWSER's locale and cannot be forced to a format by any attribute, so the
 * same field reads dd/mm/yyyy to one developer and mm/dd/yyyy to another. In the
 * end-to-end test a start date entered as 11/02/2026, meaning 2 November, read
 * back as 11 February, and a funding milestone of 06/01/2027 needed asking about
 * before it could be trusted. That is the worst class of defect this product can
 * carry: unlike a wrong hint, a wrong date corrupts the baseline silently and
 * looks entirely fine. The fix is a controlled field that owns its own format
 * (components/DateField.js), parsing through parseDateInput here.
 *
 * STORED VALUES DO NOT CHANGE. The storage form is unchanged and remains the
 * ISO calendar day 'YYYY-MM-DD', exactly what a DATE column holds and what the
 * native input submitted. Only entry and display change. parseDateInput and
 * formatDateInput are exact inverses over valid dates, so a date entered as
 * 02/11/2026 stores '2026-11-02', the same value it stored before, and renders
 * as "2 Nov 2026".
 *
 * EVERYTHING IS UTC AND HAND-BUILT. Dates here are calendar days, not instants.
 * Formatting parses the parts by hand rather than calling toLocaleDateString, for
 * three reasons: a locale call is a locale-DEPENDENT answer to an app-wide
 * question, its output varies with the runtime's ICU build, and reading a
 * 'YYYY-MM-DD' through a local-time Date can shift the day backwards west of
 * Greenwich. Hand-parsing removes all three. Where a Date or an epoch is passed
 * (the engines derive dates as UTC instants) the UTC field accessors are used, so
 * the displayed day matches the engine's own calendar day for every viewer.
 *
 * Pure. No DB, no React, no network, no system clock. Null in, null out
 * throughout, so a caller can render "not dated" rather than a placeholder date.
 */

// The three-letter month names the display format uses. English abbreviations
// are the form the Brief, the gate screen and the Programme surfaces have always
// rendered; keeping them fixed is what makes the format app-wide rather than
// locale-dependent.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The date entry formats a geography can specify. One member today: both
 * configured geographies (United Kingdom and Nigeria) enter dates day first.
 * The vocabulary is frozen so a caller cannot invent a format the parser does
 * not implement.
 */
export const DATE_INPUT_FORMATS = Object.freeze({
  DMY_SLASH: 'dd/mm/yyyy',
});

// The format used when a caller supplies none. Day-first, matching both
// configured geographies. Never inferred from the runtime locale: an unset
// format resolves to a stated default, not to whatever machine is rendering.
const DEFAULT_INPUT_FORMAT = DATE_INPUT_FORMATS.DMY_SLASH;

// A stored calendar day: exactly four-digit year, two-digit month, two-digit day.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A typed calendar day: one or two digit day, one or two digit month, four digit
// year, separated by a slash, dot or hyphen. Four year digits are required: a
// two-digit year is ambiguous about its century, and guessing one would be the
// same class of silent error this module exists to close.
const TYPED_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

// Days in each month, February resolved by the Gregorian leap rule. Used to
// reject a date that parses arithmetically but does not exist in the calendar,
// so 31/02/2026 is refused rather than rolled forward into March.
function daysInMonth(year, month) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// Is this a real calendar day? Guards every parse, in both directions.
function isRealDate(year, month, day) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= daysInMonth(year, month);
}

// Left-pad a number to two digits, for the ISO and typed forms.
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Read any of the accepted date carriers as { year, month, day } UTC calendar
 * parts, or null.
 *
 * A 'YYYY-MM-DD' string is read by hand, never through Date(), so no timezone
 * can move the day. A Date or an epoch number is read through its UTC field
 * accessors, because the engines derive their dates as UTC instants. A longer
 * ISO timestamp ('2026-07-23T00:00:00Z', the shape a database TIMESTAMPTZ comes
 * back as) is handed to Date and then read in UTC.
 *
 * Exported because the display formatter and the input formatter both need the
 * same reading, and a second copy of it is a second chance to disagree.
 */
export function dateParts(value) {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const iso = ISO_DATE.exec(trimmed);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      return isRealDate(year, month, day) ? { year, month, day } : null;
    }
    const epoch = Date.parse(trimmed);
    if (Number.isNaN(epoch)) return null;
    return dateParts(new Date(epoch));
  }

  const d =
    value instanceof Date
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? new Date(value)
        : null;
  if (d == null || Number.isNaN(d.getTime())) return null;

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * THE display format: "23 Jul 2026". The single formatter every date in PULSE
 * renders through, on every surface, in every module. Day is never zero-padded
 * ("2 Nov 2026", not "02 Nov 2026") and the month is always named, so the value
 * cannot be misread in any jurisdiction.
 *
 * Accepts a stored 'YYYY-MM-DD', a Date, epoch milliseconds, or a full ISO
 * timestamp. Returns null for anything missing or malformed, so a caller renders
 * its own "not dated" wording rather than a fabricated date.
 */
export function formatDisplayDate(value) {
  const parts = dateParts(value);
  if (parts == null) return null;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/**
 * The stored form of any accepted date carrier: 'YYYY-MM-DD', the UTC calendar
 * day. This is what a DATE column holds and what the wizard saves, unchanged
 * from what the native input submitted. Returns null for a missing or malformed
 * value.
 */
export function toIsoDate(value) {
  const parts = dateParts(value);
  if (parts == null) return null;
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * Parse what the developer typed into the stored 'YYYY-MM-DD', reading it in the
 * geography's entry format. This is the half of the module that closes the
 * misread: '02/11/2026' in dd/mm/yyyy is 2 November 2026 and stores
 * '2026-11-02', with no dependence on the browser's locale.
 *
 * Strict on purpose. It accepts a slash, dot or hyphen separator and a one or
 * two digit day and month, because those are ordinary typing, but it refuses a
 * two-digit year, an out-of-range month, and a day that does not exist in that
 * month, returning null so the field can say so rather than store a date the
 * developer did not mean. Blank returns null, which is a cleared date, not an
 * error.
 *
 * `format` is the geography's dateInputFormat. An unrecognised format falls back
 * to the day-first default rather than throwing, since a rendered form that
 * refuses every date is worse than one that reads it the way both configured
 * geographies do.
 */
export function parseDateInput(text, format = DEFAULT_INPUT_FORMAT) {
  if (text == null) return null;
  const trimmed = String(text).trim();
  if (trimmed === '') return null;

  const m = TYPED_DATE.exec(trimmed);
  if (!m) return null;

  // One format today, and the fallback for an unrecognised one: day first.
  // A second entry order becomes another branch here, next to this one.
  void format;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (!isRealDate(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Write a stored 'YYYY-MM-DD' back out in the geography's entry format, zero
 * padded: '2026-11-02' becomes '02/11/2026'. The exact inverse of
 * parseDateInput over every real calendar day, which is what makes the round
 * trip lossless: what the field shows re-parses to the value that is stored.
 * Returns an empty string for a missing or malformed value, because this feeds a
 * controlled input's `value` and a controlled input may never be handed null.
 */
export function formatDateInput(value, format = DEFAULT_INPUT_FORMAT) {
  const parts = dateParts(value);
  if (parts == null) return '';
  void format;
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/**
 * The placeholder and the accessible hint for a date field in this format, so
 * the field never has to hardcode "dd/mm/yyyy" itself. The format string IS the
 * placeholder, which keeps the two from drifting apart.
 */
export function dateInputPlaceholder(format = DEFAULT_INPUT_FORMAT) {
  return DATE_INPUT_FORMATS.DMY_SLASH === format ? format : DEFAULT_INPUT_FORMAT;
}

/**
 * Compare two dates as calendar days, for the bounds a date field enforces (a
 * milestone must fall inside its stage window). Returns a negative number when
 * `a` falls before `b`, zero when they are the same day, a positive number when
 * after, and null when either is missing or malformed, so a caller can skip a
 * bound it cannot evaluate rather than guess at one.
 */
export function compareDates(a, b) {
  const pa = dateParts(a);
  const pb = dateParts(b);
  if (pa == null || pb == null) return null;
  if (pa.year !== pb.year) return pa.year - pb.year;
  if (pa.month !== pb.month) return pa.month - pb.month;
  return pa.day - pb.day;
}

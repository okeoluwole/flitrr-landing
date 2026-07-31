import { describe, it, expect } from 'vitest';
import {
  DATE_INPUT_FORMATS,
  compareDates,
  dateInputPlaceholder,
  dateParts,
  formatDateInput,
  formatDisplayDate,
  parseDateInput,
  toIsoDate,
} from '../lib/engine/dateFormat.js';

/**
 * The date layer (Note 10 date half, Note 16 date rendering, Note 8 full
 * precision). Two contracts are under test, and the second is the one the
 * end-to-end test broke on:
 *
 *   1. ONE display format, "23 Jul 2026", for every date PULSE renders.
 *   2. dd/mm/yyyy entry that reads 02/11/2026 as 2 November and round-trips to
 *      the same stored value, with no dependence on the browser's locale.
 */

describe('formatDisplayDate: the one display format', () => {
  it('renders the "23 Jul 2026" style', () => {
    expect(formatDisplayDate('2026-07-23')).toBe('23 Jul 2026');
  });

  it('does not zero-pad a single-digit day', () => {
    expect(formatDisplayDate('2026-11-02')).toBe('2 Nov 2026');
    expect(formatDisplayDate('2027-01-06')).toBe('6 Jan 2027');
    expect(formatDisplayDate('2026-03-09')).toBe('9 Mar 2026');
  });

  it('names every month, so a day can never be read as a month', () => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    months.forEach((name, i) => {
      const mm = String(i + 1).padStart(2, '0');
      expect(formatDisplayDate(`2026-${mm}-15`)).toBe(`15 ${name} 2026`);
    });
  });

  it('holds the day across both year boundaries', () => {
    expect(formatDisplayDate('2025-12-31')).toBe('31 Dec 2025');
    expect(formatDisplayDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDisplayDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatDisplayDate('2027-01-01')).toBe('1 Jan 2027');
  });

  it('renders a leap day', () => {
    expect(formatDisplayDate('2028-02-29')).toBe('29 Feb 2028');
  });

  it('reads a Date and epoch milliseconds in UTC, matching the engines', () => {
    const utcMidnight = new Date(Date.UTC(2026, 6, 23));
    expect(formatDisplayDate(utcMidnight)).toBe('23 Jul 2026');
    expect(formatDisplayDate(utcMidnight.getTime())).toBe('23 Jul 2026');
  });

  it('reads a full ISO timestamp, the shape a database column returns', () => {
    expect(formatDisplayDate('2026-07-23T00:00:00Z')).toBe('23 Jul 2026');
    expect(formatDisplayDate('2026-07-23T23:59:00Z')).toBe('23 Jul 2026');
  });

  it('returns null for anything missing or malformed, never a placeholder date', () => {
    expect(formatDisplayDate(null)).toBeNull();
    expect(formatDisplayDate(undefined)).toBeNull();
    expect(formatDisplayDate('')).toBeNull();
    expect(formatDisplayDate('   ')).toBeNull();
    expect(formatDisplayDate('not a date')).toBeNull();
    expect(formatDisplayDate('2026-13-01')).toBeNull();
    expect(formatDisplayDate('2026-02-31')).toBeNull();
    expect(formatDisplayDate(new Date('nonsense'))).toBeNull();
    expect(formatDisplayDate(Number.NaN)).toBeNull();
  });

  it('does not vary with the runtime locale', () => {
    // The value is hand-built from a fixed month table, never via
    // toLocaleDateString, so no ICU build or viewer locale can change it.
    expect(formatDisplayDate('2026-11-02')).toBe('2 Nov 2026');
    expect(formatDisplayDate('2026-11-02')).toBe(
      formatDisplayDate(new Date(Date.UTC(2026, 10, 2)))
    );
  });
});

describe('parseDateInput: dd/mm/yyyy entry, the misread that broke the test', () => {
  it('reads 02/11/2026 as 2 November, not 11 February', () => {
    expect(parseDateInput('02/11/2026')).toBe('2026-11-02');
    expect(formatDisplayDate(parseDateInput('02/11/2026'))).toBe('2 Nov 2026');
  });

  it('reads the two dates the end-to-end test misread', () => {
    // Step 1 start date entered as 11/02/2026, meaning 2 November 2026.
    expect(parseDateInput('11/02/2026')).toBe('2026-02-11');
    expect(formatDisplayDate('2026-02-11')).toBe('11 Feb 2026');
    // The developer meant 2 November, which is entered day first as 02/11/2026.
    expect(formatDisplayDate(parseDateInput('02/11/2026'))).toBe('2 Nov 2026');

    // The funding milestone that needed disambiguating as 1 June 2027.
    expect(parseDateInput('01/06/2027')).toBe('2027-06-01');
    expect(formatDisplayDate(parseDateInput('01/06/2027'))).toBe('1 Jun 2027');
  });

  it('accepts an unpadded day and month', () => {
    expect(parseDateInput('2/11/2026')).toBe('2026-11-02');
    expect(parseDateInput('2/1/2026')).toBe('2026-01-02');
    expect(parseDateInput('23/7/2026')).toBe('2026-07-23');
  });

  it('accepts a dot or hyphen separator as ordinary typing', () => {
    expect(parseDateInput('02.11.2026')).toBe('2026-11-02');
    expect(parseDateInput('02-11-2026')).toBe('2026-11-02');
  });

  it('trims surrounding whitespace', () => {
    expect(parseDateInput('  02/11/2026  ')).toBe('2026-11-02');
  });

  it('treats blank as a cleared date, not an error', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('   ')).toBeNull();
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
  });

  it('refuses a two-digit year rather than guessing a century', () => {
    expect(parseDateInput('02/11/26')).toBeNull();
  });

  it('refuses a day that does not exist in that month', () => {
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('31/04/2026')).toBeNull();
    expect(parseDateInput('29/02/2026')).toBeNull();
    expect(parseDateInput('29/02/2028')).toBe('2028-02-29');
  });

  it('refuses an out-of-range month or day', () => {
    expect(parseDateInput('01/13/2026')).toBeNull();
    expect(parseDateInput('00/11/2026')).toBeNull();
    expect(parseDateInput('01/00/2026')).toBeNull();
    expect(parseDateInput('32/01/2026')).toBeNull();
  });

  it('refuses anything that is not a date', () => {
    expect(parseDateInput('November 2nd')).toBeNull();
    expect(parseDateInput('2026-11-02')).toBeNull();
    expect(parseDateInput('02/11')).toBeNull();
    expect(parseDateInput('02/11/2026/01')).toBeNull();
  });

  it('falls back to the day-first default for an unrecognised format', () => {
    expect(parseDateInput('02/11/2026', 'mm/dd/yyyy')).toBe('2026-11-02');
    expect(parseDateInput('02/11/2026', undefined)).toBe('2026-11-02');
  });
});

describe('the round trip is lossless: stored values do not change', () => {
  it('02/11/2026 stores the same value it stores today and renders as 2 Nov 2026', () => {
    // What a native <input type="date"> submitted for 2 November 2026, and what
    // the DATE column holds, is 'YYYY-MM-DD'. That is unchanged.
    const stored = parseDateInput('02/11/2026');
    expect(stored).toBe('2026-11-02');
    expect(formatDateInput(stored)).toBe('02/11/2026');
    expect(formatDisplayDate(stored)).toBe('2 Nov 2026');
    expect(parseDateInput(formatDateInput(stored))).toBe(stored);
  });

  it('parse and format are exact inverses across a full year of days', () => {
    for (let month = 1; month <= 12; month += 1) {
      const last = new Date(Date.UTC(2026, month, 0)).getUTCDate();
      for (let day = 1; day <= last; day += 1) {
        const stored = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const typed = formatDateInput(stored);
        expect(parseDateInput(typed)).toBe(stored);
      }
    }
  });

  it('survives a leap year and both year boundaries', () => {
    ['2028-02-29', '2025-12-31', '2026-01-01', '2027-12-31'].forEach((stored) => {
      expect(parseDateInput(formatDateInput(stored))).toBe(stored);
    });
  });
});

describe('formatDateInput: what a controlled field shows', () => {
  it('zero-pads the day and month', () => {
    expect(formatDateInput('2026-11-02')).toBe('02/11/2026');
    expect(formatDateInput('2026-01-06')).toBe('06/01/2026');
    expect(formatDateInput('2026-07-23')).toBe('23/07/2026');
  });

  it('returns an empty string, never null, so a controlled input stays controlled', () => {
    expect(formatDateInput(null)).toBe('');
    expect(formatDateInput(undefined)).toBe('');
    expect(formatDateInput('')).toBe('');
    expect(formatDateInput('rubbish')).toBe('');
  });

  it('reads a Date in UTC, matching what the engines derive', () => {
    expect(formatDateInput(new Date(Date.UTC(2026, 10, 2)))).toBe('02/11/2026');
  });
});

describe('toIsoDate: the storage form', () => {
  it('passes a stored day through unchanged', () => {
    expect(toIsoDate('2026-11-02')).toBe('2026-11-02');
  });

  it('reduces a Date, an epoch and a timestamp to the UTC calendar day', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 10, 2)))).toBe('2026-11-02');
    expect(toIsoDate(Date.UTC(2026, 10, 2))).toBe('2026-11-02');
    expect(toIsoDate('2026-11-02T18:30:00Z')).toBe('2026-11-02');
  });

  it('returns null for a missing or malformed value', () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('2026-02-31')).toBeNull();
  });
});

describe('dateParts, dateInputPlaceholder and compareDates', () => {
  it('reads the calendar parts of a stored day without a timezone shift', () => {
    expect(dateParts('2026-11-02')).toEqual({ year: 2026, month: 11, day: 2 });
  });

  it('offers the format string itself as the placeholder', () => {
    expect(dateInputPlaceholder(DATE_INPUT_FORMATS.DMY_SLASH)).toBe('dd/mm/yyyy');
    expect(dateInputPlaceholder()).toBe('dd/mm/yyyy');
    expect(dateInputPlaceholder('mm/dd/yyyy')).toBe('dd/mm/yyyy');
  });

  it('orders two calendar days, for the bounds a date field enforces', () => {
    expect(compareDates('2026-11-02', '2026-11-03')).toBeLessThan(0);
    expect(compareDates('2026-11-03', '2026-11-02')).toBeGreaterThan(0);
    expect(compareDates('2026-11-02', '2026-11-02')).toBe(0);
    expect(compareDates('2025-12-31', '2026-01-01')).toBeLessThan(0);
    expect(compareDates('2026-01-31', '2026-02-01')).toBeLessThan(0);
  });

  it('returns null when either side cannot be evaluated', () => {
    expect(compareDates(null, '2026-11-02')).toBeNull();
    expect(compareDates('2026-11-02', 'rubbish')).toBeNull();
  });
});

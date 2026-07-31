'use client';

import { useEffect, useRef, useState } from 'react';
import {
  compareDates,
  dateInputPlaceholder,
  formatDateInput,
  formatDisplayDate,
  parseDateInput,
} from '../../../../lib/engine/dateFormat.js';
import { DATE_INPUT_FORMATS } from '../../../../lib/engine/dateFormat.js';
import styles from './DateField.module.css';

/**
 * The controlled date field (Note 10 date half). Every date the developer enters
 * in PULSE is typed here.
 *
 * WHY THIS IS NOT A NATIVE DATE INPUT. It replaces <input type="date">, and it
 * has to, because the problem is not fixable on the native control. A native
 * date input renders in the BROWSER's own locale, and no attribute can force it
 * to a format: there is no `format` prop, `lang` does not bind it, and the value
 * it submits is ISO regardless of what it shows. So the same field reads
 * dd/mm/yyyy to one developer and mm/dd/yyyy to another. In the end-to-end test
 * a start date entered as 11/02/2026, meaning 2 November, read back as 11
 * February, and a funding milestone of 06/01/2027 had to be asked about before
 * it could be trusted. A wrong date corrupts the baseline silently and looks
 * entirely fine, which makes it the sharpest edge in the whole geography note.
 * A controlled text field that owns its own format is the only fix.
 *
 * THE CONTRACT IS THE NATIVE ONE, deliberately. `value` is the stored calendar
 * day 'YYYY-MM-DD' (or an empty string), and `onChange` is called with exactly
 * that, the same string a native input handed to `e.target.value`. Every call
 * site keeps its existing handler and its existing save path, and the stored
 * value is unchanged from what the native input submitted. Only entry and
 * display change.
 *
 * HOW IT BEHAVES WHILE TYPING. The field holds its own text so a half-typed
 * "02/1" survives the keystroke that follows it. A parse commits upward; a blank
 * commits an empty string, which is a cleared date; text that does not yet parse
 * commits nothing and leaves the last good value standing, so a slip mid-edit
 * cannot wipe a saved date. On blur the text is rewritten to the canonical
 * padded form, and text that still does not parse is kept in place and named as
 * unreadable rather than silently discarded. Under it the field echoes the date
 * it read back in the app's one display format ("2 Nov 2026"), so the developer
 * sees what was understood while they are still looking at the field.
 *
 * The entry format comes from the project's geography (lib/engine/geography.js),
 * not from the browser. Both configured geographies enter dates day first today,
 * so the format is the same for all of them; it is passed in rather than assumed
 * so a future geography is a configuration entry.
 *
 * `min` and `max` are stored calendar days, the bounds a stage window or a
 * no-future rule implies. They are advisory here exactly as they were on the
 * native control, which set validity without blocking the value: the field names
 * the breach and still reports the date upward, so a developer is never left
 * unable to record what actually happened.
 */
export default function DateField({
  id,
  value,
  onChange,
  format = DATE_INPUT_FORMATS.DMY_SLASH,
  min,
  max,
  minLabel,
  maxLabel,
  disabled = false,
  className = '',
  describedBy,
  ...rest
}) {
  const placeholder = dateInputPlaceholder(format);
  const stored = value ?? '';

  // The text the developer sees, held locally so a partial entry survives the
  // next keystroke. Seeded from the stored value in the canonical padded form.
  const [text, setText] = useState(() => formatDateInput(stored, format));
  // The stored value this text was last synced from, so a change made anywhere
  // else (a save round trip, an advised date accepted by a button) reaches the
  // field, while the developer's own in-progress typing is left alone.
  const syncedFrom = useRef(stored);

  useEffect(() => {
    if (syncedFrom.current !== stored) {
      syncedFrom.current = stored;
      setText(formatDateInput(stored, format));
    }
  }, [stored, format]);

  const parsed = parseDateInput(text, format);
  const trimmed = text.trim();
  const unreadable = trimmed !== '' && parsed == null;

  // A bound is only evaluated when both sides are real dates, so an unset bound
  // or an unreadable entry raises nothing.
  const belowMin = parsed != null && min ? compareDates(parsed, min) < 0 : false;
  const aboveMax = parsed != null && max ? compareDates(parsed, max) > 0 : false;
  const outOfBounds = belowMin || aboveMax;

  const messageId = id ? `${id}-datemsg` : undefined;
  const describe = [describedBy, messageId].filter(Boolean).join(' ') || undefined;

  function handleChange(event) {
    const next = event.target.value;
    setText(next);
    const iso = parseDateInput(next, format);
    if (iso != null) {
      syncedFrom.current = iso;
      onChange(iso);
    } else if (next.trim() === '') {
      syncedFrom.current = '';
      onChange('');
    }
    // Anything else is mid-edit or unreadable: hold the last good value rather
    // than clearing a date the developer has not asked to clear.
  }

  function handleBlur() {
    // Canonicalise a readable entry to the padded form, so what the field shows
    // is exactly what re-parses to what is stored.
    if (parsed != null) setText(formatDateInput(parsed, format));
  }

  return (
    <span className={styles.wrap}>
      <input
        {...rest}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`${className} ${styles.input} ${
          unreadable || outOfBounds ? styles.inputFlagged : ''
        }`}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={unreadable ? true : undefined}
        aria-describedby={describe}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <span className={styles.msg} id={messageId} aria-live="polite">
        {unreadable && (
          <span className={styles.msgBad}>
            Enter the date as {placeholder}.
          </span>
        )}
        {!unreadable && belowMin && (
          <span className={styles.msgWarn}>
            {minLabel ?? `This falls before ${formatDisplayDate(min)}.`}
          </span>
        )}
        {!unreadable && !belowMin && aboveMax && (
          <span className={styles.msgWarn}>
            {maxLabel ?? `This falls after ${formatDisplayDate(max)}.`}
          </span>
        )}
        {!unreadable && !outOfBounds && parsed != null && (
          <span className={styles.msgRead}>{formatDisplayDate(parsed)}</span>
        )}
      </span>
    </span>
  );
}

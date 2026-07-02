'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './ViewOnlyBadge.module.css';

/**
 * ViewOnlyBadge - the single expression of a member's read-only state.
 *
 * One neutral, muted badge reading "View only" that sits in every project
 * surface's header when the current user is a member (canEdit is false). Read
 * only is a normal state, not an error, so this uses quiet Instrument surface
 * tokens, never a warning colour.
 *
 * The badge is a disclosure: tapping or clicking it opens a short line naming
 * who to contact to make a change (the organisation admin, by name). It is
 * click driven, never hover only, so it works on touch. Click-outside and
 * Escape close it, mirroring the DashboardShell menu.
 *
 * This is presentation. The database already denies a member's writes (the
 * Step 2 tenant rule); the badge only makes what a member sees match what they
 * are allowed to do.
 *
 * Props:
 *   adminContact  the finished contact line to reveal (from resolveProjectAccess).
 *                 A generic line is shown if it is missing.
 */
const FALLBACK_CONTACT = 'Contact your organisation admin to request changes.';

export default function ViewOnlyBadge({ adminContact }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const line = adminContact || FALLBACK_CONTACT;

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.badge}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={styles.eye}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="1.9" fill="currentColor" />
        </svg>
        View only
        <svg
          className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
          width="10"
          height="10"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <span id={panelId} role="note" className={styles.panel}>
          {line}
        </span>
      )}
    </span>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { removeScheme } from './actions';
import styles from './stack.module.css';

/**
 * SchemeRegister, the organisation's saved schemes on STACK's home: one
 * seated panel of hairline-divided rows, the same register idiom as PULSE's
 * project list. Each scheme opens the appraisal loaded; an admin can delete
 * one, two-step in place (the first press arms the button, the second
 * deletes, anything else disarms). A member sees the rows and Open only;
 * the database refuses their writes regardless.
 */

function formatSavedDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SchemeRegister({ schemes, canEdit = false }) {
  const [items, setItems] = useState(schemes);
  const [confirmingId, setConfirmingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleDeleteClick(id) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    setError(null);
    setBusy(true);
    const response = await removeScheme(id);
    setBusy(false);
    if (response.ok) {
      setItems(response.schemes);
    } else {
      setError(response.error);
    }
  }

  if (items.length === 0) {
    return <p className={styles.schemesEmpty}>No saved schemes yet.</p>;
  }

  return (
    <section className={`${styles.card} ${styles.schemes}`} aria-label="Saved schemes">
      <ul className={styles.schemeList}>
        {items.map((scheme) => (
          <li key={scheme.id} className={styles.schemeRow}>
            <div className={styles.schemeInfo}>
              <span className={styles.schemeName}>{scheme.name}</span>
              <span className={styles.schemeMeta}>
                Saved {formatSavedDate(scheme.updatedAt)}
                {scheme.projectName ? `, linked to ${scheme.projectName}` : ''}
              </span>
            </div>
            <div className={styles.schemeActions}>
              <Link
                href={`/stack/app/appraisal?scheme=${scheme.id}`}
                className={styles.miniBtn}
                onClick={() => setConfirmingId(null)}
              >
                Open
              </Link>
              {canEdit && (
                <button
                  type="button"
                  className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                  onClick={() => handleDeleteClick(scheme.id)}
                  disabled={busy}
                >
                  {confirmingId === scheme.id ? 'Confirm' : 'Delete'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

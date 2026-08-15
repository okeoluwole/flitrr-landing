'use client';

import { useEffect, useState } from 'react';
import ViewOnlyBadge from '../pulse/app/components/ViewOnlyBadge';
import styles from './stack.module.css';

/**
 * Saved schemes (Bucket 3.2): the save and load surface above the form. An
 * organisation's schemes, newest first, each loadable back into the form; an
 * admin can save the current inputs as a new scheme, save over the loaded one,
 * or delete one. A member sees the list and can load, with the platform's
 * View only badge naming who to contact; the database denies their writes
 * regardless.
 *
 * Deleting is two-step in place: the first press arms the button (it reads
 * Confirm), the second deletes. Anything else disarms it.
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

export default function StackSchemes({
  schemes,
  activeScheme,
  canEdit,
  adminContact,
  busy,
  notice,
  error,
  engineNote,
  onSave,
  onLoad,
  onDelete,
}) {
  const [name, setName] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  // A freshly loaded scheme prefills the name, so Save changes reads true and a
  // rename is one edit away.
  useEffect(() => {
    if (activeScheme) setName(activeScheme.name);
  }, [activeScheme?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDeleteClick(id) {
    if (confirmingId === id) {
      setConfirmingId(null);
      onDelete(id);
    } else {
      setConfirmingId(id);
    }
  }

  const hasSchemes = schemes.length > 0;

  return (
    <section className={`${styles.card} ${styles.schemes}`} aria-label="Saved schemes">
      <div className={styles.schemesHead}>
        <h2 className={styles.cardTitle}>Saved schemes</h2>
        {!canEdit && <ViewOnlyBadge adminContact={adminContact} />}
      </div>

      {canEdit && (
        <div className={styles.saveRow}>
          <input
            type="text"
            className={`${styles.input} ${styles.nameInput}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scheme name"
            aria-label="Scheme name"
            maxLength={120}
            disabled={busy}
          />
          {activeScheme ? (
            <>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => onSave(name, 'over')}
                disabled={busy}
              >
                Save changes
              </button>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => onSave(name, 'new')}
                disabled={busy}
              >
                Save as new
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onSave(name, 'new')}
              disabled={busy}
            >
              Save scheme
            </button>
          )}
        </div>
      )}

      {hasSchemes ? (
        <ul className={styles.schemeList}>
          {schemes.map((scheme) => (
            <li key={scheme.id} className={styles.schemeRow}>
              <div className={styles.schemeInfo}>
                <span className={styles.schemeName}>
                  {scheme.name}
                  {activeScheme?.id === scheme.id && (
                    <span className={styles.schemeLoaded}> (loaded)</span>
                  )}
                </span>
                <span className={styles.schemeMeta}>
                  Saved {formatSavedDate(scheme.updatedAt)}
                </span>
              </div>
              <div className={styles.schemeActions}>
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => {
                    setConfirmingId(null);
                    onLoad(scheme.id);
                  }}
                  disabled={busy}
                >
                  Load
                </button>
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
      ) : (
        <p className={styles.schemesEmpty}>
          {canEdit
            ? 'No saved schemes yet. Save one to load it back later.'
            : 'No saved schemes yet.'}
        </p>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
      {engineNote && <p className={styles.notice}>{engineNote}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

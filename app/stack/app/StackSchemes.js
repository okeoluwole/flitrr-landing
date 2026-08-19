'use client';

import { useEffect, useState } from 'react';
import ViewOnlyBadge from '../../pulse/app/components/ViewOnlyBadge';
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
  projects = [],
  busy,
  notice,
  error,
  engineNote,
  onSave,
  onLoad,
  onDelete,
}) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  // A freshly loaded scheme prefills the name and the project link, so Save
  // changes reads true and a rename or a relink is one edit away.
  useEffect(() => {
    if (activeScheme) {
      setName(activeScheme.name);
      setProjectId(activeScheme.projectId ?? '');
    }
  }, [activeScheme?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The picker offers the organisation's active projects. A loaded scheme may
  // be linked to a project the list no longer carries (archived since), so
  // that one is appended from the scheme's own summary rather than lost.
  const projectOptions = [...projects];
  if (
    projectId &&
    activeScheme?.projectId === projectId &&
    !projectOptions.some((p) => p.id === projectId)
  ) {
    projectOptions.push({
      id: projectId,
      name: activeScheme.projectName ?? 'Linked project',
    });
  }

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
          <select
            className={`${styles.select} ${styles.projectSelect}`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Linked project"
            disabled={busy}
          >
            <option value="">No linked project</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {activeScheme ? (
            <>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => onSave(name, 'over', projectId)}
                disabled={busy}
              >
                Save changes
              </button>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => onSave(name, 'new', projectId)}
                disabled={busy}
              >
                Save as new
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onSave(name, 'new', projectId)}
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
                  {scheme.projectName ? `, linked to ${scheme.projectName}` : ''}
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

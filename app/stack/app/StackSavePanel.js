'use client';

import { useEffect, useState } from 'react';
import styles from './stack.module.css';

/**
 * StackSavePanel, the admin's save surface above the appraisal form (the
 * scheme REGISTER lives on STACK's home; this panel only writes to it).
 * Name the scheme, optionally link the project it appraises (039), and save
 * it new or over the loaded one. The page renders this for admins only, and
 * row level security refuses anyone else's write regardless.
 */
export default function StackSavePanel({
  activeScheme,
  projects = [],
  busy,
  notice,
  onSave,
}) {
  const [name, setName] = useState(activeScheme?.name ?? '');
  const [projectId, setProjectId] = useState(activeScheme?.projectId ?? '');

  // A freshly saved-as-new scheme becomes the active one, so the panel
  // follows it: Save changes reads true and a rename or relink is one edit
  // away.
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

  return (
    <section className={`${styles.card} ${styles.schemes}`} aria-label="Save this scheme">
      <h2 className={styles.cardTitle}>
        {activeScheme ? `Scheme: ${activeScheme.name}` : 'Save this scheme'}
      </h2>

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

      {notice && <p className={styles.notice}>{notice}</p>}
    </section>
  );
}

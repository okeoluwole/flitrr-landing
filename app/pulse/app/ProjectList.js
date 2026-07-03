'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import styles from './page.module.css';

/**
 * ProjectList, the organisation's projects with a two-step delete for
 * drafts. The server page fetches the rows and hands them here; this owns the
 * delete interaction (a draft can be removed before it is committed). A locked,
 * active project has a baseline and is not deletable from here.
 *
 * Delete is two-step: the draft's delete control flips the row into a confirm
 * prompt, and only the explicit Delete draft action removes it. The row is
 * dropped from the list on success; RLS scopes the delete to an organisation
 * admin and the project's child rows cascade with it. A member never sees the
 * control (canEdit) and the database would refuse the delete anyway.
 */

const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
};

const DELETE_ERROR =
  'We could not delete this draft. Please check your connection and try again.';

// The updated_at timestamp shown at day granularity. Pinned to UTC so the
// displayed day reads the same for every viewer and the server-rendered HTML
// matches the client.
function formatUpdated(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function StatusPill({ status }) {
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  const variant =
    status === 'active'
      ? styles.pillActive
      : status === 'draft'
        ? styles.pillDraft
        : styles.pillMuted;
  return <span className={`${styles.pill} ${variant}`}>{label}</span>;
}

export default function ProjectList({ projects, canEdit = true }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const remove = async (id) => {
    setDeletingId(id);
    setError(null);
    const { error: delErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (delErr) {
      setDeletingId(null);
      setError(DELETE_ERROR);
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
    setConfirmingId(null);
    router.refresh();
  };

  return (
    <>
      <ul className={styles.list}>
        {items.map((p) => {
          const stageName =
            STAGE_NAMES[p.current_stage] ?? `Stage ${p.current_stage}`;
          const updated = formatUpdated(p.updated_at);
          const isDraft = p.status === 'draft';
          const deleting = deletingId === p.id;

          if (confirmingId === p.id) {
            return (
              <li key={p.id} className={styles.listItem}>
                <div
                  className={styles.confirm}
                  role="alertdialog"
                  aria-label={`Delete ${p.name}`}
                >
                  <div className={styles.confirmText}>
                    <span className={styles.confirmTitle}>
                      Delete this draft?
                    </span>
                    <span className={styles.confirmNote}>
                      {p.name} and everything set up in it will be removed
                      permanently. This cannot be undone.
                    </span>
                  </div>
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => setConfirmingId(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => remove(p.id)}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting…' : 'Delete draft'}
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={p.id} className={styles.listItem}>
              <Link
                href={`/pulse/app/workspace?project=${p.id}`}
                className={styles.cardLink}
              >
                <div className={styles.cardMain}>
                  <h2 className={styles.cardName}>{p.name}</h2>
                  <p className={styles.cardMeta}>
                    Stage {p.current_stage}: {stageName}
                    {updated ? ` · Updated ${updated}` : ''}
                  </p>
                </div>
                <div className={styles.cardRight}>
                  <StatusPill status={p.status} />
                  <svg
                    className={styles.cardChevron}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </Link>
              {canEdit && isDraft && (
                <button
                  type="button"
                  className={styles.cardDelete}
                  onClick={() => setConfirmingId(p.id)}
                  aria-label={`Delete draft ${p.name}`}
                  title="Delete draft"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 4h11M6 4V2.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8V4M5 4l.5 9c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9L11 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className={styles.deleteError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

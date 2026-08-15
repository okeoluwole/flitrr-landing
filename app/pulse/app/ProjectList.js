'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import styles from './page.module.css';
import { formatDisplayDate } from '../../../lib/engine/dateFormat.js';
import {
  splitProjects,
  projectAction,
  isLockedRecordError,
} from './projectListModel';

/**
 * ProjectList, the organisation's projects in two registers: the working list
 * and the archived shelf. The server page fetches every row and hands them
 * here; the split and the per-row removal action come from projectListModel,
 * the same rule the 037 delete guard enforces at the write path.
 *
 * A draft (never locked) can be deleted, two-step, and the cascade removes
 * its set-up rows. Everything after the brief lock is a governance record:
 * it can be archived, two-step and reversibly, and restored with one tap.
 * status = 'archived' is the state; archived_at / archived_by record who
 * shelved it and when. A member sees the shelf but none of the controls
 * (canEdit), and the database would refuse a member's write anyway.
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
const LOCKED_RECORD_ERROR =
  'This project has a locked brief, so it is a governance record. It can be archived instead.';
const ARCHIVE_ERROR =
  'We could not archive this project. Please check your connection and try again.';
const RESTORE_ERROR =
  'We could not restore this project. Please check your connection and try again.';

// The updated_at timestamp at day granularity, in the app's one display format
// (lib/engine/dateFormat.js). UTC-pinned there, so the displayed day reads the
// same for every viewer and the server-rendered HTML matches the client.
const formatUpdated = formatDisplayDate;

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

export default function ProjectList({ projects, canEdit = true, viewerId = null }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(projects);
  // { id, kind: 'delete' | 'archive' } while a two-step confirm is open.
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const { working, archived } = splitProjects(items);

  const removeDraft = async (id) => {
    setBusyId(id);
    setError(null);
    const { error: delErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (delErr) {
      setBusyId(null);
      setConfirming(null);
      // The 037 guard names its refusal: the draft status was stale and this
      // project holds a locked brief. Say so honestly, then re-read; the row
      // comes back as a record and offers Archive instead.
      setError(isLockedRecordError(delErr) ? LOCKED_RECORD_ERROR : DELETE_ERROR);
      router.refresh();
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== id));
    setBusyId(null);
    setConfirming(null);
    router.refresh();
  };

  const archiveProject = async (id) => {
    setBusyId(id);
    setError(null);
    const archivedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('projects')
      .update({ status: 'archived', archived_at: archivedAt, archived_by: viewerId })
      .eq('id', id);
    if (updErr) {
      setBusyId(null);
      setError(ARCHIVE_ERROR);
      return;
    }
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'archived', archived_at: archivedAt, archived_by: viewerId }
          : p
      )
    );
    setBusyId(null);
    setConfirming(null);
    router.refresh();
  };

  const restoreProject = async (id) => {
    setBusyId(id);
    setError(null);
    const { error: updErr } = await supabase
      .from('projects')
      .update({ status: 'active', archived_at: null, archived_by: null })
      .eq('id', id);
    if (updErr) {
      setBusyId(null);
      setError(RESTORE_ERROR);
      return;
    }
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'active', archived_at: null, archived_by: null }
          : p
      )
    );
    setBusyId(null);
    router.refresh();
  };

  const renderConfirm = (p, kind) => {
    const busy = busyId === p.id;
    const isDelete = kind === 'delete';
    return (
      <li key={p.id} className={styles.listItem}>
        <div
          className={`${styles.confirm} ${
            isDelete ? styles.confirmDanger : styles.confirmQuiet
          }`}
          role="alertdialog"
          aria-label={`${isDelete ? 'Delete' : 'Archive'} ${p.name}`}
        >
          <div className={styles.confirmText}>
            <span className={styles.confirmTitle}>
              {isDelete ? 'Delete this draft?' : 'Archive this project?'}
            </span>
            <span className={styles.confirmNote}>
              {isDelete
                ? `${p.name} and everything set up in it will be removed permanently. This cannot be undone.`
                : `${p.name} leaves the working list and keeps its full record: the locked brief, the baseline, and every decision. Restore it from Archived at any time.`}
            </span>
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setConfirming(null)}
              disabled={busy}
            >
              Cancel
            </button>
            {isDelete ? (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => removeDraft(p.id)}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete draft'}
              </button>
            ) : (
              <button
                type="button"
                className={styles.archiveConfirmBtn}
                onClick={() => archiveProject(p.id)}
                disabled={busy}
              >
                {busy ? 'Archiving…' : 'Archive project'}
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const renderWorkingRow = (p) => {
    const stageName = STAGE_NAMES[p.current_stage] ?? `Stage ${p.current_stage}`;
    const updated = formatUpdated(p.updated_at);
    const action = projectAction(p, canEdit);

    if (confirming?.id === p.id) {
      return renderConfirm(p, confirming.kind);
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
        {action === 'delete' && (
          <button
            type="button"
            className={styles.cardDelete}
            onClick={() => setConfirming({ id: p.id, kind: 'delete' })}
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
        {action === 'archive' && (
          <button
            type="button"
            className={styles.cardArchive}
            onClick={() => setConfirming({ id: p.id, kind: 'archive' })}
            aria-label={`Archive ${p.name}`}
            title="Archive"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 3h12v3H2zM3.2 6v6.2c0 .4.4.8.8.8h8c.4 0 .8-.4.8-.8V6M6.5 8.8h3"
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
  };

  const renderArchivedRow = (p) => {
    const stageName = STAGE_NAMES[p.current_stage] ?? `Stage ${p.current_stage}`;
    const shelved = formatUpdated(p.archived_at ?? p.updated_at);
    const busy = busyId === p.id;
    return (
      <li key={p.id} className={styles.listItem}>
        <div className={styles.archivedRow}>
          <div className={styles.cardMain}>
            <h2 className={styles.archivedName}>{p.name}</h2>
            <p className={styles.cardMeta}>
              Stage {p.current_stage}: {stageName}
              {shelved ? ` · Archived ${shelved}` : ''}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              className={styles.restoreBtn}
              onClick={() => restoreProject(p.id)}
              disabled={busy}
              aria-label={`Restore ${p.name}`}
            >
              {busy ? 'Restoring…' : 'Restore'}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      {working.length > 0 ? (
        <ul className={styles.list}>{working.map(renderWorkingRow)}</ul>
      ) : (
        <p className={styles.workingEmpty}>
          {canEdit
            ? 'Nothing in the working list. Restore a project from Archived, or start a new one.'
            : 'Nothing in the working list.'}
        </p>
      )}

      {error && (
        <p className={styles.deleteError} role="alert">
          {error}
        </p>
      )}

      {archived.length > 0 && (
        <section aria-label="Archived projects" className={styles.archivedSection}>
          <h2 className={styles.archivedHead}>
            Archived
            <span className={styles.archivedCount}>{archived.length}</span>
          </h2>
          <ul className={styles.list}>{archived.map(renderArchivedRow)}</ul>
        </section>
      )}
    </>
  );
}

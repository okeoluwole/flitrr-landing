/**
 * The project list's removal model. Pure and deterministic: no DB, no React,
 * no clock. The one place the working/archived split and the per-project
 * removal action are decided, so the server page, the list component, and the
 * tests all read the same rule.
 *
 * The rule mirrors the 037 boundary exactly. A project whose brief has never
 * been locked is a draft (status 'draft': the wizard flips status to 'active'
 * only at the brief lock, StepGeneratedBrief), and a draft can be hard
 * deleted. Everything after the lock is a governance record: it can only be
 * archived, reversibly, and the database's delete guard enforces the same
 * line at the write path. Nothing here re-derives lock state from brief rows;
 * status is the projection this list reads.
 */

/**
 * Split the fetched rows into the working list and the archived shelf,
 * preserving the incoming order (the page orders by updated_at descending).
 */
export function splitProjects(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    working: list.filter((p) => p?.status !== 'archived'),
    archived: list.filter((p) => p?.status === 'archived'),
  };
}

/**
 * The one removal action a row offers, or null for none.
 *
 *   draft     -> 'delete'   (never locked; nothing of governance value exists)
 *   archived  -> 'restore'  (back to the working list, reversibly)
 *   otherwise -> 'archive'  (a record leaves the working list, never the product)
 *
 * A member gets null everywhere: removal is an admin act, and the database
 * would refuse a member's write anyway (024). The UI rule and the RLS rule
 * agree by construction.
 */
export function projectAction(project, canEdit) {
  if (!canEdit || !project) return null;
  if (project.status === 'draft') return 'delete';
  if (project.status === 'archived') return 'restore';
  return 'archive';
}

/**
 * Whether a failed delete was refused by the 037 guard: the project turned
 * out to hold a locked brief (the draft status was stale, for instance the
 * lock's status flip soft-failed). The component maps this to honest copy
 * and re-reads, rather than showing a connection error for a governance
 * refusal.
 */
export function isLockedRecordError(error) {
  return typeof error?.message === 'string' &&
    error.message.includes('project_is_locked_record');
}

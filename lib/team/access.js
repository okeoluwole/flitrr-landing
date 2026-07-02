import { buildAdminContactLine } from './adminContact.js';

/**
 * Resolve the current viewer's edit access once, for a project surface to read.
 *
 * The one place role is turned into a single boolean the surfaces share, so no
 * surface re-derives it. It reuses the Step 3a database helpers:
 *   - is_organisation_admin() (024/026) decides canEdit. An admin edits as
 *     before; a member is read-only across the whole project. This is
 *     presentation only: the 024 tenant rule already denies a member's writes
 *     in the database. Nothing here relaxes that.
 *   - organisation_admin_contact() (027) supplies the admin's display name to a
 *     member, so the "View only" badge can name who to contact. It is resolved
 *     only for a member (an admin never sees the badge).
 *
 * Role is organisation level, not project level: a member is read-only across
 * every project in their organisation, so this does not need the project id.
 *
 * Degrades cleanly. Supabase rpc returns { data, error } rather than throwing;
 * on any error (including 027 not yet applied) the admin flag defaults to
 * read-only and the contact line falls back to the generic sentence, so a
 * member still gets a clean read-only experience rather than a broken page.
 *
 * @param {object} supabase  an awaited server client (createClient()).
 * @returns {Promise<{ isAdmin: boolean, canEdit: boolean, adminContact: string|null }>}
 *   adminContact is the finished contact line for a member, or null for an
 *   admin (who sees no badge).
 */
export async function resolveProjectAccess(supabase) {
  let isAdmin = false;
  try {
    const { data, error } = await supabase.rpc('is_organisation_admin');
    isAdmin = !error && data === true;
  } catch {
    isAdmin = false;
  }

  const canEdit = isAdmin;

  if (canEdit) {
    return { isAdmin, canEdit, adminContact: null };
  }

  let adminName = null;
  try {
    const { data, error } = await supabase.rpc('organisation_admin_contact');
    adminName = !error && typeof data === 'string' ? data : null;
  } catch {
    adminName = null;
  }

  return { isAdmin, canEdit, adminContact: buildAdminContactLine(adminName) };
}

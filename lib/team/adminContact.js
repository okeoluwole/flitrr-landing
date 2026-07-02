/**
 * The member read-only contact line (pure logic).
 *
 * A member is read-only across the whole project. The "View only" badge opens
 * to a short line naming who to contact to request a change: the organisation
 * admin, by name. This module turns the admin's display name into that line.
 *
 * The name comes from organisation_admin_contact() (migration 027), which
 * returns the single earliest active admin's display name to a member, or NULL
 * when there is no name to show (the admin never set one, or the migration is
 * not yet applied). When there is no name, the line falls back to the same
 * sentence without naming anyone, so a member always sees a clean instruction
 * rather than a blank or a broken read.
 *
 * No database, no React, no clock: the same input always gives the same line,
 * so the whole module is unit-testable in isolation. Punctuation discipline:
 * commas, no dashes; UK spelling ("organisation").
 */

/**
 * The contact line for the read-only badge.
 *
 * @param {string|null|undefined} name  the admin display name, or null.
 * @returns {string} the sentence to show. Named when a usable name is given,
 *   generic otherwise.
 */
export function buildAdminContactLine(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed) {
    return `Contact your organisation admin, ${trimmed}, to request changes.`;
  }
  return 'Contact your organisation admin to request changes.';
}

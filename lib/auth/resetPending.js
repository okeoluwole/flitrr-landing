/**
 * The must-set-password marker.
 *
 * A session created by a password-recovery or invite link is a full
 * Supabase session, so nothing about the session itself tells the app
 * "this user has not set a password yet". The auth callback sets this
 * cookie when it forwards such an arrival to the set-password screen,
 * and the middleware refuses protected paths while it is present.
 *
 * It is cleared in exactly two places: after supabase.auth.updateUser
 * succeeds on the set-password screen, and after a successful password
 * sign-in (which proves the password works, so any stale marker from an
 * abandoned or expired link is moot).
 *
 * Value: '1' for a plain recovery, 'welcome' for an invite, so the
 * middleware can bounce back to the invite variant of the screen.
 */
export const PASSWORD_RESET_PENDING_COOKIE = 'flitrr-password-reset-pending';

/** Browser-side clear. Safe to call when the cookie is not set. */
export function clearPasswordResetPending() {
  document.cookie = `${PASSWORD_RESET_PENDING_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/**
 * Auth callback. The user lands here after clicking the email
 * confirmation link, an invite link, or a password-reset link.
 *
 * Supabase sends two link formats and this route must handle both:
 *
 *   - PKCE: a `?code=...` query param (browser-initiated flows such as
 *     the forgot-password form). We exchange it for a session here on
 *     the server and forward to `next`.
 *   - Implicit: the tokens arrive in a `#access_token=...` URL
 *     fragment (admin-initiated links such as team invites, which
 *     cannot use PKCE because no browser held a code verifier when the
 *     email was sent). A fragment is never sent to the server, so this
 *     route cannot see or exchange it. Instead we forward to `next`
 *     untouched; the browser re-attaches the fragment across the
 *     redirect, and the destination page reads it and establishes the
 *     session client-side (see the fragment effect in
 *     app/reset-password/page.js).
 *
 * The optional `?next=/some/path` query param tells us where to send
 * the user. Used by the password-reset flow (next=/reset-password) and
 * the invite flow (next=/reset-password?welcome=1) so the user lands
 * on the set-password form. Defaults to /dashboard when absent (the
 * email-confirmation path).
 *
 * `next` is restricted to in-app paths (must start with a single "/"
 * and not "//") to prevent open-redirect abuse.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  const hasSafeNext =
    Boolean(nextParam) &&
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//');
  const safeNext = hasSafeNext ? nextParam : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // No code in the query: an implicit-flow arrival. The tokens are in
  // the URL fragment, which only the browser can read. Forward to the
  // requested page so its browser client can pick the session up from
  // the fragment. Only our own email flows set `next`, so an arrival
  // without one keeps the old failure bounce.
  if (hasSafeNext) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}

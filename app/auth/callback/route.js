import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/**
 * Auth callback. The user lands here after clicking the email
 * confirmation link OR a password-reset link. Supabase appends a
 * `?code=...` query param; we exchange it for a real session and
 * forward into the app.
 *
 * The optional `?next=/some/path` query param tells us where to send
 * the user after a successful exchange. Used by the password-reset
 * flow (next=/reset-password) so the user lands on the form with a
 * fresh recovery session. Defaults to /dashboard when absent (the
 * email-confirmation path).
 *
 * `next` is restricted to in-app paths (must start with a single "/"
 * and not "//") to prevent open-redirect abuse.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');

  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}

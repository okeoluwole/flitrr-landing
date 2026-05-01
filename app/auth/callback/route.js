import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/**
 * Auth callback. The user lands here after clicking the email
 * confirmation link. Supabase appends a `?code=...` query param;
 * we exchange it for a real session and redirect into the app.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}

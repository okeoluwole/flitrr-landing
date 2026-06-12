import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client (M7.3).
 *
 * For server-side jobs that run with NO user session: the weekly digest
 * (a cron request reading across every opted-in user) and the unsubscribe
 * route (a logged-out click that must flip one flag). RLS would correctly
 * return nothing to the publishable key in those contexts, so these two
 * routes, and only these, use the secret key, which bypasses RLS.
 *
 * SUPABASE_SECRET_KEY is the secret API key from the Supabase dashboard
 * (Settings, API). It is server-only: no NEXT_PUBLIC_ prefix, never
 * imported from client components. Returns null when the key is not
 * configured so callers can degrade gracefully instead of crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

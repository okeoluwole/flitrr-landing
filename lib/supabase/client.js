import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 *
 * Use this in Client Components and any code that runs in the browser.
 * Reads cookies / localStorage to maintain the user's session and is
 * safe to call repeatedly — `createBrowserClient` returns the same
 * underlying client per page load.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

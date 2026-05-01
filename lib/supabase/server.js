import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client.
 *
 * Use this in Server Components, Route Handlers, and Server Actions.
 * Reads / writes the session cookie via Next's `cookies()` helper so
 * the user's auth state is preserved across requests.
 *
 * Async because Next 14.2+ requires `await cookies()` in async server
 * contexts (and Next 15 makes this strict).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — cookies can't be mutated here.
            // The middleware (added in sub-step 2) handles session refresh.
          }
        },
      },
    }
  );
}

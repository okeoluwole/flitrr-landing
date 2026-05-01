import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session on every request so server components
 * see the latest auth state. Standard @supabase/ssr middleware pattern.
 *
 * Per the official guidance: call `supabase.auth.getUser()` here. Do
 * NOT trust `getSession()` server-side. The matcher (below) lets every
 * request flow through except static assets.
 *
 * No auth-protection logic in this sub-step. Sub-step 3 will add the
 * /dashboard guard.
 */
export async function middleware(request) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refreshes the session cookie if it's near expiry. Returning the
  // response from above preserves any Set-Cookie headers Supabase wrote.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *   - _next/static, _next/image (Next internals)
     *   - favicon.ico, icon.svg (app icons)
     *   - common image extensions
     *   - the OG image
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|og-image\\.png|og-image\\.svg|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

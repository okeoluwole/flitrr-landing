import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Path prefixes that require an authenticated session. Anything
 * starting with one of these strings, including deeper paths, is
 * gated. Everything else is public.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/pulse/app'];

/**
 * Query params on /login that signal a banner state we don't want
 * to step on by redirecting away. If any of these are present, an
 * authenticated user can still see /login (the banner renders, then
 * they sign in or close).
 */
const LOGIN_BANNER_PARAMS = ['reset', 'error'];

/**
 * Two responsibilities, in order:
 *   1. Refresh the Supabase session cookie on every request.
 *   2. Gate access:
 *      - Protected paths require a user. Without one, redirect to
 *        /login?next=<original path + query>.
 *      - A signed-in but deactivated member is sent to a plain
 *        /access-deactivated notice and cannot proceed. Row level
 *        security denies their data underneath regardless.
 *      - /login, when authenticated, redirects to /dashboard
 *        (except when carrying a banner query param).
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

  // Refreshes the session cookie if it's near expiry AND gives us the
  // user object for the gating logic below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search, searchParams } = request.nextUrl;

  // Gate 1: protected prefixes require a session.
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Gate 1b: only an active member may reach the app. A user can always read
  // their own membership row (the organisation_members policy allows it), so we
  // check it on protected paths. Anyone without an active membership, whether
  // deactivated or never joined to an organisation, is sent to a plain notice.
  // This is only the boundary; row level security denies their data underneath
  // regardless. A transient read error is the one case left to pass (data is
  // null and undistinguishable from no-row), which row level security still
  // covers; a genuine no-membership row is blocked.
  if (isProtected && user) {
    const { data: membership, error: membershipError } = await supabase
      .from('organisation_members')
      .select('deactivated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const noActiveAccess =
      !membershipError && (!membership || membership.deactivated_at !== null);
    if (noActiveAccess) {
      const deactivatedUrl = request.nextUrl.clone();
      deactivatedUrl.pathname = '/access-deactivated';
      deactivatedUrl.search = '';
      return NextResponse.redirect(deactivatedUrl);
    }
  }

  // Gate 2: authenticated users skip /login (unless a banner param
  // says otherwise).
  const isLogin = pathname === '/login' || pathname.startsWith('/login/');
  const hasBannerParam = LOGIN_BANNER_PARAMS.some((p) => searchParams.has(p));
  if (isLogin && user && !hasBannerParam) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    dashUrl.search = '';
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *   - _next/static, _next/image (Next internals)
     *   - favicon.ico, icon.svg (app icons)
     *   - common image extensions
     *   - the OG image, brand SVGs
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|og-image\\.png|og-image\\.svg|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

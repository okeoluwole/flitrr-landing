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

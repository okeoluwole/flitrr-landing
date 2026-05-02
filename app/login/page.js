'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import styles from './page.module.css';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [tab, setTab] = useState('signin'); // 'signin' | 'register'

  // Detect query-param banners. /login?reset=success comes from the
  // reset-password flow. /login?error=callback_failed comes from the
  // auth callback when the email-confirmation code exchange fails.
  const resetSuccess = searchParams.get('reset') === 'success';
  const callbackError = searchParams.get('error') === 'callback_failed';

  // Post-sign-in redirect target. The middleware appends ?next=
  // when it bounces an unauthenticated visitor here. We honour that
  // value if it's a same-origin path; otherwise default to /dashboard.
  const rawNext = searchParams.get('next');
  const safeNext =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard';

  /* ─── Sign in form state ─── */
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState(null);
  const [siBusy, setSiBusy] = useState(false);

  /* ─── Register form state ─── */
  const [rgEmail, setRgEmail] = useState('');
  const [rgPassword, setRgPassword] = useState('');
  const [rgFullName, setRgFullName] = useState('');
  const [rgCompany, setRgCompany] = useState('');
  const [rgError, setRgError] = useState(null);
  const [rgBusy, setRgBusy] = useState(false);
  const [rgDoneEmail, setRgDoneEmail] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSiError(null);
    setSiBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: siEmail,
      password: siPassword,
    });
    setSiBusy(false);
    if (error) {
      setSiError(error.message);
      return;
    }
    router.push(safeNext);
    router.refresh();
  };

  // Dev-only sign-out that previously lived below the card has been
  // retired. The DashboardShell user menu now provides this affordance,
  // and the middleware redirects any authenticated visitor away from
  // /login (except when a banner query param is present).

  const handleRegister = async (e) => {
    e.preventDefault();
    setRgError(null);
    setRgBusy(true);
    const { error } = await supabase.auth.signUp({
      email: rgEmail,
      password: rgPassword,
      options: {
        data: {
          full_name: rgFullName,
          company_name: rgCompany,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setRgBusy(false);
    if (error) {
      setRgError(error.message);
      return;
    }
    setRgDoneEmail(rgEmail);
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brandWordmark}>
        Flitrr
      </Link>

      <div className={styles.card}>
        {resetSuccess && (
          <p className={styles.banner} role="status">
            Password updated. Sign in with your new password.
          </p>
        )}
        {callbackError && (
          <p className={styles.banner} role="alert">
            Sign-in link could not be confirmed. Please try again, or
            request a fresh email.
          </p>
        )}

        {/* Tab strip */}
        <div className={styles.tabStrip} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signin'}
            className={`${styles.tab} ${tab === 'signin' ? styles.tabActive : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        {tab === 'signin' && (
          <>
            <h1 className={styles.cardHeading}>Welcome back.</h1>
            <p className={styles.cardSub}>
              Sign in to your Flitrr account.
            </p>
            <form className={styles.form} onSubmit={handleSignIn} noValidate>
              <div className={styles.inputWrap}>
                <label htmlFor="si-email" className={styles.label}>
                  Email address
                </label>
                <input
                  id="si-email"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className={styles.inputWrap}>
                <label htmlFor="si-password" className={styles.label}>
                  Password
                </label>
                <input
                  id="si-password"
                  type="password"
                  className={styles.input}
                  placeholder="At least 8 characters"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {siError && (
                <p className={styles.error} role="alert">
                  {siError}
                </p>
              )}
              <button
                type="submit"
                className={styles.submit}
                disabled={siBusy}
              >
                {siBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <Link href="/forgot-password" className={styles.helper}>
              Forgot password?
            </Link>
          </>
        )}

        {tab === 'register' && (
          <>
            {rgDoneEmail ? (
              <div className={styles.success}>
                <svg
                  className={styles.successIcon}
                  viewBox="0 0 40 40"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="20" cy="20" r="18"
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                  />
                  <path
                    d="M11 20.5l6 6 12-12"
                    stroke="var(--color-accent-1-deep-blue)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h2 className={styles.successHeading}>Check your email.</h2>
                <p className={styles.successBody}>
                  We sent a confirmation link to {rgDoneEmail}. Click it
                  to finish setting up your account.
                </p>
              </div>
            ) : (
              <>
                <h1 className={styles.cardHeading}>Create your account.</h1>
                <p className={styles.cardSub}>
                  Register for early access to Flitrr products.
                </p>
                <form
                  className={styles.form}
                  onSubmit={handleRegister}
                  noValidate
                >
                  <div className={styles.inputWrap}>
                    <label htmlFor="rg-name" className={styles.label}>
                      Full name
                    </label>
                    <input
                      id="rg-name"
                      type="text"
                      className={styles.input}
                      placeholder="Jane Smith"
                      value={rgFullName}
                      onChange={(e) => setRgFullName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className={styles.inputWrap}>
                    <label htmlFor="rg-company" className={styles.label}>
                      Company / practice name
                    </label>
                    <input
                      id="rg-company"
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Northpoint Developments"
                      value={rgCompany}
                      onChange={(e) => setRgCompany(e.target.value)}
                      required
                      autoComplete="organization"
                    />
                  </div>
                  <div className={styles.inputWrap}>
                    <label htmlFor="rg-email" className={styles.label}>
                      Email address
                    </label>
                    <input
                      id="rg-email"
                      type="email"
                      className={styles.input}
                      placeholder="you@example.com"
                      value={rgEmail}
                      onChange={(e) => setRgEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className={styles.inputWrap}>
                    <label htmlFor="rg-password" className={styles.label}>
                      Password
                    </label>
                    <input
                      id="rg-password"
                      type="password"
                      className={styles.input}
                      placeholder="At least 8 characters"
                      value={rgPassword}
                      onChange={(e) => setRgPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  {rgError && (
                    <p className={styles.error} role="alert">
                      {rgError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={rgBusy}
                  >
                    {rgBusy ? 'Creating account…' : 'Create account'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

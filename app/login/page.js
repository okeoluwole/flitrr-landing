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

  // Sign in form state. Flitrr onboards users itself, so there is no
  // public self-serve registration: this is the only form on the page.
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState(null);
  const [siBusy, setSiBusy] = useState(false);

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

  return (
    <main className={styles.page}>
      <Link href="/" className={`${styles.brandWordmark} riseIn`}>
        Flitrr
      </Link>

      <div className={`${styles.card} riseIn`} style={{ '--rise-delay': '70ms' }}>
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

        {/* Flitrr onboards users itself, so there is no self-serve
            registration. The only other affordance is the design-partner
            application on the public site (the /#design-partner section). */}
        <div className={styles.partnerFoot}>
          <p className={styles.partnerNote}>
            New to Flitrr? Onboarding is by invitation.
          </p>
          <a href="/#design-partner" className={styles.partnerCta}>
            Become a partner
          </a>
        </div>
      </div>
    </main>
  );
}

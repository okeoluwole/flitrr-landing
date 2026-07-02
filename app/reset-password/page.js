'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import styles from '../login/page.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // An invited member arrives here with ?welcome=1 (the invite redirect). They
  // already have a session from the callback, so on success we send them
  // straight into the app rather than back to sign in. A password-reset user
  // (no welcome flag) keeps the existing sign-in-again behaviour.
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    setWelcome(
      new URLSearchParams(window.location.search).get('welcome') === '1'
    );
  }, []);

  // Invite links (and any admin-sent recovery link) arrive with the session
  // in the URL fragment: the implicit flow, because an email sent server-side
  // has no browser to hold a PKCE code verifier. The auth callback forwards
  // that fragment here untouched (a fragment never reaches the server), and
  // the browser client will not adopt it by itself because @supabase/ssr pins
  // the client to the PKCE flow. So read the fragment and establish the
  // session explicitly. A PKCE password reset arrives with no fragment (the
  // callback already set the session cookie) and this effect does nothing.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: err }) => {
          if (err) {
            setError(err.message);
            return;
          }
          // Keep the tokens out of the address bar and browser history.
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        });
      return;
    }

    // A consumed or expired link comes back as an error fragment
    // (#error=access_denied&error_code=otp_expired&...). Say so plainly
    // instead of letting the form fail with a cryptic message on submit.
    if (params.get('error') || params.get('error_description')) {
      setError('This link is invalid or has expired. Please request a new one.');
    }
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (welcome) {
      // Belt-and-braces: make sure the invited member is joined to their
      // organisation before they land in the app. The database normally joins
      // them when the invite is confirmed; this covers any case where it did
      // not. Idempotent, so a no-op when they are already joined.
      await supabase.rpc('claim_pending_invitation');
      router.push('/dashboard');
    } else {
      router.push('/login?reset=success');
    }
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={`${styles.brandWordmark} riseIn`}>
        Flitrr
      </Link>

      <div className={`${styles.card} riseIn`} style={{ '--rise-delay': '70ms' }}>
        <h1 className={styles.cardHeading}>
          {welcome ? 'Set your password.' : 'Set a new password.'}
        </h1>
        <p className={styles.cardSub}>
          {welcome
            ? 'Choose a password to finish joining your team.'
            : 'Choose a strong password you have not used before.'}
        </p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.inputWrap}>
            <label htmlFor="rp-password" className={styles.label}>
              New password
            </label>
            <input
              id="rp-password"
              type="password"
              className={styles.input}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.inputWrap}>
            <label htmlFor="rp-confirm" className={styles.label}>
              Confirm new password
            </label>
            <input
              id="rp-confirm"
              type="password"
              className={styles.input}
              placeholder="Re-enter the password above"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className={styles.submit}
            disabled={busy}
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </main>
  );
}

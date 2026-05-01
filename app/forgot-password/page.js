'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import styles from '../login/page.module.css';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [doneEmail, setDoneEmail] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDoneEmail(email);
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brandWordmark}>
        Flitrr
      </Link>

      <div className={styles.card}>
        {doneEmail ? (
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
              We sent a reset link to {doneEmail}.
            </p>
          </div>
        ) : (
          <>
            <h1 className={styles.cardHeading}>Reset your password.</h1>
            <p className={styles.cardSub}>
              Enter your email and we will send a reset link.
            </p>
            <form
              className={styles.form}
              onSubmit={handleSubmit}
              noValidate
            >
              <div className={styles.inputWrap}>
                <label htmlFor="fp-email" className={styles.label}>
                  Email address
                </label>
                <input
                  id="fp-email"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
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
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link href="/login" className={styles.helper}>
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

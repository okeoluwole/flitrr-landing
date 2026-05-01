'use client';

import { useState } from 'react';
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

    router.push('/login?reset=success');
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brandWordmark}>
        Flitrr
      </Link>

      <div className={styles.card}>
        <h1 className={styles.cardHeading}>Set a new password.</h1>
        <p className={styles.cardSub}>
          Choose a strong password you have not used before.
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

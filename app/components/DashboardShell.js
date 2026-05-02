'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import styles from './DashboardShell.module.css';

/**
 * Authenticated shell. Renders the Flitrr top bar with a user menu
 * (Account settings + Sign out) and yields {children} below it.
 *
 * `user` shape: { id, email, full_name }. full_name is optional.
 * The first-name derivation matches the dashboard greeting:
 *   1. Take the first whitespace-separated token of full_name.
 *   2. Otherwise, fall back to the local-part of email.
 */
function deriveFirstName(user) {
  if (user?.full_name) {
    const first = user.full_name.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (user?.email) {
    return user.email.split('@')[0];
  }
  return 'there';
}

export default function DashboardShell({ user, children }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const firstName = deriveFirstName(user);

  /* Click-outside + Escape close the dropdown. */
  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  };

  // Account settings is a placeholder. Anchored to "#" with
  // preventDefault so the URL doesn't visibly mutate. Future work:
  // build /account and link there.
  const handleAccountSettings = (e) => {
    e.preventDefault();
    setOpen(false);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topBar} role="banner">
        <div className={`container ${styles.topBarInner}`}>
          <Link href="/dashboard" className={styles.brandWordmark}>
            Flitrr
          </Link>

          <div className={styles.menuWrap} ref={wrapRef}>
            <button
              type="button"
              className={styles.menuTrigger}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span>Hi, {firstName}</span>
              <svg
                className={`${styles.menuChevron} ${open ? styles.menuChevronOpen : ''}`}
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path
                  d="M2 4l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {open && (
              <div className={styles.menuPanel} role="menu">
                {/* Placeholder until the /account page exists. */}
                <a
                  href="#"
                  className={`${styles.menuItem} ${styles.menuItemMuted}`}
                  onClick={handleAccountSettings}
                  role="menuitem"
                >
                  Account settings
                </a>
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemAction}`}
                  onClick={handleSignOut}
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.body}>{children}</div>
    </div>
  );
}

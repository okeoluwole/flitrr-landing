'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import styles from './DashboardShell.module.css';

/**
 * Authenticated shell. Renders the Flitrr top bar with a user menu
 * (Team for admins, Account settings + Sign out) and yields {children}
 * below it.
 *
 * `user` shape: { id, email, full_name }. full_name is optional.
 * `isAdmin` adds the Team entry; it defaults to false, so callers that
 * do not pass it show no Team link.
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

export default function DashboardShell({ user, isAdmin = false, children }) {
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

  return (
    <div className={styles.shell}>
      <header className={styles.topBar} role="banner">
        <div className={`container ${styles.topBarInner}`}>
          {/* Flitrr wears the marketing amber dot. The pulse-line glyph
              belongs to PULSE and lives on PULSE surfaces, not here. */}
          <Link href="/dashboard" className={styles.brandWordmark}>
            Flitrr
            <span className={styles.brandDot} aria-hidden="true" />
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
                {isAdmin && (
                  <Link
                    href="/dashboard/team"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    Team
                  </Link>
                )}
                {/* /account isn't built yet, so this reads as a planned item
                    rather than a link that goes nowhere on click. */}
                <span
                  className={`${styles.menuItem} ${styles.menuItemDisabled}`}
                  role="menuitem"
                  aria-disabled="true"
                >
                  Account settings
                  <span className={styles.menuSoon}>Soon</span>
                </span>
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

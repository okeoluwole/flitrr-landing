'use client';

import Link from 'next/link';
import styles from './SiteNav.module.css';

/**
 * Shared nav for the "Considered" marketing surfaces. Absolute over the dark
 * hero. Auth-aware (Sign in vs Dashboard), resolved on the server and passed in
 * so the first render matches. `current` omits the active section's own link,
 * so the nav never links to the page you are already on;
 * `product` renders the "Flitrr / PULSE" lockup on the PULSE page.
 */
export default function SiteNav({ user = null, current = null, product = null }) {
  const signedIn = Boolean(user);
  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/" className={styles.brand} aria-label="Flitrr home">
        {product ? (
          <>
            <span className={styles.b1}>Flitrr</span>
            <span className={styles.b2}>
              {product}
              <span className={styles.dot} aria-hidden="true" />
            </span>
          </>
        ) : (
          <>
            Flitrr
            <span className={styles.dot} aria-hidden="true" />
          </>
        )}
      </Link>
      <div className={styles.navlinks}>
        {current !== 'framework' && (
          <Link href="/framework">Framework</Link>
        )}
        {current !== 'pulse' && (
          <Link href="/pulse">PULSE</Link>
        )}
        {signedIn ? (
          <Link href="/dashboard" className={styles.signin}>
            Dashboard
          </Link>
        ) : (
          <Link href="/login" className={styles.signin}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

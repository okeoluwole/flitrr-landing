'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

/**
 * Home page nav. Receives the server-resolved user from the page
 * server component so initial render matches the auth state without
 * a client flash.
 */
export default function HomeNav({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const close = () => setMenuOpen(false);
  const isSignedIn = Boolean(user);

  return (
    <header
      className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
      role="banner"
    >
      <div className={`container ${styles.navInner}`}>
        <Link href="/" className={styles.navWordmark} aria-label="Flitrr home">
          Flitrr
        </Link>

        <nav
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}
          aria-label="Primary navigation"
        >
          <a href="#lifecycle" onClick={close}>Lifecycle</a>
          <a href="#products" onClick={close}>Products</a>
          <a href="#design-partner" onClick={close}>Get involved</a>
          {isSignedIn ? (
            <Link href="/dashboard" onClick={close}>Dashboard</Link>
          ) : (
            <Link href="/login" onClick={close}>Sign in</Link>
          )}
          <a href="#design-partner" className={styles.navCta} onClick={close}>
            Become a partner
          </a>
        </nav>

        <button
          className={styles.hamburger}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barTop : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barMid : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barBot : ''}`} />
        </button>
      </div>
    </header>
  );
}

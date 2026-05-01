'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

export default function PulseNav({ user }) {
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
        <div className={styles.brandLockup}>
          <Link href="/" className={styles.brandFlitrr} aria-label="Flitrr home">
            Flitrr
          </Link>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandPulse} aria-current="page">
            PULSE
          </span>
        </div>

        <nav
          id="primary-nav"
          className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}
          aria-label="Primary navigation"
        >
          <a href="#how-it-works" onClick={close}>How it works</a>
          <a href="#modules" onClick={close}>Modules</a>
          <a href="#faq" onClick={close}>FAQ</a>
          {isSignedIn ? (
            <Link href="/dashboard" onClick={close}>Dashboard</Link>
          ) : (
            <Link href="/login" onClick={close}>Sign in</Link>
          )}
          <a
            href="#design-partner"
            className={styles.navCta}
            onClick={close}
          >
            Become a design partner
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

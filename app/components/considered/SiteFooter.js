import Link from 'next/link';
import styles from './SiteFooter.module.css';

/**
 * Shared footer for the "Considered" marketing surfaces. `variant` picks the
 * Flitrr lockup (landing / framework) or the "Flitrr / PULSE" lockup (PULSE).
 */
export default function SiteFooter({ variant = 'flitrr' }) {
  const isPulse = variant === 'pulse';
  return (
    <footer className={styles.foot} role="contentinfo">
      <div className={styles.wrap}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            {isPulse ? (
              <div className={styles.lockup}>Flitrr / PULSE</div>
            ) : (
              <Link href="/" className={styles.brand} aria-label="Flitrr home">
                Flitrr
                <span className={styles.dot} aria-hidden="true" />
              </Link>
            )}
            <p>
              {isPulse
                ? 'PULSE is the project delivery product, built by Flitrr.'
                : 'One platform for the whole property development lifecycle.'}
            </p>
          </div>
          <nav aria-label="Footer">
            <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>
            {isPulse ? (
              <Link href="/">Back to Flitrr</Link>
            ) : (
              <Link href="/pulse">PULSE</Link>
            )}
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <p className={styles.copy}>&copy; 2026 FLITRR LTD &middot; ALL RIGHTS RESERVED</p>
      </div>
    </footer>
  );
}

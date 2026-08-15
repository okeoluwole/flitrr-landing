import Link from 'next/link';
import styles from './SiteFooter.module.css';

/**
 * Shared footer for the "Considered" marketing surfaces. `variant` picks the
 * Flitrr lockup (landing / framework) or a product lockup ("Flitrr / PULSE",
 * "Flitrr / STACK") on that product's own page.
 */
const PRODUCT_BLURB = {
  pulse: 'PULSE is the project delivery product, built by Flitrr.',
  stack: 'STACK is the feasibility and funding product, built by Flitrr.',
};

export default function SiteFooter({ variant = 'flitrr' }) {
  const productName = variant === 'pulse' ? 'PULSE' : variant === 'stack' ? 'STACK' : null;
  return (
    <footer className={styles.foot} role="contentinfo">
      <div className={styles.wrap}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            {productName ? (
              <div className={styles.lockup}>Flitrr / {productName}</div>
            ) : (
              <Link href="/" className={styles.brand} aria-label="Flitrr home">
                Flitrr
                <span className={styles.dot} aria-hidden="true" />
              </Link>
            )}
            <p>
              {productName
                ? PRODUCT_BLURB[variant]
                : 'One platform for the whole property development lifecycle.'}
            </p>
          </div>
          <nav aria-label="Footer">
            <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>
            {productName ? (
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

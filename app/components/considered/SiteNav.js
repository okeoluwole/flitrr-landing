'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './SiteNav.module.css';

/**
 * Shared nav for the "Considered" marketing surfaces. Absolute over the dark
 * hero. Auth-aware (Sign in vs Dashboard), resolved on the server and passed in
 * so the first render matches. The products live under a "Products" disclosure
 * (click-to-open, never hover); inside it the current product renders as an
 * unlinked row, keeping the rule that the nav never links to the page you are
 * already on. `product` renders the "Flitrr / PULSE" lockup on product pages.
 */
const PRODUCTS = [
  { key: 'pulse', name: 'PULSE', href: '/pulse', desc: 'Project delivery and programme management' },
  { key: 'stack', name: 'STACK', href: '/stack', desc: 'Feasibility, budgets and funding' },
];

export default function SiteNav({ user = null, current = null, product = null }) {
  const signedIn = Boolean(user);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      {/* First focusable element in the document, so a keyboard reader can
          pass the brand, the Products disclosure and the auth action in one
          keystroke. The marketing mains already carried id="main-content". */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>

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
        <div className={styles.products} ref={wrapRef} onKeyDown={onKeyDown}>
          <button
            type="button"
            ref={triggerRef}
            className={styles.trigger}
            aria-expanded={open}
            aria-controls="site-products-menu"
            onClick={() => setOpen((v) => !v)}
          >
            Products
            <svg className={styles.chev} viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div className={styles.panel} id="site-products-menu">
              {PRODUCTS.map((p) =>
                current === p.key ? (
                  <span key={p.key} className={`${styles.row} ${styles.rowCurrent}`} aria-current="page">
                    <span className={styles.rowName}>{p.name}</span>
                    <span className={styles.rowDesc}>{p.desc}</span>
                  </span>
                ) : (
                  <Link key={p.key} href={p.href} className={styles.row} onClick={() => setOpen(false)}>
                    <span className={styles.rowName}>{p.name}</span>
                    <span className={styles.rowDesc}>{p.desc}</span>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
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
    </>
  );
}

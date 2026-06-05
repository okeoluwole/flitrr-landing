import Link from 'next/link';
import styles from '../legal.module.css';

/*
 * Light, honest v1 terms of use for the pre-launch marketing site. Should be
 * reviewed by a legal professional and expanded before public launch.
 */

export const metadata = {
  title: 'Terms. Flitrr',
  description: 'The terms that cover your use of flitrr.com.',
};

export default function TermsPage() {
  return (
    <main className={styles.page} id="main-content">
      <div className="container">
        <Link href="/" className={styles.back}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M9 11L5 7l4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Flitrr
        </Link>

        <h1 className={styles.title}>Terms</h1>
        <p className={styles.updated}>Last updated 5 June 2026</p>

        <div className={styles.body}>
          <p>
            These terms cover your use of flitrr.com. They are a starting point
            and will be expanded before Flitrr opens to the public.
          </p>

          <h2>Using this site</h2>
          <p>
            flitrr.com is an informational website about Flitrr and its
            products. You may read it and contact us through it. Please do not
            misuse the site or attempt to disrupt it.
          </p>

          <h2>The design partner programme</h2>
          <p>
            Requesting a design partner spot is an expression of interest, not a
            contract. Places are limited and offered at Flitrr's discretion. Any
            programme terms will be agreed with you directly before you take
            part.
          </p>

          <h2>Content and ownership</h2>
          <p>
            The content, design, and branding on this site belong to Flitrr.
            Please do not copy or reuse them without permission.
          </p>

          <h2>No warranty</h2>
          <p>
            The site is provided as is. We work to keep it accurate and
            available, but we cannot guarantee it will always be error free or
            uninterrupted.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

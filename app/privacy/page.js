import Link from 'next/link';
import styles from '../legal.module.css';

/*
 * Plain-language privacy notice. This is an honest v1 describing what the
 * design-partner form collects and how it is used; it should be reviewed by
 * a legal professional and expanded before public launch.
 */

export const metadata = {
  title: 'Privacy. Flitrr',
  description: 'How Flitrr collects and uses information on flitrr.com.',
};

export default function PrivacyPage() {
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

        <h1 className={styles.title}>Privacy</h1>
        <p className={styles.updated}>Last updated 5 June 2026</p>

        <div className={styles.body}>
          <p>
            This notice explains what information Flitrr collects on flitrr.com
            and how it is used. It is written in plain language and will be
            expanded as Flitrr grows.
          </p>

          <h2>What we collect</h2>
          <p>
            If you request a design partner spot, we collect the details you
            submit in that form: your email address, your company or practice
            name, your portfolio size, and your primary market. We also receive
            the standard technical information any website does, such as your
            browser type and general location, through routine server logs.
          </p>

          <h2>How we use it</h2>
          <p>
            We use your design partner details to contact you about the
            programme and about Flitrr products. We do not sell your
            information or share it for advertising.
          </p>

          <h2>Where it is stored</h2>
          <p>
            Your submission is stored securely with our infrastructure
            provider. Access is limited to the Flitrr team.
          </p>

          <h2>Your choices</h2>
          <p>
            You can ask us to access, correct, or delete the information you
            have given us at any time. Email{' '}
            <a href="mailto:hello@flitrr.com">hello@flitrr.com</a> and we will
            action it.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this notice? Email{' '}
            <a href="mailto:hello@flitrr.com">hello@flitrr.com</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

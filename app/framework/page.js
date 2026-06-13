import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import HomeNav from '../components/HomeNav';
import homeStyles from '../page.module.css';
import styles from './page.module.css';

export const metadata = {
  title: 'The Flitrr Framework',
  description:
    'The Flitrr Framework: the structure that holds a whole property development together, from the first decision to the last.',
};

// Scaffolded placeholder. The deeper Framework positioning is owned by the
// team; this is the wired shell the CTA in band 2 points to. It states only
// what is already canonical on the site and routes visitors to it.
export default async function FrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = user ? { id: user.id, email: user.email } : null;

  return (
    <>
      <a href="#main-content" className={homeStyles.skipLink}>
        Skip to content
      </a>
      <HomeNav user={navUser} />
      <div className={styles.page}>
        <main id="main-content" className={styles.hero}>
          <div className="container">
            <div className={styles.inner}>
              <span className={styles.tag}>Being documented</span>
              <h1 className={styles.heading}>The Flitrr Framework.</h1>
              <p className={styles.lead}>
                The structure that holds a whole development together, from the
                first decision to the last.
              </p>
              <p className={styles.note}>
                We are writing this in full. For now, see the Framework at work:
                PULSE is the first product built on it, and the eight-stage
                lifecycle on the home page shows the road it follows.
              </p>
              <div className={styles.ctas}>
                <Link href="/pulse" className={homeStyles.btnPrimary}>
                  Discover PULSE
                </Link>
                <Link href="/#lifecycle" className={homeStyles.btnGhost}>
                  See the lifecycle
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3 8h9M8.5 4l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </main>
        <footer className={styles.footer} role="contentinfo">
          <div className="container">
            <div className={styles.footerRow}>
              <Link href="/" className={styles.footerWordmark}>
                Flitrr
              </Link>
              <span className={styles.footerCopy}>&copy; 2026 Flitrr Ltd.</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

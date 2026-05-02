import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import DashboardShell from '../../components/DashboardShell';
import styles from './page.module.css';

/**
 * Authenticated PULSE app placeholder. Will be replaced with the
 * Project Initiation module flow when that ships in Q3 2026.
 */
export default async function PulseAppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <span className={styles.pill}>In build</span>
        <h1 className={styles.heading}>PULSE app coming soon.</h1>
        <p className={styles.sub}>
          The Project Initiation module is in build. Design partners
          will get first access when it ships.
        </p>
        <Link href="/dashboard" className={styles.backLink}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden="true"
          >
            <path
              d="M9 11L5 7l4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to dashboard
        </Link>
      </main>
    </DashboardShell>
  );
}

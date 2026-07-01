import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import SignOutButton from './SignOutButton';
import styles from './page.module.css';

export const metadata = { title: 'Access deactivated' };

// Reflects live membership state, so never cached.
export const dynamic = 'force-dynamic';

/**
 * The plain notice a signed-in but deactivated user sees. The middleware sends a
 * deactivated user here from any app route; row level security denies them all
 * data underneath. A user who actually has active access does not belong here,
 * so they are sent back to the dashboard.
 */
export default async function AccessDeactivatedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('organisation_members')
    .select('deactivated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership && membership.deactivated_at === null) {
    redirect('/dashboard');
  }

  const deactivated = Boolean(membership && membership.deactivated_at !== null);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.brand}>Flitrr</span>
        {deactivated ? (
          <>
            <h1 className={styles.heading}>Your access has been deactivated.</h1>
            <p className={styles.body}>
              Your account is still here, and everything you have authored stays
              in place. An admin in your organisation can restore your access. If
              you think this is a mistake, please contact them.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>Your access is not active.</h1>
            <p className={styles.body}>
              Your account is not connected to an organisation yet. If you were
              invited, ask the admin who invited you to send the invite again. If
              you think this is a mistake, please contact them.
            </p>
          </>
        )}
        <SignOutButton />
      </div>
    </main>
  );
}

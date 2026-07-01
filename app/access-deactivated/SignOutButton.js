'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import styles from './page.module.css';

/**
 * Sign out from the deactivated-access notice. A deactivated user has a valid
 * session but no access, so the one useful action here is to sign out.
 */
export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  return (
    <button type="button" className={styles.signOut} onClick={handleSignOut}>
      Sign out
    </button>
  );
}

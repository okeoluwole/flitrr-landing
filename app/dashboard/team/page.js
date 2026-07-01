import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import DashboardShell from '../../components/DashboardShell';
import TeamManager from './TeamManager';
import styles from './page.module.css';

export const metadata = { title: 'Team' };

// The team state changes as members are invited, promoted, or deactivated, so
// this page is always rendered fresh rather than cached.
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught an unauthenticated user.
  if (!user) {
    redirect('/login');
  }

  // Admin only. A non-admin cannot reach this screen at all.
  const { data: isAdmin } = await supabase.rpc('is_organisation_admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const { data: orgId } = await supabase.rpc('current_user_organisation_id');

  const [orgRes, membersRes, pendingRes, profileRes] = await Promise.all([
    supabase.from('organisations').select('name, seat_limit').eq('id', orgId).single(),
    supabase.rpc('team_members'),
    supabase
      .from('pending_invitations')
      .select('id, email, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ]);

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profileRes.data?.full_name ?? null,
  };

  return (
    <DashboardShell user={navUser} isAdmin>
      <main className={`container ${styles.page}`} id="main-content">
        <TeamManager
          currentUserId={user.id}
          organisationName={orgRes.data?.name ?? 'Your organisation'}
          seatLimit={orgRes.data?.seat_limit ?? 1}
          initialMembers={membersRes.data ?? []}
          initialPending={pendingRes.data ?? []}
        />
      </main>
    </DashboardShell>
  );
}

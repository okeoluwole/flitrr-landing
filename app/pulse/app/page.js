import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../lib/team/access';
import DashboardShell from '../../components/DashboardShell';
import ProjectList from './ProjectList';
import styles from './page.module.css';

/**
 * /pulse/app: the PULSE project dashboard. The signed-in user's launch
 * point for the Project Initiation flow: a "New project" action and a
 * minimal list of the organisation's projects (name, status, current stage),
 * each opening its project workspace when clicked.
 *
 * Deliberately minimal in M3.2. The rich portfolio view is a separate
 * future module, not this sub-step.
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

  // Parallel fetches: profile (for the shell greeting) + the organisation's
  // projects. The Step 2 SELECT policy (024) scopes rows to the caller's
  // organisation, so no creator filter: every member sees every project in
  // their organisation, and the wall keeps other organisations' rows out.
  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('projects')
      .select('id, name, status, current_stage, updated_at')
      .order('updated_at', { ascending: false }),
  ]);

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  const list = projects ?? [];

  // Resolve the viewer's edit access once (Step 3a helpers). Only an admin can
  // start or delete a project, so a member sees neither the New project action
  // nor the draft delete. Creating a project is admin only in the database
  // (the Step 2 tenant rule); this makes the list match that.
  const { canEdit } = await resolveProjectAccess(supabase);

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <div className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>PULSE</p>
            <h1 className={styles.heading}>Your projects</h1>
            <p className={styles.sub}>
              {canEdit
                ? 'Start a new project to run it through PULSE initiation, or pick up a draft where you left off.'
                : 'The projects you have access to. Open one to see its baseline and monitoring.'}
            </p>
          </div>
          {canEdit && (
            <Link href="/pulse/app/initiate" className={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3v10M3 8h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              New project
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyHeading}>No projects yet.</h2>
            {canEdit ? (
              <>
                <p className={styles.emptyBody}>
                  Your first PULSE project starts with the nine-step initiation
                  flow. It defines the baseline that governs every later stage.
                </p>
                <Link href="/pulse/app/initiate" className={styles.emptyCta}>
                  Start your first project
                </Link>
              </>
            ) : (
              <p className={styles.emptyBody}>Only an admin can start a project.</p>
            )}
          </div>
        ) : (
          <ProjectList projects={list} canEdit={canEdit} />
        )}
      </main>
    </DashboardShell>
  );
}

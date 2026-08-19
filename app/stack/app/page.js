import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server.js';
import { resolveProjectAccess } from '../../../lib/team/access.js';
import { listSchemes, schemeSummary } from '../../../lib/stack/schemeStore.js';
import DashboardShell from '../../components/DashboardShell';
import PageHeader from '../../pulse/app/components/PageHeader';
import ViewOnlyBadge from '../../pulse/app/components/ViewOnlyBadge';
import SchemeRegister from './SchemeRegister';
import styles from './stack.module.css';

/**
 * /stack/app: STACK's home, the way /pulse/app is PULSE's home. The two are
 * peer products under one launcher: a developer can start in either, and the
 * platform connects them (a scheme may name the project it appraises, and
 * PULSE's initiation points here where numbers need developing).
 *
 * PULSE's home is its spine register, the projects; STACK's spine is
 * schemes, so its home is the organisation's saved schemes, each opening
 * the appraisal loaded, with "New appraisal" as the primary action. Future
 * STACK features land as siblings under this page, never as second front
 * doors. The appraisal itself lives one level down at /stack/app/appraisal.
 *
 * Auth: the middleware gates the /stack/app prefix, and the page holds the
 * same belt-and-braces redirect as every product surface. An admin saves and
 * deletes; a member reads and can still run an appraisal (running writes
 * nothing).
 */
export default async function StackHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { canEdit, adminContact }, { schemes }] =
    await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      resolveProjectAccess(supabase),
      listSchemes(supabase),
    ]);

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  const list = (schemes ?? []).map(schemeSummary);

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <PageHeader
          eyebrow="STACK"
          title="Your schemes"
          sub={
            canEdit
              ? 'The appraisals your organisation has saved. Open one to pick it up, or run a new one.'
              : 'The appraisals your organisation has saved. Open one to see its numbers, or run your own.'
          }
          badge={!canEdit ? <ViewOnlyBadge adminContact={adminContact} /> : null}
          actions={
            <Link href="/stack/app/appraisal" className={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3v10M3 8h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              New appraisal
            </Link>
          }
        />

        {list.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyHeading}>No saved schemes yet.</h2>
            {canEdit ? (
              <>
                <p className={styles.emptyBody}>
                  A scheme starts as a development appraisal: enter the
                  numbers, run it, and save what stacks up. Saved schemes sit
                  here for the whole organisation.
                </p>
                <Link href="/stack/app/appraisal" className={styles.emptyCta}>
                  Run your first appraisal
                </Link>
              </>
            ) : (
              <p className={styles.emptyBody}>
                Only an admin can save a scheme. You can still run an
                appraisal.
              </p>
            )}
          </div>
        ) : (
          <SchemeRegister schemes={list} canEdit={canEdit} />
        )}
      </main>
    </DashboardShell>
  );
}

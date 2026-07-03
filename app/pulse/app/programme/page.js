import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import DashboardShell from '../../../components/DashboardShell';
import { loadCurrentProgrammeBaseline } from '../components/programmeBaselineStore';
import { loadMetPointsView } from '../components/programmeActualsStore';
import { trackingReady } from './trackingModel';
import ProgrammeTracking from './ProgrammeTracking';
import styles from './ProgrammeTracking.module.css';

/**
 * /pulse/app/programme - the Programme module's tracking home (Phase 3.5).
 *
 * The daily face of the module for a project with a locked operational
 * baseline: the pinned summary band reading the three engines, the colour
 * key, the bounded tolerance dial, and the Overview and Schedule tab shells.
 * Set-up (the one-time on-ramp) lives alongside at /pulse/app/programme/setup;
 * this page is where a developer lands once v1 is locked.
 *
 * What it loads, reads only, mirroring the set-up page's conventions:
 *   - the current baseline wholesale (loadCurrentProgrammeBaseline), the
 *     frozen v1 programme the tracking surface reads and never mutates;
 *   - the met-points view (loadMetPointsView), the single map the engines
 *     read, milestone actuals and passed gates stitched in one keyspace.
 *
 * Today is read here, once, and passed down as an input: the engines never
 * read the clock. The tolerance is session state on the client, handed into
 * the RAG derivation the same way. Nothing here writes to the database.
 *
 * Opened for a project with no baseline, the page points the developer to
 * set-up rather than rendering an empty band. A missing or non-owned project
 * falls back to the project list, as everywhere else.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The no-baseline pointer: the header, a plain reason, and the way to set-up.
function SetUpFirst({ navUser, projectName, workspaceHref, setupHref }) {
  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <Link href={workspaceHref} className={styles.backLink}>
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
          Back to the workspace
        </Link>
        <p className={styles.eyebrow}>Programme / Tracking</p>
        <h1 className={styles.title}>Programme</h1>
        {projectName && <p className={styles.projectName}>{projectName}</p>}
        <div className={`${styles.placeholder} riseIn`}>
          <p className={styles.placeholderLead}>
            Tracking opens once the operational baseline is locked. Run
            Programme set-up to check your dates and lock v1.
          </p>
          <Link href={setupHref} className={styles.cta}>
            Go to Programme set-up
          </Link>
        </div>
      </main>
    </DashboardShell>
  );
}

export default async function ProgrammeTrackingPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  const projectParam =
    typeof searchParams?.project === 'string' ? searchParams.project : null;

  // Tracking is always opened for a specific project. No id, or a malformed
  // one, goes back to the list rather than rendering a broken screen.
  if (!projectParam || !UUID_RE.test(projectParam)) {
    redirect('/pulse/app');
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

  // The project, for its name and the stage position the band's eyebrow
  // carries. RLS scopes it to the viewer's organisation.
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, current_stage')
    .eq('id', projectParam)
    .maybeSingle();

  // Not found, or not visible (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  const workspaceHref = `/pulse/app/workspace?project=${project.id}`;
  const setupHref = `/pulse/app/programme/setup?project=${project.id}`;

  // The two loads this page makes, side by side, plus the viewer's access for
  // the read-only badge. Reads only: this page never writes.
  const [{ baseline }, { view }, { canEdit, adminContact }] = await Promise.all(
    [
      loadCurrentProgrammeBaseline(supabase, project.id),
      loadMetPointsView(supabase, project.id),
      resolveProjectAccess(supabase),
    ]
  );

  // No baseline: point the developer to set-up rather than rendering an
  // empty band. Set-up itself guides further (to the Brief if it is not yet
  // locked).
  if (!trackingReady(baseline)) {
    return (
      <SetUpFirst
        navUser={navUser}
        projectName={project.name}
        workspaceHref={workspaceHref}
        setupHref={setupHref}
      />
    );
  }

  // The clock is read here, once, and handed down. The engines take today as
  // an input and never read the clock themselves, so every figure on the
  // surface derives from the loaded data, this today, and the tolerance.
  const todayIso = new Date().toISOString();

  return (
    <DashboardShell user={navUser}>
      <ProgrammeTracking
        projectName={project.name}
        workspaceHref={workspaceHref}
        baselineVersion={baseline.version}
        baselineLockedAt={baseline.locked_at}
        programme={baseline.programme}
        metView={view ?? {}}
        todayIso={todayIso}
        currentStage={project.current_stage}
        canEdit={canEdit}
        adminContact={adminContact}
      />
    </DashboardShell>
  );
}

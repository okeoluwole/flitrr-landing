import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import DashboardShell from '../../../components/DashboardShell';
import { loadCurrentProgrammeBaseline } from '../components/programmeBaselineStore';
import { loadMetPointsView } from '../components/programmeActualsStore';
import { PAGE_TITLE, PAGE_SUB, BRIEF_NOT_LOCKED } from './dashboardRead';
import ProjectDashboard from './ProjectDashboard';
import styles from './ProjectDashboard.module.css';

/**
 * /pulse/app/dashboard - the Project Dashboard (M9.2 Bands 1 and 2, M9.3
 * Band 3).
 *
 * The objective lens, run continuously: organised by objective, not by
 * module. It owns no data, writes nothing, and re-derives nothing of its
 * own; it reads the same rows and the same frozen baseline the other modules
 * read, runs the same engines, and routes. Band 3 (what needs you now) is the
 * one ranked attention list across the three modules, composed over the same
 * assembly; the workspace tile now opens this finished surface.
 *
 * What it loads, reads only:
 *   - the project (name, stage, and the target completion date Band 1's
 *     forecast fact compares against);
 *   - the objectives, risks, and actions, the same live rows the Risk
 *     register and the Action Log read;
 *   - the CURRENT programme baseline (programme_baselines, superseded_at
 *     null), or null: milestones come ONLY from this frozen snapshot, never
 *     from the dead project_milestones table;
 *   - the met-points view, the single map the Programme engines read.
 *
 * Today is read here, once, and passed down: the engines never read the
 * clock. The tolerance is the Programme surface's default, resolved inside
 * the display model; the dashboard has no dial of its own.
 *
 * Brief not locked: the page does not open. The objectives are set in the
 * Brief, and this page reads through them, so without a locked Brief there
 * is no lens to read.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DashboardPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const projectParam =
    typeof searchParams?.project === 'string' ? searchParams.project : null;

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

  const [{ data: project }, { data: brief }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, current_stage, target_completion_date')
      .eq('id', projectParam)
      .maybeSingle(),
    supabase
      .from('project_briefs')
      .select('is_locked')
      .eq('project_id', projectParam)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Not found, or not visible (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  // Back to the project reaches the WORKSPACE (the route to the modules), and
  // carries ?view=workspace (M9.5). In Run a bare workspace open redirects to
  // this dashboard, so the back-link must ask for the workspace explicitly; the
  // workspace redirect respects view=workspace and stays put. That is what makes
  // the pair loop-safe: dashboard -> workspace (explicit) -> stays on workspace.
  const workspaceHref = `/pulse/app/workspace?project=${project.id}&view=workspace`;

  const Header = (
    <>
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
        Back to the project
      </Link>
      <p className={styles.eyebrow}>Dashboard module</p>
      <h1 className={styles.title}>{PAGE_TITLE}</h1>
      <p className={styles.projectName}>{project.name}</p>
      <p className={styles.sub}>{PAGE_SUB}</p>
    </>
  );

  // Brief not locked: the page does not open.
  if (brief?.is_locked !== true) {
    return (
      <DashboardShell user={navUser}>
        <main className={`container ${styles.page}`} id="main-content">
          {Header}
          <div className={styles.locked}>
            <p className={styles.lockedText}>{BRIEF_NOT_LOCKED}</p>
            <Link
              href={`/pulse/app/initiate?project=${project.id}`}
              className={styles.lockedCta}
            >
              Go to the Brief
            </Link>
          </div>
        </main>
      </DashboardShell>
    );
  }

  // The reads. The same rows the Risk register and the Action Log load, the
  // current frozen baseline, and the met-points view. Reads only: this page,
  // and everything under it, never writes.
  const [
    { data: objectives },
    { data: risks },
    { data: actions },
    { baseline },
    { view },
  ] = await Promise.all([
    supabase
      .from('project_objectives')
      .select('id, objective_type, classification')
      .eq('project_id', project.id),
    supabase
      .from('project_risks')
      .select(
        'id, description, linked_objective_id, likelihood, impact, status, last_reviewed_at, response_note, updated_at'
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_actions')
      .select(
        'id, description, linked_objective_id, criticality_override, status, stage, source, source_id, reason'
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    loadCurrentProgrammeBaseline(supabase, project.id),
    loadMetPointsView(supabase, project.id),
  ]);

  // The clock is read here, once, and handed down. The engines take today as
  // an input and never read it themselves.
  const todayIso = new Date().toISOString();

  return (
    <DashboardShell user={navUser}>
      <ProjectDashboard
        projectId={project.id}
        projectName={project.name}
        workspaceHref={workspaceHref}
        objectives={objectives ?? []}
        risks={risks ?? []}
        actions={actions ?? []}
        programme={baseline?.programme ?? null}
        metView={view ?? {}}
        todayIso={todayIso}
        currentStage={project.current_stage}
        targetCompletionDate={project.target_completion_date ?? null}
      />
    </DashboardShell>
  );
}

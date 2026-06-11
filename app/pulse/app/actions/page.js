import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import DashboardShell from '../../../components/DashboardShell';
import { OBJECTIVE_META } from '../components/objectiveMeta';
import ActionLog from './ActionLog';
import styles from './ActionLog.module.css';

/**
 * /pulse/app/actions - the Action Log manual substrate (M7.1).
 *
 * The log where the developer records and tracks critical actions by hand:
 * logged inline, sorted critical-first, moved through to_do / doing / done
 * with one tap, and deletable behind a confirm for mistaken entries. Manual
 * only: the aggregation feed from the other modules is M7.2, and the
 * notification layer is M7.3.
 *
 * Availability mirrors the Risk register's baseline-read pattern: the log
 * opens only once the gate has committed the baseline, so the section is
 * gated on current_stage being Stage 2 or beyond. A direct visit before then
 * shows the open-at-Stage-2 note rather than the log.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STAGE_2 = 2;

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

export default async function ActionsPage({ searchParams }) {
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

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, current_stage')
    .eq('id', projectParam)
    .maybeSingle();

  // Not found, or not owned (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  const workspaceHref = `/pulse/app/workspace?project=${project.id}`;

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
      <p className={styles.eyebrow}>Action Log module</p>
      <h1 className={styles.title}>Action Log</h1>
      <p className={styles.projectName}>{project.name}</p>
    </>
  );

  // Stage gate: the log opens at Stage 2. Below that, show the note.
  if (project.current_stage < STAGE_2) {
    return (
      <DashboardShell user={navUser}>
        <main className={`container ${styles.page}`} id="main-content">
          {Header}
          <div className={styles.locked}>
            <p className={styles.lockedText}>
              The Action Log opens once you pass the gate into Stage 2.
            </p>
            <Link href={workspaceHref} className={styles.lockedCta}>
              Back to the project
            </Link>
          </div>
        </main>
      </DashboardShell>
    );
  }

  // The logged actions (newest first; the log's sort keeps that within each
  // criticality band) and the objectives an action can be linked to.
  const [{ data: actions }, { data: objectives }] = await Promise.all([
    supabase
      .from('project_actions')
      .select(
        'id, description, linked_objective_id, criticality, status, note, created_at'
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_objectives')
      .select('id, objective_type, classification')
      .eq('project_id', project.id),
  ]);

  // The five objectives in canonical order (Scope, Cost, Time, Quality,
  // Funding), shaped for the link select and the cascade: id, display name,
  // classification.
  const byType = Object.fromEntries(
    (objectives ?? []).map((o) => [o.objective_type, o])
  );
  const objectiveOptions = OBJECTIVE_META.map((m) => {
    const row = byType[m.type];
    return row
      ? { id: row.id, name: m.name, classification: row.classification }
      : null;
  }).filter(Boolean);

  return (
    <DashboardShell user={navUser}>
      <ActionLog
        projectId={project.id}
        projectName={project.name}
        workspaceHref={workspaceHref}
        initialActions={actions ?? []}
        objectives={objectiveOptions}
      />
    </DashboardShell>
  );
}

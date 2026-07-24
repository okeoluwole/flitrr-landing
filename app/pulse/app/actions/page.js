import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import DashboardShell from '../../../components/DashboardShell';
import { OBJECTIVE_META } from '../components/objectiveMeta';
import { deriveProposals } from '../../../../lib/playbook/playbookModel';
import { buildObjectiveIndex } from '../../../../lib/engine/criticality';
import ActionLog from './ActionLog';
import { readSequence } from '../components/sequenceRead';
import styles from './ActionLog.module.css';

/**
 * /pulse/app/actions - the Action Log, the central attention home (M7.1 +
 * M7.2 + M7.4).
 *
 * The log where the developer records and tracks critical actions: logged
 * inline, sorted critical-first, moved through to_do / doing / done with one
 * tap, and deletable behind a confirm for mistaken entries. M7.2 adds the
 * aggregation feed: risk-derived items computed live from project_risks
 * (never stored), surfaced in the needs-your-response band and promoted to
 * tracked actions with one tap. M7.4 adds the PULSE suggests band below it:
 * curated action plays for the project's current stage, derived critical or
 * standard by the project's own objective classification, accepted into the
 * log or dismissed with one tap. The notification layer is M7.3.
 *
 * Availability follows the fixed sequence (Note 13): the Action Log is one of
 * the three monitoring modules, and all three open together, once Programme
 * set-up has locked the operational baseline and the gate has been confirmed.
 * The log reads the baseline like its siblings, and its needs-your-response
 * band would otherwise compute a queue against a baseline that does not exist:
 * the end-to-end test saw exactly that, "14 need your response" before set-up
 * had ever run. A direct visit before then shows the sequence's honest line,
 * the same string the workspace tile carries.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Back to the workspace launcher, carrying view=workspace so in Run it reaches
  // the launcher (to hop to another module) instead of being redirected to the
  // dashboard, the same loop-safe param the dashboard back-link uses (M9.5a).
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
        Back to the workspace
      </Link>
      <p className={styles.eyebrow}>Action Log module</p>
      <h1 className={styles.title}>Action Log</h1>
      <p className={styles.projectName}>{project.name}</p>
    </>
  );

  // The sequence gate (Note 13): the three monitoring modules open together,
  // once the operational baseline is locked and the gate is confirmed. Until
  // then, show the sequence's honest line naming the step that opens it.
  const sequence = await readSequence(supabase, project.id, project.current_stage);
  if (!sequence.modulesOpen) {
    return (
      <DashboardShell user={navUser}>
        <main className={`container ${styles.page}`} id="main-content">
          {Header}
          <div className={styles.locked}>
            <p className={styles.lockedText}>{sequence.lockedLine}</p>
            <Link href={workspaceHref} className={styles.lockedCta}>
              Back to the workspace
            </Link>
          </div>
        </main>
      </DashboardShell>
    );
  }

  // The logged actions (newest first; the log's sort keeps that within each
  // criticality band), the objectives an action can be linked to, the live
  // register rows the needs-your-response band derives from, and the
  // playbook surface: the curated action plays for this stage (ordered by
  // slug, the stable tiebreak under the criticality sort) plus the pairs
  // this project has already acted on. The risk read is non-destructive:
  // the band computes items from these rows and never writes back (status
  // changes happen in the register).
  const RAID_COLUMNS = 'id, description, linked_objective_id, criticality, updated_at';

  const [
    { data: actions },
    { data: objectives },
    { data: risks },
    { data: plays },
    { data: playStates },
    { data: assumptions },
    { data: constraints },
    { data: dependencies },
  ] = await Promise.all([
    supabase
      .from('project_actions')
      .select(
        'id, description, linked_objective_id, criticality, criticality_override, override_reason, stage, reason, outcome, variance, status, note, source, source_id, created_at'
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_objectives')
      .select('id, objective_type, classification')
      .eq('project_id', project.id),
    supabase
      .from('project_risks')
      .select(
        'id, description, linked_objective_id, criticality, likelihood, impact, status, updated_at'
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('playbook_plays')
      .select('id, slug, type, stage, title, why, objective, always_critical')
      .eq('stage', project.current_stage)
      .eq('type', 'action')
      .order('slug', { ascending: true }),
    supabase
      .from('project_playbook_state')
      .select('play_id')
      .eq('project_id', project.id),
    supabase
      .from('project_assumptions')
      .select(RAID_COLUMNS)
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_constraints')
      .select(RAID_COLUMNS)
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_dependencies')
      .select(RAID_COLUMNS)
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
  ]);

  // The project's objectives indexed by type, from the engine kernel (A3), for
  // the playbook proposals and the link options below. The five objectives in
  // canonical order (Scope, Cost, Time, Quality, Funding) are then shaped for
  // the link select and the cascade: id, display name, classification.
  const { byType } = buildObjectiveIndex(objectives ?? [], NAME_BY_TYPE);
  const objectiveOptions = OBJECTIVE_META.map((m) => {
    const row = byType[m.type];
    return row
      ? { id: row.id, name: m.name, classification: row.classification }
      : null;
  }).filter(Boolean);

  // The PULSE suggests proposals (M7.4): stage-keyed action plays not yet
  // accepted or dismissed, each derived critical or standard by this
  // project's own classification.
  const playSuggestions = deriveProposals({
    plays: plays ?? [],
    states: playStates ?? [],
    currentStage: project.current_stage,
    type: 'action',
    objectivesByType: byType,
  });

  // Resolve the viewer's edit access once (Step 3a helpers). An admin logs and
  // tracks actions as before; a member sees the log read-only with the View
  // only badge.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);

  return (
    <DashboardShell user={navUser}>
      <ActionLog
        projectId={project.id}
        projectName={project.name}
        workspaceHref={workspaceHref}
        registerHref={`/pulse/app/risk?project=${project.id}`}
        currentStage={project.current_stage}
        initialActions={actions ?? []}
        objectives={objectiveOptions}
        risks={risks ?? []}
        assumptions={assumptions ?? []}
        constraints={constraints ?? []}
        dependencies={dependencies ?? []}
        playSuggestions={playSuggestions}
        canEdit={canEdit}
        adminContact={adminContact}
      />
    </DashboardShell>
  );
}

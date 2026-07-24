import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import DashboardShell from '../../../components/DashboardShell';
import { OBJECTIVE_META } from '../components/objectiveMeta';
import { deriveProposals } from '../../../../lib/playbook/playbookModel';
import RiskRegister from './RiskRegister';
import { readSequence } from '../components/sequenceRead';
import styles from './RiskRegister.module.css';

/**
 * /pulse/app/risk - the Risk module register (M6.1 + M7.4).
 *
 * The living risk register: the project's risks, scored in plain language,
 * given a status and a one-line response, reviewed, and closed. It reads the
 * live project_risks rows (the same rows the wizard captured), not the frozen
 * Brief snapshot, because it is a working surface.
 *
 * M7.4 adds the suggestions area: curated risk plays for the project's
 * current stage, derived critical or standard by the project's own objective
 * classification, added to the register or dismissed with one tap. An
 * accepted play becomes an ordinary project_risks row (not yet reviewed) and
 * behaves as any risk from there.
 *
 * Availability follows the fixed sequence (Note 13): the register is one of the
 * three monitoring modules, and all three open together, once Programme set-up
 * has locked the operational baseline and the gate has been confirmed. That is
 * the module pattern made structural: a monitoring module reads the baseline,
 * so before the baseline exists there is nothing to read and any count it showed
 * would be invented. A direct visit before then shows the sequence's own honest
 * line, the same string the workspace tile carries (sequenceRead), so the tile
 * and this guard can never disagree.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

export default async function RiskPage({ searchParams }) {
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

  // The project. current_stage is read for the playbook query below, and it is
  // also what the sequence read measures the gate decision against.
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, current_stage')
    .eq('id', projectParam)
    .maybeSingle();

  // Not found, or not owned (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  // Where the project sits on the fixed path (Note 13). The same derivation the
  // workspace tile uses.
  const sequence = await readSequence(supabase, project.id, project.current_stage);

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
      <p className={styles.eyebrow}>Risk module</p>
      <h1 className={styles.title}>Risk register</h1>
      <p className={styles.projectName}>{project.name}</p>
    </>
  );

  // The sequence gate (Note 13): the three monitoring modules open together,
  // once the operational baseline is locked and the gate is confirmed. Until
  // then, show the sequence's honest line, the one the workspace tile shows too.
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

  // The living register rows, the objectives they link to, and the playbook
  // surface: the curated risk plays for this stage (ordered by slug, the
  // stable tiebreak under the criticality sort) plus the pairs this project
  // has already acted on. Risks oldest first, a stable base order the
  // register's sort keeps for ties.
  const [{ data: risks }, { data: objectives }, { data: plays }, { data: playStates }] =
    await Promise.all([
      supabase
        .from('project_risks')
        .select(
          'id, description, criticality, linked_objective_id, likelihood, impact, status, last_reviewed_at, response_note'
        )
        .eq('project_id', project.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_objectives')
        .select('id, objective_type, classification')
        .eq('project_id', project.id),
      supabase
        .from('playbook_plays')
        .select('id, slug, type, stage, title, why, objective, always_critical')
        .eq('stage', project.current_stage)
        .eq('type', 'risk')
        .order('slug', { ascending: true }),
      supabase
        .from('project_playbook_state')
        .select('play_id')
        .eq('project_id', project.id),
    ]);

  // Map each objective id to the name and classification the register shows
  // for "the objective it threatens".
  const objectivesById = {};
  for (const o of objectives ?? []) {
    objectivesById[o.id] = {
      name: NAME_BY_TYPE[o.objective_type] ?? o.objective_type,
      classification: o.classification,
    };
  }

  // The suggestions area's proposals (M7.4): stage-keyed risk plays not yet
  // accepted or dismissed, each derived critical or standard by this
  // project's own classification.
  const byType = Object.fromEntries(
    (objectives ?? []).map((o) => [o.objective_type, o])
  );
  const playSuggestions = deriveProposals({
    plays: plays ?? [],
    states: playStates ?? [],
    currentStage: project.current_stage,
    type: 'risk',
    objectivesByType: byType,
  });

  // The monitor (lib/engine/monitor.js) reads the clock from its caller, never
  // itself, so the server supplies it once (B2). The register derives each
  // risk's verdict from this and the live rows, so the needs-attention surface
  // and the list judge time the same way and cannot drift on hydration.
  const now = Date.now();

  // Resolve the viewer's edit access once (Step 3a helpers). An admin edits as
  // before; a member sees the register read-only with the View only badge.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);

  return (
    <DashboardShell user={navUser}>
      <RiskRegister
        projectId={project.id}
        projectName={project.name}
        workspaceHref={workspaceHref}
        initialRisks={risks ?? []}
        objectivesById={objectivesById}
        playSuggestions={playSuggestions}
        now={now}
        canEdit={canEdit}
        adminContact={adminContact}
      />
    </DashboardShell>
  );
}

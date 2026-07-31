import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../../lib/team/access';
import DashboardShell from '../../../../components/DashboardShell';
import { loadProgrammeChoices } from '../../components/programmeChoices';
import { loadCurrentProgrammeBaseline } from '../../components/programmeBaselineStore';
import { PROGRAMME_TEMPLATE } from '../../../../../lib/engine/programmeTemplate.js';
import { deriveStageStates } from '../../../../../lib/engine/stageStates.js';
import ProgrammeSetup from './ProgrammeSetup';
import PageHeader from '../../components/PageHeader';
import styles from './ProgrammeSetup.module.css';

/**
 * /pulse/app/programme/setup - the Programme set-up flow's entry (Phase 1.2).
 *
 * Set-up runs once, at the moment the Brief locks. This server component loads
 * the locked programme and hands plain inputs to the client flow, which runs
 * the reality-check engine and either renders the reconcile-dates screen or, if
 * nothing is flagged, skips it.
 *
 * What it loads:
 *   - the project start date (projects.start_date), the anchor the Brief's
 *     advised dates already derive from, and the anchor the reality check needs;
 *   - the developer's hand-set programme choices (loadProgrammeChoices, the
 *     gates and headline milestones the developer dated during initiation);
 *   - the two baseline values the stage states derive from, the project country
 *     (projects.country) and the funding structure
 *     (project_budget.funding_structure_type). The states are derived here, on
 *     the server, so the reality check and the assembly measure a concurrent
 *     stage from the same window start the Brief's Step 7 did. Plain data, so
 *     they cross to the client component as they are.
 *
 * It reads only. Nothing here writes to the database: no resolutions, no agreed
 * dates, no v1. v1 is produced at lock, in Phase 2. Reachability mirrors the
 * gate: the set-up is only available once a baseline is locked, and a direct
 * visit before lock, or to a missing or non-owned project, falls back
 * gracefully rather than erroring.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function present(v) {
  return v != null && String(v).trim() !== '';
}

// A small not-ready surface, mirroring the gate's: the header, a plain reason,
// and a link back to the Brief.
function NotReady({ navUser, projectName, briefHref, message }) {
  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <PageHeader
          back={{ href: briefHref, label: 'Back to the brief' }}
          eyebrow="Programme / Set up"
          title="Reconcile dates"
          projectName={projectName || null}
        />
        <div className={`${styles.placeholder} riseIn`}>
          <p className={styles.placeholderLead}>{message}</p>
          <Link href={briefHref} className={styles.cta}>
            Go to the Brief
          </Link>
        </div>
      </main>
    </DashboardShell>
  );
}

export default async function ProgrammeSetupPage({ searchParams }) {
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

  // Set-up is always opened for a specific project. No id, or a malformed one,
  // goes back to the list rather than rendering a broken screen.
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

  // The project (its start date) and the latest brief row (for the lock state).
  // RLS scopes both to the owner.
  const [{ data: project }, { data: brief }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, start_date, target_completion_date, country, entry_stage')
      .eq('id', projectParam)
      .maybeSingle(),
    supabase
      .from('project_briefs')
      .select('id, version, is_locked, content')
      .eq('project_id', projectParam)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Not found, or not owned (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  const briefHref = `/pulse/app/initiate?project=${project.id}`;
  const locked = brief?.is_locked === true;

  // Set-up runs once the Brief has locked. Before that it is not yet reachable;
  // point back to the Brief to lock it.
  if (!locked) {
    return (
      <NotReady
        navUser={navUser}
        projectName={project.name}
        briefHref={briefHref}
        message="Lock the Brief to begin Programme set-up."
      />
    );
  }

  // The reality check needs the project start as its anchor. A locked Brief
  // should carry one, but guard so a missing start points back rather than
  // throwing.
  if (!present(project.start_date)) {
    return (
      <NotReady
        navUser={navUser}
        projectName={project.name}
        briefHref={briefHref}
        message="Set a project start date in the Brief to run Programme set-up."
      />
    );
  }

  // The inputs the review and lock need, read alongside the programme choices:
  //   - the developer's hand-set programme choices (reconcile reads these);
  //   - the project's objective rows for the criticality join the assembly bakes;
  //   - the current baseline, if the project already has one, which makes this an
  //     already-locked re-entry rather than a fresh lock.
  // The locked Brief's content (its programme record set) and the project's
  // Step 1 target completion were read above: they feed the lock-time
  // reconciliation check, which compares v1 against the locked record and the
  // target before any lock is allowed.
  // Reads only: this server component never writes. The lock is a confirmed
  // action in the client, written through the store.
  const [
    { choices },
    { data: objectives },
    { baseline: currentBaseline },
    { data: budget },
  ] = await Promise.all([
    loadProgrammeChoices(supabase, project.id),
    supabase
      .from('project_objectives')
      .select('id, objective_type, classification')
      .eq('project_id', project.id),
    loadCurrentProgrammeBaseline(supabase, project.id),
    // maybeSingle: a project predating migration 015 has no seeded budget row,
    // which is not an error. No funding structure simply triggers nothing.
    supabase
      .from('project_budget')
      .select('funding_structure_type')
      .eq('project_id', project.id)
      .maybeSingle(),
  ]);

  // The stage states, read off the baseline: Sales and Disposal runs concurrent
  // for an off-plan or Nigeria scheme, so its window opens at sales launch
  // rather than at the completion gate. Derived once here and threaded into
  // both engines, so set-up measures the stage exactly as Step 7 did.
  const stageStates = deriveStageStates(PROGRAMME_TEMPLATE, {
    country: project.country,
    fundingStructureType: budget?.funding_structure_type,
    // The declared entry stage (Note 12): stages before it were complete
    // before the project entered PULSE. The reality check raises no items for
    // them and the assembly derives nothing in them; their backfilled dates
    // are recorded fact.
    entryStage: project.entry_stage,
  });

  // The already-locked record, if a current baseline exists, with the locker's
  // name resolved for the read-only state. lockerName for a fresh lock is the
  // current user, who is the one locking.
  let existingBaseline = null;
  if (currentBaseline) {
    let lockedByName = null;
    if (currentBaseline.locked_by) {
      const { data: lockerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentBaseline.locked_by)
        .maybeSingle();
      lockedByName = lockerProfile?.full_name ?? null;
    }
    existingBaseline = {
      version: currentBaseline.version,
      lockedAt: currentBaseline.locked_at,
      lockerName: lockedByName,
    };
  }

  const workspaceHref = `/pulse/app/workspace?project=${project.id}`;

  // Resolve the viewer's edit access once (Step 3a helpers). Set-up is an admin
  // authoring action (it locks v1). A member sees the already-locked baseline
  // read-only, or a sparse line when no baseline exists yet.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);

  return (
    <DashboardShell user={navUser}>
      <ProgrammeSetup
        projectName={project.name}
        workspaceHref={workspaceHref}
        projectStart={project.start_date}
        stageStates={stageStates}
        choices={choices ?? { stages: [] }}
        projectId={project.id}
        objectives={objectives ?? []}
        sourceBriefId={brief?.id ?? null}
        briefProgramme={brief?.content?.programme ?? null}
        targetCompletionDate={project.target_completion_date ?? null}
        userId={user.id}
        lockerName={navUser.full_name ?? null}
        existingBaseline={existingBaseline}
        country={project.country}
        canEdit={canEdit}
        adminContact={adminContact}
      />
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import DashboardShell from '../../../components/DashboardShell';
import { loadCurrentProgrammeBaseline } from '../components/programmeBaselineStore';
import GateReview from './GateReview';
import styles from './GateReview.module.css';

/**
 * /pulse/app/gate - the Gate 1 to 2 review screen (M5).
 *
 * The deliberate go decision that advances a project from Stage 1 (Objectives
 * and Funding) to Stage 2 (Consultant Appointment). It is a distinct screen,
 * not a wizard step, because it evaluates the committed, locked baseline
 * rather than the wizard's live working data.
 *
 * This server component loads everything fresh and computes the two live
 * checks, then hands plain values to GateReview (the interactive client):
 *   - funding structure present  -> a live read of projects.funding_structure
 *   - over-constrained           -> read from the locked brief snapshot
 *                                   (content.objectives.counts.flexible === 0),
 *                                   the same determination the brief baked at
 *                                   lock. No second calculation is made here.
 *
 * Reachability follows the fixed sequence (Note 13). The gate now comes AFTER
 * Programme set-up: the Brief must be locked AND the operational baseline must
 * be locked before it opens. That is not sequencing for its own sake. A gate has
 * two parts, and the second is the objective lens: do the classified objectives
 * remain achievable, and has anything put a non-negotiable objective at risk.
 * That question cannot be answered honestly on unreconciled dates. Set-up is
 * what turns the Brief's targets into an operational baseline, so the lens is
 * only credible once it has run. A direct visit before either lock, or to a
 * missing or non-owned project, falls back gracefully rather than erroring.
 *
 * Only the gate's POSITION moves here. Its checklist, the Named authority
 * reconciliation and the no-go path are a later session, and its content is
 * untouched by this change.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Stage 1 to 2 transition is recorded on the stage = 1 gate row (the row
// for the stage being closed). Stage 2 is the value current_stage advances to.
const GATE_FROM_STAGE = 1;
const STAGE_2 = 2;

// Read the over-constraint state from the locked snapshot. The brief bakes the
// objective counts at lock; no flexible objective is the over-constrained
// case (framework Section 6). Falls back to the snapshot's flexible array if
// the counts shape is ever absent, so the gate always agrees with the brief.
function readOverConstrained(content) {
  const flexCount = content?.objectives?.counts?.flexible;
  if (typeof flexCount === 'number') return flexCount === 0;
  const flexArr = content?.objectives?.flexible;
  if (Array.isArray(flexArr)) return flexArr.length === 0;
  return false;
}

function present(v) {
  return v != null && String(v).trim() !== '';
}

export default async function GatePage({ searchParams }) {
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

  // The gate is always opened for a specific project. No id, or a malformed
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

  // The project (live funding structure + current stage), the latest brief row
  // (for the lock state and the baked over-constraint state), the Gate 1 to 2
  // row (for the recorded decision), and the current programme baseline (the
  // operational baseline the gate now comes after). RLS scopes all four.
  const [{ data: project }, { data: brief }, { data: gateRow }, { baseline }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, current_stage, funding_structure')
        .eq('id', projectParam)
        .maybeSingle(),
      supabase
        .from('project_briefs')
        .select('content, is_locked, version')
        .eq('project_id', projectParam)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('project_stage_gates')
        .select('gate_status, passed_at, decided_by, over_constraint_acknowledged')
        .eq('project_id', projectParam)
        .eq('stage', GATE_FROM_STAGE)
        .maybeSingle(),
      loadCurrentProgrammeBaseline(supabase, projectParam),
    ]);

  // Not found, or not owned (RLS filtered it out).
  if (!project) {
    redirect('/pulse/app');
  }

  const briefHref = `/pulse/app/initiate?project=${project.id}`;
  const setupHref = `/pulse/app/programme/setup?project=${project.id}`;
  const locked = brief?.is_locked === true;
  const baselineLocked = baseline != null;
  const alreadyPassed =
    project.current_stage >= STAGE_2 || gateRow?.gate_status === 'passed';

  // Not yet reachable on the sequence (and not already advanced): the gate comes
  // after the Brief lock AND after Programme set-up. Say which step is still
  // outstanding and point at it, rather than showing a checklist that cannot be
  // answered honestly yet.
  const notReady = !alreadyPassed && (!locked || !baselineLocked);
  if (notReady) {
    const target = locked ? setupHref : briefHref;
    return (
      <DashboardShell user={navUser}>
        <main className={`container ${styles.page}`} id="main-content">
          <Link href={target} className={styles.backLink}>
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
            {locked ? 'Back to Programme set-up' : 'Back to the brief'}
          </Link>
          <p className={styles.eyebrow}>Stage 1 to 2 gate</p>
          <h1 className={styles.title}>
            Gate 1 to 2: Objectives and Funding to Consultant Appointment
          </h1>
          <div className={styles.notAvailable}>
            <p className={styles.notAvailableText}>
              {locked
                ? 'Lock your operational baseline in Programme set-up to open the Stage 1 to 2 gate. The gate asks whether your objectives remain achievable, and that needs reconciled dates.'
                : 'Lock the Brief, then run Programme set-up, to open the Stage 1 to 2 gate.'}
            </p>
            <Link href={target} className={styles.notAvailableCta}>
              {locked ? 'Go to Programme set-up' : 'Go to the Brief'}
            </Link>
          </div>
        </main>
      </DashboardShell>
    );
  }

  const overConstrained = readOverConstrained(brief?.content);
  const fundingPresent = present(project.funding_structure);

  // Resolve the viewer's edit access once (Step 3a helpers). Confirming the gate
  // is an admin action; a member sees the checklist read-only with the View
  // only badge, or the recorded decision if it has already passed.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);

  // The recorded decision, for the already-passed read-only view. An admin who
  // confirms the gate is named as the decider; a member cannot read another
  // person's profile name (own-row-only) and is not the decider, so their view
  // names no one rather than mislabelling the decision with their own name.
  const deciderName = canEdit ? navUser.full_name ?? navUser.email : null;
  const decision = alreadyPassed
    ? {
        passedAt: gateRow?.passed_at ?? null,
        deciderName,
        overConstraintAcknowledged:
          gateRow?.over_constraint_acknowledged === true,
      }
    : null;

  return (
    <DashboardShell user={navUser}>
      <GateReview
        projectId={project.id}
        userId={user.id}
        projectName={project.name}
        briefHref={briefHref}
        fundingPresent={fundingPresent}
        overConstrained={overConstrained}
        decision={decision}
        deciderName={deciderName}
        canEdit={canEdit}
        adminContact={adminContact}
      />
    </DashboardShell>
  );
}

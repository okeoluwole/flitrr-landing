import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import { buildObjectiveIndex } from '../../../../lib/engine/criticality';
import { assessRisks } from '../../../../lib/engine/monitor';
import DashboardShell from '../../../components/DashboardShell';
import ViewOnlyBadge from '../components/ViewOnlyBadge';
import {
  deriveResponseFeed,
  formatActionLogSummary,
} from '../actions/actionFeed';
import {
  loadTriageDecisions,
  dismissedItemKeys,
} from '../actions/triageDecisionStore';
import { isCritical, isDone } from '../actions/actionModel';
import { programmeTileTarget } from '../programme/trackingModel';
import { loadCurrentProgrammeBaseline } from '../components/programmeBaselineStore';
import { loadMetPointsView } from '../components/programmeActualsStore';
import { deriveDashboard } from '../dashboard/dashboardModel';
import { PAGE_SUB, ladderTileLine } from '../dashboard/dashboardRead';
import { derivePhase, deriveLanding, PHASE_INTRO, SURFACES } from './phaseModel';
import {
  SEQUENCE_STEPS,
  deriveGateConfirmed,
  deriveSequenceStep,
  deriveModuleStates,
  modulesOpen,
  moduleLockedLine,
  nextStep,
  stepHref,
} from './sequenceModel';
import styles from './Workspace.module.css';

/**
 * /pulse/app/workspace - the project workspace.
 *
 * A project's home: a header with its current stage, the SINGLE NEXT STEP, then
 * the Brief as the keystone panel and the monitoring modules as one seated
 * register of rows.
 *
 * THE FIXED SEQUENCE (Note 13, sequenceModel.js). After the Brief locks, this is
 * not an open tile hub: a project runs one ordered path, Brief, then Programme
 * set-up and the operational baseline lock, then the gate, then the modules.
 * The workspace leads with whichever of those is current and states the whole
 * order beneath it, so nothing about what comes next is left to inference.
 *
 * The three monitoring modules (Action Log, Risk register, Project dashboard)
 * open together, on the last step. All three read the operational baseline (the
 * module pattern: read the baseline, derive criticality from the objective
 * served, flag proportionally), so before that baseline exists there is nothing
 * for them to read and a module that rendered anyway would have to invent its
 * numbers. The end-to-end test caught exactly that: "14 need your response" and
 * a compromised banner, both before Programme set-up had run. Until they open,
 * each carries one honest line naming the step that opens it, and no count, no
 * alarm state and no queue is computed at all.
 *
 * The Programme row is not one of the three: it IS the set-up step, so it opens
 * at the Brief lock and routes to set-up or to tracking through
 * programmeTileTarget.
 *
 * The PHASE (M9.4, phaseModel.js) still derives the intro line and the landing
 * decision from the same two locks. The sequence governs what is open; the phase
 * governs how the workspace speaks and where a project lands.
 *
 * The Action Log row sits first (M7.2): it is the central attention home,
 * and its footer is the live read of what needs the developer, counts of
 * items needing a response (actionFeed's trigger rule) and open critical
 * tracked actions, or the calm all-quiet line when there is nothing. The
 * read's tone honours the amber discipline: amber only when open critical
 * actions exist, full ink when something needs a response, quiet otherwise.
 *
 * The Risk register row footer is the same kind of live read (B2): the count
 * of risks the monitor flags (lib/engine/monitor.js, assessRisks), so the row
 * and the register's Needs attention panel agree, or a calm line when nothing
 * is flagged. Cadence attention is not criticality, so this read peaks at
 * full ink and never takes the amber.
 *
 * This is the launcher the modules are reached from, so each new module
 * becomes another row in the register rather than another scattered link.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lifecycle stage names (framework Section 4), for the stage chip.
const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

function BriefIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4M9 12.5h6M9 16h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.5v4M12 15.5v.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActionLogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 12.2l2.5 2.5 4.7-5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgrammeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="7" r="1.6" fill="currentColor" />
      <circle cx="14" cy="12" r="1.6" fill="currentColor" />
      <circle cx="10" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M5 5h6v5H5zM13 5h6v5h-6zM5 14h6v5H5zM13 14h6v5h-6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 3l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3.25"
        y="7"
        width="9.5"
        height="6.25"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// One module row. `state` is 'open' (a link), 'locked' (gated, with a note),
// or 'soon' (a later milestone). Only an open row is interactive. `tone` sets
// how loudly the footer read speaks: 'calm' stays secondary, 'alert' steps up
// to full ink, and 'critical' takes the amber text tone, the register's one
// amber spend (amber means criticality, nothing else).
function ModuleRow({ icon, title, desc, footer, tone = 'calm', state, href }) {
  const footClass =
    tone === 'critical'
      ? `${styles.rowFoot} ${styles.footCritical}`
      : tone === 'alert'
        ? `${styles.rowFoot} ${styles.footAlert}`
        : styles.rowFoot;

  const body = (
    <>
      <span className={styles.rowIcon}>{icon}</span>
      <div className={styles.rowMain}>
        <h2 className={styles.rowTitle}>{title}</h2>
        <p className={styles.rowDesc}>{desc}</p>
        <p className={footClass}>{footer}</p>
      </div>
    </>
  );

  if (state === 'open') {
    return (
      <Link href={href} className={`${styles.row} ${styles.rowOpen}`}>
        {body}
        <span className={styles.rowAside}>
          <ChevronGlyph />
        </span>
      </Link>
    );
  }

  return (
    <div
      className={`${styles.row} ${state === 'locked' ? styles.rowLocked : styles.rowSoon}`}
      aria-disabled="true"
    >
      {body}
      {state === 'locked' && (
        <span className={styles.rowAside}>
          <LockGlyph />
        </span>
      )}
    </div>
  );
}

// The sequence stated plainly, with the current step marked. The order is fixed,
// so showing it costs one line and removes every guess about what comes next.
const TRAIL = [
  { step: SEQUENCE_STEPS.BRIEF, label: 'Brief' },
  { step: SEQUENCE_STEPS.PROGRAMME_SETUP, label: 'Programme set-up' },
  { step: SEQUENCE_STEPS.GATE, label: 'Gate' },
  { step: SEQUENCE_STEPS.MODULES, label: 'Modules' },
];

function SequenceTrail({ step }) {
  const nowIndex = TRAIL.findIndex((t) => t.step === step);
  return (
    <ol className={styles.trail}>
      {TRAIL.map((entry, i) => (
        <li key={entry.step} className={styles.trailStep}>
          <span
            className={
              i === nowIndex
                ? styles.trailNow
                : i < nowIndex
                  ? styles.trailDone
                  : styles.trailStep
            }
            aria-current={i === nowIndex ? 'step' : undefined}
          >
            {entry.label}
          </span>
          {i < TRAIL.length - 1 && (
            <span className={styles.trailSep} aria-hidden="true">
              {' / '}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default async function WorkspacePage({ searchParams }) {
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

  // The project (with the target completion date the dashboard state reads),
  // its latest brief lock state (to label the Brief tile), the current programme
  // baseline, and the project's passed gate rows. The full baseline is loaded,
  // not just its id: it routes the Programme tile (present or not) and feeds the
  // dashboard tile's state. The gate rows are read as a set, by stage, so the
  // sequence's gate check needs no stage constant of its own.
  const [{ data: project }, { data: brief }, { baseline }, { data: passedGates }] =
    await Promise.all([
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
      loadCurrentProgrammeBaseline(supabase, projectParam),
      supabase
        .from('project_stage_gates')
        .select('stage')
        .eq('project_id', projectParam)
        .eq('gate_status', 'passed'),
    ]);

  if (!project) {
    redirect('/pulse/app');
  }

  // The phase, derived once (phaseModel.js) from the two locks read above and
  // never from current_stage. It is needed here for the landing decision, and
  // reused below for the tile states, so it is derived before anything else.
  const briefLocked = brief?.is_locked === true;
  const hasBaseline = baseline != null;
  const phase = derivePhase({ briefLocked, hasBaseline });

  // The sequence step (Note 13), derived once from the two locks and the gate
  // decision. Stage-agnostic: deriveGateConfirmed reads the project's own passed
  // gate rows against where it now stands, so a project adopted mid-lifecycle
  // (Note 12) needs no change here.
  const gateConfirmed = deriveGateConfirmed({
    currentStage: project.current_stage,
    passedGateStages: (passedGates ?? []).map((g) => g?.stage),
  });
  const step = deriveSequenceStep({
    briefLocked,
    baselineLocked: hasBaseline,
    gateConfirmed,
  });
  const modulesAreOpen = modulesOpen(step);
  const moduleState = deriveModuleStates(step);
  const lockedLine = moduleLockedLine(step);
  const stepPanel = nextStep(step);
  const stepTarget = stepHref(step, project.id);

  // The landing (M9.5, gate-aware since Note 20). Once the Brief is locked,
  // the operational baseline (v1) is assembled and the gate is confirmed, a
  // project opens to its dashboard, the delivery home; before then it opens to
  // the workspace, whose sequence names the next step. The decision is DERIVED
  // on every request, never stored, so it reverses for free when the Brief is
  // reopened: an open Brief reads Define, and Define lands on the workspace.
  // gateConfirmed comes from the project's own passed gate rows, so the
  // decision is entry-stage independent (Note 12). Decided here, before the
  // heavier reads and the access resolution below, since a redirect makes all
  // of that moot.
  //
  // viewWorkspace is the anti-loop path. The dashboard back-link carries
  // ?view=workspace, an explicit request for the workspace that the redirect
  // does not fire on, so a developer in Run can always reach the modules and the
  // redirect can never bounce them straight back.
  const viewWorkspace = searchParams?.view === 'workspace';
  if (
    deriveLanding({ phase, gateConfirmed, viewWorkspace }) === SURFACES.DASHBOARD
  ) {
    redirect(`/pulse/app/dashboard?project=${project.id}`);
  }

  // Resolve the viewer's edit access once (Step 3a helpers), so the workspace
  // header carries the View only badge for a member. The tiles are navigation;
  // the edit controls live on the surfaces the tiles open.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);

  const stageName =
    STAGE_NAMES[project.current_stage] ?? `Stage ${project.current_stage}`;

  // The Programme tile routes by state: no locked Brief, locked; Brief locked
  // but no baseline, to set-up; baseline locked, to the tracking home. It is the
  // sequence's own step, not one of the three gated modules, so it keeps its own
  // routing and opens at the Brief lock.
  const programmeTile = programmeTileTarget(project.id, {
    briefLocked,
    hasBaseline,
  });

  // The dashboard tile's one live signal: the worst ladder status in words
  // (Note 20), read from the SAME assembly the dashboard uses
  // (deriveDashboard), so the tile and the cockpit can never disagree. No
  // number leaves this tile; every count lives on the dashboard, one source
  // of truth.
  let dashboardLadder = null;

  // The Action Log tile's live summary (M7.2): what needs a response
  // (derived from the register by the feed's trigger rule) and what is open
  // and critical in the tracked list. Only once the log is open; below
  // Stage 2 the tile stays locked and reads nothing.
  let actionLogFooter = 'Open';
  let actionLogTone = 'calm';
  let riskTileFooter = 'Open';
  let riskTileTone = 'calm';

  // The shared reads run ONLY once the modules are open (Note 13): the same live
  // rows the Risk register and the Action Log read, the RAID tables the
  // needs-a-response feed reads, and the met-points view the Programme engines
  // read. Before the operational baseline exists there is nothing to read
  // against, so nothing is counted, nothing is assessed, and no tile can show an
  // alarm state it cannot justify. The whole block is skipped, not just its
  // rendering.
  if (modulesAreOpen) {
    const raidColumns = 'id, linked_objective_id, updated_at';
    const [
      { data: actions },
      { data: risks },
      { data: objectives },
      { data: assumptions },
      { data: constraints },
      { data: dependencies },
      { view },
    ] = await Promise.all([
      supabase
        .from('project_actions')
        .select(
          'id, status, criticality, criticality_override, linked_objective_id, source, source_id, stage, reason'
        )
        .eq('project_id', project.id),
      supabase
        .from('project_risks')
        .select(
          'id, criticality, linked_objective_id, likelihood, impact, status, last_reviewed_at, response_note, updated_at'
        )
        .eq('project_id', project.id),
      supabase
        .from('project_objectives')
        .select('id, objective_type, classification')
        .eq('project_id', project.id),
      supabase.from('project_assumptions').select(raidColumns).eq('project_id', project.id),
      supabase.from('project_constraints').select(raidColumns).eq('project_id', project.id),
      supabase.from('project_dependencies').select(raidColumns).eq('project_id', project.id),
      loadMetPointsView(supabase, project.id),
    ]);
    const { byId } = buildObjectiveIndex(objectives ?? []);

    // The ladder, the tile's one signal source. The same call the dashboard
    // makes over the same rows and frozen baseline; the tile reads only the
    // worst status in words, never recomputing anything.
    const dash = deriveDashboard({
      objectives: objectives ?? [],
      risks: risks ?? [],
      actions: actions ?? [],
      programme: baseline?.programme ?? null,
      metPoints: view ?? {},
      todayIso: new Date().toISOString(),
      targetCompletionDate: project.target_completion_date ?? null,
      currentStage: project.current_stage,
    });
    dashboardLadder = dash.ladder;

    // The Risk tile footer (B2): the count of risks the monitor flags, the same
    // verdict the register's Needs attention panel renders, so the tile and the
    // register agree. assessRisks reads the clock from its caller; the server
    // supplies it. Closed risks are never flagged, so the filter drops them.
    const riskAttentionCount = assessRisks(risks ?? [], byId, Date.now()).filter(
      (v) => v.assessment.needsAttention
    ).length;
    riskTileFooter =
      riskAttentionCount > 0
        ? `${riskAttentionCount} ${riskAttentionCount === 1 ? 'risk needs' : 'risks need'} attention`
        : 'All within their review cadence.';
    // Cadence attention is not criticality: this read peaks at full ink.
    riskTileTone = riskAttentionCount > 0 ? 'alert' : 'calm';

    // Criticality is derived live from the linked objective (A2), so the tile
    // counts critical the same way the log does, override included. The triage
    // count is the full queue (risks plus RAID, A5), minus the items the
    // developer has explicitly declined (Note 18): the tile and the log read
    // one queue, so a dismissed item cannot linger in the tile's count after it
    // has left the log.
    const { decisions: triageDecisions } = await loadTriageDecisions(
      supabase,
      project.id
    );
    const triageCount = deriveResponseFeed({
      risks: risks ?? [],
      assumptions: assumptions ?? [],
      constraints: constraints ?? [],
      dependencies: dependencies ?? [],
      actions: actions ?? [],
      objectivesById: byId,
      dismissed: dismissedItemKeys(triageDecisions ?? []),
    }).length;
    const openCriticalCount = (actions ?? []).filter(
      (a) => !isDone(a) && isCritical(a, byId)
    ).length;
    actionLogFooter = formatActionLogSummary(triageCount, openCriticalCount);
    // The read's tone: amber is spent on open critical actions only (the one
    // criticality read on this screen); a queue waiting to be sorted steps up
    // to ink.
    actionLogTone =
      openCriticalCount > 0
        ? 'critical'
        : triageCount > 0
          ? 'alert'
          : 'calm';
  }

  // The dashboard tile copy: the worst ladder status in words once it is open,
  // and the sequence's honest locked line until then.
  const dashboardTileFooter = modulesAreOpen
    ? ladderTileLine(dashboardLadder)
    : lockedLine;

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <Link href="/pulse/app" className={styles.backLink}>
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
          Back to projects
        </Link>

        <h1 className={styles.heading}>{project.name}</h1>
        <p className={styles.stageMeta}>
          Stage {project.current_stage}: {stageName}
        </p>
        {!canEdit && (
          <div className={styles.viewOnly}>
            <ViewOnlyBadge adminContact={adminContact} />
          </div>
        )}
        <p className={styles.sub}>{PHASE_INTRO[phase]}</p>

        {/* The single next step (Note 13). A project runs a fixed path, so the
            workspace names the one thing to do now and states the whole order
            beneath it. Absent on the last step, when the sequence is complete
            and the workspace is the launcher it always was. */}
        {stepPanel && stepTarget && (
          <>
            <Link href={stepTarget} className={styles.nextStep}>
              <div className={styles.nextStepMain}>
                <p className={styles.nextStepEyebrow}>{stepPanel.eyebrow}</p>
                <h2 className={styles.nextStepTitle}>{stepPanel.title}</h2>
                <p className={styles.nextStepBody}>{stepPanel.body}</p>
              </div>
              <span className={styles.nextStepCta}>
                {stepPanel.cta}
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M5 3l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
            <SequenceTrail step={step} />
          </>
        )}

        {/* The Brief is the keystone: it creates the baseline every other
            module reads, so it leads as the featured panel. */}
        <Link
          href={`/pulse/app/initiate?project=${project.id}`}
          className={styles.featured}
        >
          <span className={styles.featuredIcon}>
            <BriefIcon />
          </span>
          <div className={styles.featuredMain}>
            <p className={styles.featuredEyebrow}>The baseline</p>
            <h2 className={styles.featuredTitle}>Brief</h2>
            <p className={styles.featuredDesc}>
              The nine-step initiation flow and the version-locked baseline
              every module reads from.
            </p>
          </div>
          <span className={styles.featuredAside}>
            <span
              className={`${styles.chip} ${briefLocked ? styles.chipLocked : styles.chipSetup}`}
            >
              {briefLocked ? 'Baseline locked' : 'In setup'}
            </span>
            <span className={styles.featuredCta}>
              Open
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M5 3l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </Link>

        <p className={styles.sectionLabel}>Monitoring modules</p>

        <ul className={styles.register}>
          <li className={styles.registerItem}>
            <ModuleRow
              icon={<ActionLogIcon />}
              title="Action Log"
              desc="Log and track the critical actions you are working on."
              footer={modulesAreOpen ? actionLogFooter : lockedLine}
              tone={modulesAreOpen ? actionLogTone : 'calm'}
              state={moduleState.actionLog}
              href={`/pulse/app/actions?project=${project.id}`}
            />
          </li>
          <li className={styles.registerItem}>
            <ModuleRow
              icon={<RiskIcon />}
              title="Risk register"
              desc="Monitor, score and manage the risks to your objectives."
              footer={modulesAreOpen ? riskTileFooter : lockedLine}
              tone={modulesAreOpen ? riskTileTone : 'calm'}
              state={moduleState.risk}
              href={`/pulse/app/risk?project=${project.id}`}
            />
          </li>
          <li className={styles.registerItem}>
            <ModuleRow
              icon={<ProgrammeIcon />}
              title="Programme"
              desc="Set a credible delivery programme, then track it against the baseline."
              footer={programmeTile.footer}
              state={programmeTile.state}
              href={programmeTile.href}
            />
          </li>
          <li className={styles.registerItem}>
            <ModuleRow
              icon={<DashboardIcon />}
              title="Project dashboard"
              desc={PAGE_SUB}
              footer={dashboardTileFooter}
              tone="calm"
              state={moduleState.dashboard}
              href={`/pulse/app/dashboard?project=${project.id}`}
            />
          </li>
        </ul>
      </main>
    </DashboardShell>
  );
}

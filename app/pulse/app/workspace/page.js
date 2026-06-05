import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import DashboardShell from '../../../components/DashboardShell';
import styles from './Workspace.module.css';

/**
 * /pulse/app/workspace - the project workspace hub.
 *
 * A project's home: a header with its current stage, then the PULSE modules
 * as tiles. The Brief (initiation) is always available; the monitoring
 * modules unlock as the project advances. The Risk register opens at Stage 2
 * (once the gate has committed the baseline); Programme and the project
 * Dashboard are placeholders here, built in later milestones.
 *
 * This is the launcher the modules are reached from, so each new module
 * becomes another tile rather than another scattered link.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STAGE_2 = 2;

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

// One module tile. `state` is 'open' (a link), 'locked' (gated, with a note),
// or 'soon' (a later milestone). Only an open tile is interactive.
function Tile({ icon, title, desc, footer, state, href }) {
  const body = (
    <>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileTitle}>{title}</span>
      <span className={styles.tileDesc}>{desc}</span>
      <span className={styles.tileFoot}>{footer}</span>
    </>
  );

  if (state === 'open') {
    return (
      <Link href={href} className={`${styles.tile} ${styles.tileOpen}`}>
        {body}
      </Link>
    );
  }

  return (
    <div
      className={`${styles.tile} ${state === 'locked' ? styles.tileLocked : styles.tileSoon}`}
      aria-disabled="true"
    >
      {body}
    </div>
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

  // The project and its latest brief lock state (to label the Brief tile).
  const [{ data: project }, { data: brief }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, current_stage')
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

  if (!project) {
    redirect('/pulse/app');
  }

  const stageName =
    STAGE_NAMES[project.current_stage] ?? `Stage ${project.current_stage}`;
  const riskOpen = project.current_stage >= STAGE_2;
  const briefLocked = brief?.is_locked === true;

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

        <div className={styles.head}>
          <h1 className={styles.heading}>{project.name}</h1>
          <span className={styles.stageChip}>
            Stage {project.current_stage}: {stageName}
          </span>
        </div>
        <p className={styles.sub}>
          Your project workspace. Set up the baseline in the Brief, then open
          each monitoring module as the project advances through its stages.
        </p>

        <div className={styles.grid}>
          <Tile
            icon={<BriefIcon />}
            title="Brief"
            desc="The eight-step initiation flow and the version-locked baseline."
            footer={briefLocked ? 'Baseline locked' : 'In setup'}
            state="open"
            href={`/pulse/app/initiate?project=${project.id}`}
          />
          <Tile
            icon={<RiskIcon />}
            title="Risk register"
            desc="Monitor, score and manage the risks to your objectives."
            footer={
              riskOpen
                ? 'Open'
                : 'Risk monitoring opens once you pass the gate into Stage 2.'
            }
            state={riskOpen ? 'open' : 'locked'}
            href={`/pulse/app/risk?project=${project.id}`}
          />
          <Tile
            icon={<ProgrammeIcon />}
            title="Programme"
            desc="Track the critical milestones against the baseline."
            footer="Coming soon"
            state="soon"
          />
          <Tile
            icon={<DashboardIcon />}
            title="Project dashboard"
            desc="The proportional view of where the project stands."
            footer="Coming soon"
            state="soon"
          />
        </div>
      </main>
    </DashboardShell>
  );
}

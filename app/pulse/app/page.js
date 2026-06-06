import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import DashboardShell from '../../components/DashboardShell';
import styles from './page.module.css';

/**
 * /pulse/app — the PULSE project dashboard. The signed-in user's launch
 * point for the Project Initiation flow: a "New project" action and a
 * minimal list of their existing projects (name, status, current stage),
 * each opening its project workspace when clicked.
 *
 * Deliberately minimal in M3.2. The rich portfolio view is a separate
 * future module, not this sub-step.
 */

// Lifecycle stage names (framework Section 4). A draft in initiation sits
// at Stage 1 until gate logic (a later sub-step) advances it.
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

const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
};

function formatUpdated(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({ status }) {
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  const variant =
    status === 'active'
      ? styles.pillActive
      : status === 'draft'
        ? styles.pillDraft
        : styles.pillMuted;
  return <span className={`${styles.pill} ${variant}`}>{label}</span>;
}

export default async function PulseAppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  // Parallel fetches: profile (for the shell greeting) + the user's
  // projects. RLS already scopes projects to the owner; the explicit
  // user_id filter makes that intent clear and uses idx_projects_user_id.
  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('projects')
      .select('id, name, status, current_stage, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ]);

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  const list = projects ?? [];

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        <div className={styles.head}>
          <div className={`${styles.headText} riseIn`}>
            <p className={styles.eyebrow}>PULSE</p>
            <h1 className={styles.heading}>Your projects</h1>
            <p className={styles.sub}>
              Start a new project to run it through PULSE initiation, or pick
              up a draft where you left off.
            </p>
          </div>
          <Link
            href="/pulse/app/initiate"
            className={`${styles.newBtn} riseIn`}
            style={{ '--rise-delay': '90ms' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            New project
          </Link>
        </div>

        {list.length === 0 ? (
          <div className={`${styles.empty} riseIn`}>
            <h2 className={styles.emptyHeading}>No projects yet.</h2>
            <p className={styles.emptyBody}>
              Your first PULSE project starts with the eight-step initiation
              flow. It defines the baseline that governs every later stage.
            </p>
            <Link href="/pulse/app/initiate" className={styles.emptyCta}>
              Start your first project
            </Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {list.map((p, i) => {
              const stageName =
                STAGE_NAMES[p.current_stage] ?? `Stage ${p.current_stage}`;
              const updated = formatUpdated(p.updated_at);
              return (
                <li
                  key={p.id}
                  className={`${styles.listItem} riseIn`}
                  style={{ '--rise-delay': `${Math.min(i, 8) * 55}ms` }}
                >
                  <Link
                    href={`/pulse/app/workspace?project=${p.id}`}
                    className={styles.cardLink}
                  >
                    <div className={styles.cardMain}>
                      <h2 className={styles.cardName}>{p.name}</h2>
                      <p className={styles.cardMeta}>
                        Stage {p.current_stage}: {stageName}
                        {updated ? ` · Updated ${updated}` : ''}
                      </p>
                    </div>
                    <div className={styles.cardRight}>
                      <StatusPill status={p.status} />
                      <svg
                        className={styles.cardChevron}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path
                          d="M6 3l5 5-5 5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server.js';
import { resolveProjectAccess } from '../../../lib/team/access.js';
import { listSchemes, schemeSummary } from '../../../lib/stack/schemeStore.js';
import DashboardShell from '../../components/DashboardShell';
import PageHeader from '../../pulse/app/components/PageHeader';
import StackTool from './StackTool';
import styles from './stack.module.css';

/**
 * /stack/app: the STACK development appraisal and funding model, on the
 * product Instrument like every authenticated surface: DashboardShell for
 * the platform chrome, PageHeader for the frame, the --app-* tokens for
 * everything on the canvas. Fully behind auth (the middleware gates the
 * /stack/app prefix, and the page holds the same belt-and-braces redirect
 * as its PULSE siblings). Schemes save to and load from the signed-in
 * organisation's store, an admin writes and a member reads, and a scheme
 * may name the project it appraises (039, the spine attachment).
 */
export default async function StackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  // The shell greeting, the viewer's role, the organisation's saved schemes
  // for the first paint, and its projects for the scheme link picker. All
  // degrade cleanly: a failed read renders the tool with an empty list and a
  // read-only surface, and row level security holds the real line
  // underneath either way.
  const [{ data: profile }, { canEdit, adminContact }, { schemes }, { data: projectRows }] =
    await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      resolveProjectAccess(supabase),
      listSchemes(supabase),
      supabase
        .from('projects')
        .select('id, name, archived_at')
        .order('name', { ascending: true }),
    ]);

  const navUser = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
  };

  const initialSchemes = (schemes ?? []).map(schemeSummary);
  // Active projects only: an archived project is not offered for a NEW link
  // (a scheme already linked to one keeps its name via the scheme summary).
  const projects = (projectRows ?? [])
    .filter((p) => !p.archived_at)
    .map(({ id, name }) => ({ id, name }));

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        {/* The frame is screen chrome: the print report carries its own
            banner, so the whole header leaves the sheet. */}
        <div className={styles.pageHead}>
          <PageHeader
            eyebrow="STACK"
            title="Development appraisal"
            sub="Appraise a scheme and test how it should be funded. Saved schemes belong to the organisation."
          />
        </div>

        <StackTool
          initialSchemes={initialSchemes}
          canEdit={canEdit}
          adminContact={adminContact}
          projects={projects}
        />
      </main>
    </DashboardShell>
  );
}

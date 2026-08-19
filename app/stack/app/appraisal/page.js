import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server.js';
import { resolveProjectAccess } from '../../../../lib/team/access.js';
import { openScheme } from '../actions';
import DashboardShell from '../../../components/DashboardShell';
import PageHeader from '../../../pulse/app/components/PageHeader';
import ViewOnlyBadge from '../../../pulse/app/components/ViewOnlyBadge';
import StackTool from '../StackTool';
import styles from '../stack.module.css';

/**
 * /stack/app/appraisal: the development appraisal and funding model, STACK's
 * first feature, one level under the product home the way every PULSE module
 * sits under its hub. Arrive fresh for a new appraisal, or with ?scheme= to
 * open a saved scheme: the stored inputs recompute under the current engine
 * on the server (the same openScheme path the tool's actions use), so the
 * page paints loaded with the form filled and the report standing.
 *
 * Auth: the middleware gates the /stack/app prefix; the page holds the
 * belt-and-braces redirect. A member gets the form and the report (running
 * an appraisal writes nothing) with the save panel absent and the view-only
 * badge naming who to contact.
 */
export default async function StackAppraisalPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { canEdit, adminContact }, { data: projectRows }] =
    await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      resolveProjectAccess(supabase),
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

  // Active projects only: an archived project is not offered for a NEW link
  // (a scheme already linked to one keeps its name via the scheme summary).
  const projects = (projectRows ?? [])
    .filter((p) => !p.archived_at)
    .map(({ id, name }) => ({ id, name }));

  // A saved scheme named in the URL loads here, on the server: stored
  // inputs recomputed under the current engine, the summary, and the engine
  // version note when the stamp differs. A scheme that cannot be loaded
  // (deleted, or outside the organisation) degrades to a fresh appraisal
  // with the refusal stated, never a crash.
  const schemeId = typeof searchParams?.scheme === 'string' ? searchParams.scheme : null;
  let initialScheme = null;
  let initialSchemeError = null;
  if (schemeId) {
    const loaded = await openScheme(schemeId);
    if (loaded.ok) {
      initialScheme = {
        scheme: loaded.scheme,
        inputs: loaded.inputs,
        result: loaded.result,
        meta: loaded.meta,
        engineNote: loaded.engineNote,
      };
    } else {
      initialSchemeError = loaded.error;
    }
  }

  return (
    <DashboardShell user={navUser}>
      <main className={`container ${styles.page}`} id="main-content">
        {/* The frame is screen chrome: the print report carries its own
            banner, so the whole header leaves the sheet. */}
        <div className={styles.pageHead}>
          <PageHeader
            back={{ href: '/stack/app', label: 'Back to schemes' }}
            eyebrow="STACK"
            title="Development appraisal"
            sub="Enter the scheme and test how it should be funded. Save it to the organisation's register when it is worth keeping."
            badge={!canEdit ? <ViewOnlyBadge adminContact={adminContact} /> : null}
          />
        </div>

        <StackTool
          canEdit={canEdit}
          projects={projects}
          initialScheme={initialScheme}
          initialSchemeError={initialSchemeError}
        />
      </main>
    </DashboardShell>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import DashboardShell from '../../../components/DashboardShell';
import InitiationWizard from '../components/InitiationWizard';

/**
 * /pulse/app/initiate — host for the PULSE Project Initiation wizard.
 *
 * Two modes, keyed off the ?project=<id> search param:
 *   - No param: a fresh wizard. No project row exists yet; it is created
 *     on advancing from Step 1.
 *   - ?project=<id>: resume an existing draft. We fetch the row (RLS
 *     guarantees the user can only read their own) and hand it to the
 *     wizard to repopulate Steps 1 and 2. A missing or non-owned id, or a
 *     malformed one, falls back to the project list rather than erroring.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InitiatePage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces. Middleware should have caught this already.
  if (!user) {
    redirect('/login');
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

  const projectParam =
    typeof searchParams?.project === 'string' ? searchParams.project : null;

  let initialProject = null;
  let initialGate = null;
  if (projectParam) {
    // Guard against a malformed id, which would otherwise be a Postgres
    // type error rather than a clean "not found".
    if (!UUID_RE.test(projectParam)) {
      redirect('/pulse/app');
    }

    // The project row, plus the Gate 1 to 2 row (stage = 1) so the header's
    // stage indicator can show the recorded decision once the gate has passed.
    const [{ data: project }, { data: gateRow }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectParam).maybeSingle(),
      supabase
        .from('project_stage_gates')
        .select('gate_status, passed_at')
        .eq('project_id', projectParam)
        .eq('stage', 1)
        .maybeSingle(),
    ]);

    // Not found, or not owned (RLS filtered it out). Send them back to
    // the list rather than showing a broken wizard.
    if (!project) {
      redirect('/pulse/app');
    }

    initialProject = project;
    initialGate = gateRow ?? null;
  }

  return (
    <DashboardShell user={navUser}>
      <InitiationWizard
        userId={user.id}
        initialProject={initialProject}
        initialGate={initialGate}
      />
    </DashboardShell>
  );
}

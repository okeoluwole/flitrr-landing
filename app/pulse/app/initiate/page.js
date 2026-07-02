import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { resolveProjectAccess } from '../../../../lib/team/access';
import DashboardShell from '../../../components/DashboardShell';
import InitiationWizard from '../components/InitiationWizard';
import MemberBriefView from '../components/MemberBriefView';

/**
 * /pulse/app/initiate: host for the PULSE Project Initiation wizard.
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

  // Resolve the viewer's edit access once (Step 3a helpers). The initiation
  // wizard is an authoring flow, so a member does not get it: they get the
  // read-only Project Brief document instead, with the View only badge. The
  // admin path below is unchanged.
  const { canEdit, adminContact } = await resolveProjectAccess(supabase);
  if (!canEdit) {
    // The Brief is always opened for a specific project. Without one (a member
    // cannot start a project), fall back to the list.
    if (!projectParam || !UUID_RE.test(projectParam)) {
      redirect('/pulse/app');
    }

    const [{ data: project }, { data: briefRow }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectParam)
        .maybeSingle(),
      supabase
        .from('project_briefs')
        .select('version, content, is_locked, generated_at')
        .eq('project_id', projectParam)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Not found, or not owned (RLS filtered it out).
    if (!project) {
      redirect('/pulse/app');
    }

    // Only a locked baseline is shown; an in-progress draft is not a member's
    // to see mid-authoring, so it reads as the not-yet-locked sparse state.
    const latestBrief = briefRow?.is_locked
      ? {
          version: briefRow.version,
          content: briefRow.content,
          generatedAt: briefRow.generated_at,
        }
      : null;

    return (
      <DashboardShell user={navUser}>
        <MemberBriefView
          projectName={project.name}
          workspaceHref={`/pulse/app/workspace?project=${project.id}`}
          latestBrief={latestBrief}
          adminContact={adminContact}
        />
      </DashboardShell>
    );
  }

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

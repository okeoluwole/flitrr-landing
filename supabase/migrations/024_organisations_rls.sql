-- ========================================================================
-- 024_organisations_rls.sql
--
-- The tenant boundary, enforced in the database. Step 3 of three: run after
-- 022 and 023. This file replaces the old per-user policies on every
-- project-scoped table with one org-scoped rule, adds the helpers that rule
-- depends on, adds the trigger that tenants new projects, and finishes by
-- making projects.organisation_id NOT NULL.
--
-- THE RULE, applied consistently and generated rather than hand-copied:
--   - SELECT: allowed when the row's owning organisation equals the caller's
--     organisation. Tables that carry project_id resolve the organisation by
--     joining through projects; projects itself compares organisation_id.
--   - INSERT, UPDATE, DELETE: allowed only when the caller is an admin of the
--     owning organisation.
--   - organisations and organisation_members: SELECT only, scoped to the
--     caller's own organisation (and a user can always see their own
--     membership). No client write policies in this step; the first corporate
--     organisation and its members are set up by Olu directly in Supabase.
--
-- WHY THE HELPERS ARE SECURITY DEFINER. The policies look up the caller's
-- organisation and admin flag by reading organisation_members. If those reads
-- were subject to row level security, the organisation_members SELECT policy
-- would call the same helper, which would read organisation_members again, and
-- so on: infinite recursion. SECURITY DEFINER functions run as their owner
-- (postgres, the table owner), for whom row level security is not applied, so
-- the lookup reads the table directly and the recursion never starts. This is
-- required, not optional.
--
-- SCOPE. Org-scoped policies are applied ONLY to the project-scoped tables in
-- the inventory. The global and reference tables are left exactly as they are:
-- profiles, products, product_access, design_partner_submissions (still
-- insert-only with no select), playbook_plays (still readable by every
-- authenticated user), and digest_sends (still own-history read only). No
-- Supabase-managed table is touched.
--
-- TWO CONSEQUENCES OF THE UNIFORM ADMIN-WRITE RULE, called out so they are not
-- a surprise:
--   - The two SECURITY INVOKER write paths from 020 and 021
--     (lock_programme_baseline and record_milestone_actual) run as the caller,
--     so they become admin only like every other write. This is intended: a
--     member is read only in this step. For a solo developer, who is the admin
--     of their own organisation, both keep working unchanged.
--   - programme_baselines gains an admin DELETE policy it did not have before
--     (020 deliberately omitted one). The append-only intent still holds: the
--     store never issues a delete, and the programme_baselines_immutable
--     trigger from 020 still blocks any edit to a frozen baseline's content.
--     The uniform rule only makes a delete, if one were ever issued, admin
--     scoped rather than ungoverned.
--
-- Idempotent: functions use CREATE OR REPLACE, the trigger is dropped before
-- create, each table's policies are dropped before the generated set is
-- created, ENABLE ROW LEVEL SECURITY is safe to repeat, and the final SET NOT
-- NULL is a no-op once set. Apply in the Supabase SQL editor, after 023. Apply
-- to the local or development database only.
-- ========================================================================

-- ========================================================================
-- HELPERS  the caller's organisation and admin flag, read past row level
-- security so the policies that call them do not recurse on
-- organisation_members. STABLE: they read only, and the result is constant
-- within a statement. SET search_path = public guards the definer context.
-- ========================================================================
CREATE OR REPLACE FUNCTION current_user_organisation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- One row at most: organisation_members.user_id is unique (022). LIMIT 1 is
  -- defensive, keeping a single deterministic result if that ever changes.
  SELECT organisation_id
  FROM organisation_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_user_organisation_id() IS
  'The organisation the authenticated caller belongs to (organisation_members.user_id is unique, so at most one row). SECURITY DEFINER so policies that call it do not recurse on organisation_members.';

CREATE OR REPLACE FUNCTION is_organisation_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION is_organisation_admin() IS
  'True when the authenticated caller is an admin of their organisation. SECURITY DEFINER for the same no-recursion reason as current_user_organisation_id().';

-- The no-recursion guarantee requires these SECURITY DEFINER helpers to run as
-- a role for which row level security on organisation_members is not applied,
-- which is the table owner. Pin the owner explicitly so the guarantee does not
-- rest on an unstated assumption about which role applied the migration. In the
-- Supabase SQL editor this is a no-op (the owner is already postgres); it
-- hardens the case where a different role applies these files later.
ALTER FUNCTION current_user_organisation_id() OWNER TO postgres;
ALTER FUNCTION is_organisation_admin() OWNER TO postgres;

-- ========================================================================
-- PROJECTS BEFORE INSERT TRIGGER  set organisation_id to the caller's
-- organisation when it is null. This lets the existing project creation code,
-- which inserts { user_id, ...payload } and never sets organisation_id, keep
-- working unchanged while still tenanting the new row. The only project insert
-- in the app (InitiationWizard.js inserts { user_id, ...payload } with no
-- organisation_id), so this trigger is load-bearing. The insert WITH CHECK
-- below runs after this trigger, so it sees the populated organisation_id.
-- ========================================================================
CREATE OR REPLACE FUNCTION set_project_organisation_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organisation_id IS NULL THEN
    NEW.organisation_id := current_user_organisation_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_organisation_id ON projects;
CREATE TRIGGER projects_set_organisation_id
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_project_organisation_id();

-- ========================================================================
-- ORGANISATIONS and ORGANISATION_MEMBERS  read scoped to the caller's own
-- organisation. No write policies: provisioning is done by the sign-up trigger
-- (023) and by Olu directly, both past row level security. With row level
-- security enabled and no write policy, the client cannot insert, update or
-- delete these rows, which is the intended posture for this step.
-- ========================================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their organisation" ON organisations;
CREATE POLICY "Members can read their organisation"
  ON organisations FOR SELECT
  USING (id = current_user_organisation_id());

DROP POLICY IF EXISTS "Members can read their organisation membership" ON organisation_members;
CREATE POLICY "Members can read their organisation membership"
  ON organisation_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR organisation_id = current_user_organisation_id()
  );

-- ========================================================================
-- PROJECTS  the root of the tenant. SELECT for any member of the owning
-- organisation; INSERT, UPDATE and DELETE for an admin of it. The old per-user
-- policies from 005 are dropped first so projects ends with exactly this set.
-- ========================================================================
DO $do$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END
$do$;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organisation members can read projects"
  ON projects FOR SELECT
  USING (organisation_id = current_user_organisation_id());

CREATE POLICY "Organisation admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

CREATE POLICY "Organisation admins can update projects"
  ON projects FOR UPDATE
  USING (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  )
  WITH CHECK (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

CREATE POLICY "Organisation admins can delete projects"
  ON projects FOR DELETE
  USING (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

-- ========================================================================
-- THE PROJECT-SCOPED CHILD TABLES  one generated rule for all of them. Each
-- carries project_id, so the owning organisation is resolved by joining
-- through projects. For each table the existing per-user policies are dropped,
-- row level security is enabled, and the four org-scoped policies are created:
-- member read, admin insert, admin update, admin delete. Generating them from
-- one loop keeps the rule identical across every table rather than hand-copied.
--
-- This is the full inventory of project-scoped child tables (every table that
-- holds per-project data through a project_id), gathered from migrations 004,
-- 010, 013, 015, 020 and 021. The global and reference tables are deliberately
-- absent and are left untouched.
-- ========================================================================
DO $do$
DECLARE
  child_tables TEXT[] := ARRAY[
    'project_objectives',
    'project_milestones',
    'project_workstreams',
    'project_risks',
    'project_briefs',
    'project_stage_gates',
    'project_actions',
    'project_playbook_state',
    'project_stakeholders',
    'project_scope_site',
    'project_budget',
    'project_funding_milestones',
    'project_assumptions',
    'project_constraints',
    'project_dependencies',
    'programme_baselines',
    'programme_milestone_actuals'
  ];
  t           TEXT;
  pol         RECORD;
  member_cond TEXT;
  admin_cond  TEXT;
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    -- Clean slate: drop every existing policy so the table ends with exactly
    -- the one generated org-scoped rule set.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Read for any member of the owning organisation; write only for an admin
    -- of it. The organisation is resolved by joining through projects.
    member_cond := format(
      'EXISTS (SELECT 1 FROM public.projects p WHERE p.id = %I.project_id AND p.organisation_id = current_user_organisation_id())',
      t
    );
    admin_cond := 'is_organisation_admin() AND ' || member_cond;

    EXECUTE format(
      'CREATE POLICY "Organisation members can read %s" ON public.%I FOR SELECT USING (%s)',
      t, t, member_cond
    );
    EXECUTE format(
      'CREATE POLICY "Organisation admins can insert %s" ON public.%I FOR INSERT WITH CHECK (%s)',
      t, t, admin_cond
    );
    EXECUTE format(
      'CREATE POLICY "Organisation admins can update %s" ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
      t, t, admin_cond, admin_cond
    );
    EXECUTE format(
      'CREATE POLICY "Organisation admins can delete %s" ON public.%I FOR DELETE USING (%s)',
      t, t, admin_cond
    );
  END LOOP;
END
$do$;

-- ========================================================================
-- ENFORCE THE TENANT BOUNDARY ON PROJECTS. Now that the BEFORE INSERT trigger
-- populates organisation_id for every new project, the column can be made NOT
-- NULL so a project can never be untenanted. Done only if 023 left no orphan;
-- if any project is still null, the column is left nullable and the situation
-- is reported, rather than failing the migration on a constraint that the data
-- does not yet satisfy.
-- ========================================================================
DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  SELECT count(*) INTO v_orphans FROM projects WHERE organisation_id IS NULL;
  IF v_orphans = 0 THEN
    ALTER TABLE projects ALTER COLUMN organisation_id SET NOT NULL;
    RAISE NOTICE 'projects.organisation_id set NOT NULL (every project is tenanted).';
  ELSE
    RAISE WARNING 'projects.organisation_id left nullable: % project(s) have no organisation. Resolve them, then run: ALTER TABLE projects ALTER COLUMN organisation_id SET NOT NULL;',
      v_orphans;
  END IF;
END $$;

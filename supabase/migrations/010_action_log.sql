-- ========================================================================
-- 010_action_log.sql
--
-- M7.1, the Action Log manual substrate. One new table, project_actions,
-- holding the critical actions the developer logs by hand from Stage 2
-- onward. M7.2 adds the aggregation feed on top; this is the substrate
-- only, so there are deliberately no source or origin columns, no owner,
-- and no due date.
--
-- ONE VOCABULARY FOR CRITICALITY. The objective link and the cascaded
-- criticality reuse the exact representation the sibling tables
-- (project_milestones, project_workstreams, project_risks) already carry:
-- a nullable linked_objective_id foreign key and a criticality column on
-- the shared criticality_level enum (critical / standard), defaulting to
-- standard. The M7.1 spec sketches the link column as objective_id; it is
-- named linked_objective_id here so the four cascaded tables stay on one
-- consistent vocabulary rather than two.
--
-- The cascade itself (linked to a non-negotiable objective defaults the
-- action to critical) is applied in app code at creation, the same
-- cascadeCriticality helper the wizard uses. After creation, criticality
-- only changes by the developer's explicit toggle, so re-linking an
-- action never silently re-flips it. The default here covers the
-- no-objective case.
--
-- Status is the log's own small lifecycle (to_do / doing / done) as a new
-- enum, following the native-enum convention from 004. Done actions stay
-- on the table (done is for completed work; delete is for mistakes).
--
-- updated_at is maintained by the shared update_updated_at() trigger
-- function from 001, like every other project table. RLS mirrors
-- 005_pulse_projects_rls.sql: a user reaches an action only through a
-- project they own.
--
-- Idempotent: the enum create is guarded, the table and indexes use
-- IF NOT EXISTS, the trigger is dropped before create, and the policies
-- are guarded (CREATE POLICY has no IF NOT EXISTS), so re-running is safe.
--
-- Apply this in the Supabase SQL editor before testing.
-- ========================================================================

-- The log lifecycle: an action is to do, being done, or done.
DO $$ BEGIN
  CREATE TYPE action_status AS ENUM ('to_do', 'doing', 'done');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS project_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality criticality_level NOT NULL DEFAULT 'standard',
  status action_status NOT NULL DEFAULT 'to_do',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- updated_at via the shared trigger function (001), per convention.
DROP TRIGGER IF EXISTS project_actions_updated_at ON project_actions;
CREATE TRIGGER project_actions_updated_at
  BEFORE UPDATE ON project_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- ROW LEVEL SECURITY. Reachable only through an owned project, written
-- per action to mirror 005_pulse_projects_rls.sql.
-- ========================================================================
ALTER TABLE project_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own project actions"
    ON project_actions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_actions.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own project actions"
    ON project_actions FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_actions.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own project actions"
    ON project_actions FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_actions.project_id
          AND projects.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_actions.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own project actions"
    ON project_actions FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_actions.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- INDEXES, following 006: the parent lookup plus the nullable objective
-- foreign key (supports objective-to-action joins and ON DELETE SET NULL).
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_project_actions_project_id ON project_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_actions_linked_objective_id ON project_actions(linked_objective_id);

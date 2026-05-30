-- ========================================================================
-- 005_pulse_projects_rls.sql
--
-- Row Level Security for the seven PULSE project tables. Run after
-- 004_pulse_projects_schema.sql.
--
-- Access model:
--   - projects        : a user owns rows where user_id = auth.uid().
--   - the six child tables : a user reaches a row only through a project
--     they own. Each policy checks that the row's project_id belongs to
--     a project owned by auth.uid().
--
-- Policies are written per action (select / insert / update / delete) to
-- mirror the structure and naming in 002_rls_policies.sql.
-- ========================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stage_gates ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- PROJECTS — owner is user_id.
-- ========================================================================
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================================================
-- PROJECT_OBJECTIVES — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project objectives"
  ON project_objectives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_objectives.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project objectives"
  ON project_objectives FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_objectives.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project objectives"
  ON project_objectives FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_objectives.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_objectives.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project objectives"
  ON project_objectives FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_objectives.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- PROJECT_MILESTONES — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project milestones"
  ON project_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project milestones"
  ON project_milestones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project milestones"
  ON project_milestones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project milestones"
  ON project_milestones FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- PROJECT_WORKSTREAMS — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project workstreams"
  ON project_workstreams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_workstreams.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project workstreams"
  ON project_workstreams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_workstreams.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project workstreams"
  ON project_workstreams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_workstreams.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_workstreams.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project workstreams"
  ON project_workstreams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_workstreams.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- PROJECT_RISKS — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project risks"
  ON project_risks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_risks.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project risks"
  ON project_risks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_risks.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project risks"
  ON project_risks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_risks.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_risks.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project risks"
  ON project_risks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_risks.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- PROJECT_BRIEFS — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project briefs"
  ON project_briefs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_briefs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project briefs"
  ON project_briefs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_briefs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project briefs"
  ON project_briefs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_briefs.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_briefs.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project briefs"
  ON project_briefs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_briefs.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- PROJECT_STAGE_GATES — reachable only through an owned project.
-- ========================================================================
CREATE POLICY "Users can view own project stage gates"
  ON project_stage_gates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stage_gates.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project stage gates"
  ON project_stage_gates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stage_gates.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project stage gates"
  ON project_stage_gates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stage_gates.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stage_gates.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project stage gates"
  ON project_stage_gates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_stage_gates.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ========================================================================
-- 016_pulse_brief_widening_rls.sql
--
-- Row Level Security for the seven tables added in 015. Run after 015.
--
-- Same access model as 005: a user reaches a child row only through a project
-- they own, checked with EXISTS against projects.user_id = auth.uid(). Policies
-- are per action (select / insert / update / delete) to mirror 005. Idempotent:
-- each policy is dropped before it is created, so a re-run is a no-op.
--
-- Apply in the Supabase SQL editor, after 015.
-- ========================================================================

ALTER TABLE project_stakeholders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope_site         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budget             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_funding_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assumptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_constraints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_dependencies       ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- PROJECT_STAKEHOLDERS
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project stakeholders" ON project_stakeholders;
CREATE POLICY "Users can view own project stakeholders"
  ON project_stakeholders FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_stakeholders.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project stakeholders" ON project_stakeholders;
CREATE POLICY "Users can create own project stakeholders"
  ON project_stakeholders FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_stakeholders.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project stakeholders" ON project_stakeholders;
CREATE POLICY "Users can update own project stakeholders"
  ON project_stakeholders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_stakeholders.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_stakeholders.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project stakeholders" ON project_stakeholders;
CREATE POLICY "Users can delete own project stakeholders"
  ON project_stakeholders FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_stakeholders.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_SCOPE_SITE
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project scope site" ON project_scope_site;
CREATE POLICY "Users can view own project scope site"
  ON project_scope_site FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_scope_site.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project scope site" ON project_scope_site;
CREATE POLICY "Users can create own project scope site"
  ON project_scope_site FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_scope_site.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project scope site" ON project_scope_site;
CREATE POLICY "Users can update own project scope site"
  ON project_scope_site FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_scope_site.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_scope_site.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project scope site" ON project_scope_site;
CREATE POLICY "Users can delete own project scope site"
  ON project_scope_site FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_scope_site.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_BUDGET
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project budget" ON project_budget;
CREATE POLICY "Users can view own project budget"
  ON project_budget FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_budget.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project budget" ON project_budget;
CREATE POLICY "Users can create own project budget"
  ON project_budget FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_budget.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project budget" ON project_budget;
CREATE POLICY "Users can update own project budget"
  ON project_budget FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_budget.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_budget.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project budget" ON project_budget;
CREATE POLICY "Users can delete own project budget"
  ON project_budget FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_budget.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_FUNDING_MILESTONES
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project funding milestones" ON project_funding_milestones;
CREATE POLICY "Users can view own project funding milestones"
  ON project_funding_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_funding_milestones.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project funding milestones" ON project_funding_milestones;
CREATE POLICY "Users can create own project funding milestones"
  ON project_funding_milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_funding_milestones.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project funding milestones" ON project_funding_milestones;
CREATE POLICY "Users can update own project funding milestones"
  ON project_funding_milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_funding_milestones.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_funding_milestones.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project funding milestones" ON project_funding_milestones;
CREATE POLICY "Users can delete own project funding milestones"
  ON project_funding_milestones FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_funding_milestones.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_ASSUMPTIONS
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project assumptions" ON project_assumptions;
CREATE POLICY "Users can view own project assumptions"
  ON project_assumptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assumptions.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project assumptions" ON project_assumptions;
CREATE POLICY "Users can create own project assumptions"
  ON project_assumptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assumptions.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project assumptions" ON project_assumptions;
CREATE POLICY "Users can update own project assumptions"
  ON project_assumptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assumptions.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assumptions.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project assumptions" ON project_assumptions;
CREATE POLICY "Users can delete own project assumptions"
  ON project_assumptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_assumptions.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_CONSTRAINTS
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project constraints" ON project_constraints;
CREATE POLICY "Users can view own project constraints"
  ON project_constraints FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_constraints.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project constraints" ON project_constraints;
CREATE POLICY "Users can create own project constraints"
  ON project_constraints FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_constraints.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project constraints" ON project_constraints;
CREATE POLICY "Users can update own project constraints"
  ON project_constraints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_constraints.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_constraints.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project constraints" ON project_constraints;
CREATE POLICY "Users can delete own project constraints"
  ON project_constraints FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_constraints.project_id AND projects.user_id = auth.uid()));

-- ========================================================================
-- PROJECT_DEPENDENCIES
-- ========================================================================
DROP POLICY IF EXISTS "Users can view own project dependencies" ON project_dependencies;
CREATE POLICY "Users can view own project dependencies"
  ON project_dependencies FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_dependencies.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create own project dependencies" ON project_dependencies;
CREATE POLICY "Users can create own project dependencies"
  ON project_dependencies FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_dependencies.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own project dependencies" ON project_dependencies;
CREATE POLICY "Users can update own project dependencies"
  ON project_dependencies FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_dependencies.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_dependencies.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own project dependencies" ON project_dependencies;
CREATE POLICY "Users can delete own project dependencies"
  ON project_dependencies FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_dependencies.project_id AND projects.user_id = auth.uid()));

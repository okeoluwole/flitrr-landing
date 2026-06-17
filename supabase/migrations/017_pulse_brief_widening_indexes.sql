-- ========================================================================
-- 017_pulse_brief_widening_indexes.sql
--
-- Performance indexes for the tables added in 015. Run after 015 and 016.
-- Mirrors 006. The two 1:1 tables (project_scope_site, project_budget) carry
-- a UNIQUE constraint on project_id, which already provides the parent index,
-- so they need no separate one. Idempotent via IF NOT EXISTS.
-- ========================================================================

-- Parent lookup: fetch a project's child rows. One per list-style table.
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_project_id       ON project_stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_funding_milestones_project_id ON project_funding_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assumptions_project_id        ON project_assumptions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_constraints_project_id        ON project_constraints(project_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_project_id       ON project_dependencies(project_id);

-- linked_objective_id on the RAID siblings: supports objective-to-row joins
-- and the ON DELETE SET NULL action (mirrors 006 for milestones and risks).
CREATE INDEX IF NOT EXISTS idx_project_assumptions_linked_objective_id  ON project_assumptions(linked_objective_id);
CREATE INDEX IF NOT EXISTS idx_project_constraints_linked_objective_id  ON project_constraints(linked_objective_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_linked_objective_id ON project_dependencies(linked_objective_id);

-- The named authority FK on projects: supports the ON DELETE SET NULL when a
-- stakeholder party is removed.
CREATE INDEX IF NOT EXISTS idx_projects_authority_stakeholder_id ON projects(authority_stakeholder_id);

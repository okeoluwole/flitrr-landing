-- ========================================================================
-- 006_pulse_projects_indexes.sql
--
-- Performance indexes for the PULSE project tables. Run after 004 and 005.
-- ========================================================================

-- Owner lookup: list a user's projects.
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Parent lookup: fetch a project's child rows. One per child table.
CREATE INDEX idx_project_objectives_project_id ON project_objectives(project_id);
CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX idx_project_workstreams_project_id ON project_workstreams(project_id);
CREATE INDEX idx_project_risks_project_id ON project_risks(project_id);
CREATE INDEX idx_project_briefs_project_id ON project_briefs(project_id);
CREATE INDEX idx_project_stage_gates_project_id ON project_stage_gates(project_id);

-- Portfolio monitoring (later sub-steps) queries objectives by type and
-- classification, and addresses stage gates by stage number.
CREATE INDEX idx_project_objectives_objective_type ON project_objectives(objective_type);
CREATE INDEX idx_project_stage_gates_stage ON project_stage_gates(stage);

-- linked_objective_id is a nullable foreign key on three tables. Indexing
-- it supports objective-to-row joins and the ON DELETE SET NULL action.
CREATE INDEX idx_project_milestones_linked_objective_id ON project_milestones(linked_objective_id);
CREATE INDEX idx_project_workstreams_linked_objective_id ON project_workstreams(linked_objective_id);
CREATE INDEX idx_project_risks_linked_objective_id ON project_risks(linked_objective_id);

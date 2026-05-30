-- ========================================================================
-- 004_pulse_projects_schema.sql
--
-- PULSE Project Initiation schema (M3.1). Seven tables that hold the
-- eight-step initiation flow and the stage-gate lifecycle:
--   - projects             (Project Definition + Strategic Context, steps 1-2)
--   - project_objectives   (the five classified objectives, steps 3-4)
--   - project_milestones   (critical milestones, step 5)
--   - project_workstreams  (workstreams + leads, step 6)
--   - project_risks        (initial risk profile, step 7)
--   - project_briefs       (versioned baseline brief snapshots, step 8)
--   - project_stage_gates  (stage progression + gate status, stages 0-7)
--
-- Plus one trigger-driven workflow:
--   - on projects INSERT → seed 5 objective slots + 8 stage-gate rows
--
-- Notes on conventions:
--   - Primary keys use gen_random_uuid() (built into Postgres, no
--     extension needed). Earlier migrations used uuid_generate_v4();
--     both produce v4 UUIDs.
--   - Fixed-domain columns use native Postgres enums (per the M3.1
--     spec). Earlier tables used TEXT + CHECK; this migration follows
--     the spec's explicit enum instruction.
--   - The updated_at trigger reuses the update_updated_at() function
--     defined in 001_initial_schema.sql.
-- ========================================================================

-- ========================================================================
-- ENUMS
--
-- Two enums are shared because their value domains are identical and
-- the PULSE framework treats them as one concept:
--   - criticality_level : milestones, workstreams, risks (the cascade)
--   - risk_level        : a risk's likelihood and its impact
-- ========================================================================

-- Procurement route for a project (projects.procurement_route).
CREATE TYPE procurement_route AS ENUM (
  'design_bid_build',
  'design_build',
  'construction_management',
  'management_contracting',
  'other'
);

-- Lifecycle status of a project (projects.status).
CREATE TYPE project_status AS ENUM (
  'draft',
  'active',
  'on_hold',
  'completed',
  'archived'
);

-- The five objective types (project_objectives.objective_type).
-- funding is included as a fifth type by design (framework, Section 6).
-- Reducing to the classic four later is an enum-value change.
CREATE TYPE objective_type AS ENUM (
  'scope',
  'cost',
  'time',
  'quality',
  'funding'
);

-- Objective criticality classification (project_objectives.classification).
CREATE TYPE objective_classification AS ENUM (
  'non_negotiable',
  'flexible'
);

-- Criticality cascaded from the objective served. Shared by milestones,
-- workstreams, and risks.
CREATE TYPE criticality_level AS ENUM (
  'critical',
  'standard'
);

-- Milestone progress (project_milestones.status).
CREATE TYPE milestone_status AS ENUM (
  'pending',
  'in_progress',
  'complete'
);

-- Risk likelihood and impact share this scale.
CREATE TYPE risk_level AS ENUM (
  'low',
  'medium',
  'high'
);

-- Risk lifecycle (project_risks.status).
CREATE TYPE risk_status AS ENUM (
  'open',
  'mitigated',
  'closed'
);

-- Stage-gate status (project_stage_gates.gate_status).
CREATE TYPE gate_status AS ENUM (
  'not_started',
  'in_progress',
  'passed'
);

-- ========================================================================
-- PROJECTS
--
-- The core project record. Holds the Project Definition (step 1) and
-- Strategic Context (step 2), plus the project's current lifecycle stage
-- and status. Owned by the creating user (user_id).
-- ========================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Project Definition (initiation step 1)
  name TEXT NOT NULL,
  project_type TEXT,
  category TEXT,
  sub_category TEXT,
  description TEXT,
  location TEXT,
  size TEXT,
  procurement_route procurement_route,
  funding_structure TEXT,
  start_date DATE,
  target_completion_date DATE,

  -- Strategic Context (initiation step 2)
  strategic_rationale TEXT,
  target_end_user TEXT,
  exit_strategy TEXT,
  strategic_alignment TEXT,

  -- Lifecycle position and status. Build starts at Stage 1; the check
  -- keeps the stage within the framework's 0-7 range.
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 0 AND 7),
  status project_status NOT NULL DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECT_OBJECTIVES
--
-- The five classified objectives per project, one row per objective type.
-- Auto-seeded by handle_new_project() with empty definitions and a
-- flexible classification, ready for the user to fill in during steps
-- 3-4. classification defaults to flexible because that is the safe
-- scaffold state: only an excess of non_negotiable objectives can later
-- trip the over-constraint warning, so an un-entered slot should never
-- read as non_negotiable. rank is set during the Constraint Ranking step.
-- ========================================================================
CREATE TABLE project_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  objective_type objective_type NOT NULL,
  definition TEXT,
  classification objective_classification NOT NULL DEFAULT 'flexible',
  tolerance TEXT,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- One row per objective type per project.
  UNIQUE (project_id, objective_type)
);

-- ========================================================================
-- PROJECT_MILESTONES
--
-- Critical milestones (step 5). Each carries a criticality cascaded from
-- the objective it serves (linked_objective_id).
-- ========================================================================
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality criticality_level NOT NULL DEFAULT 'standard',
  status milestone_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECT_WORKSTREAMS
--
-- Workstreams (step 6), each with an assigned lead and a criticality
-- cascaded from the objective it serves.
-- ========================================================================
CREATE TABLE project_workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lead TEXT,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality criticality_level NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECT_RISKS
--
-- Initial risk profile (step 7). Each risk is tagged to the objective it
-- threatens (linked_objective_id) and carries a cascaded criticality.
-- ========================================================================
CREATE TABLE project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  likelihood risk_level,
  impact risk_level,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality criticality_level NOT NULL DEFAULT 'standard',
  mitigation TEXT,
  status risk_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECT_BRIEFS
--
-- The versioned baseline brief (step 8). Each lock creates a new version
-- row. content is a point-in-time jsonb snapshot of the assembled brief,
-- not a queryable working record (the structured tables above are the
-- working records). version is unique per project.
-- ========================================================================
CREATE TABLE project_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Version numbers do not repeat within a project.
  UNIQUE (project_id, version)
);

-- ========================================================================
-- PROJECT_STAGE_GATES
--
-- Stage progression and gate status, one row per stage (0-7). Auto-seeded
-- by handle_new_project(). objective_lens_confirmed records the constant
-- objective-lens test from the framework. stage_checklist holds the
-- stage-specific checklist items and their state as jsonb.
-- ========================================================================
CREATE TABLE project_stage_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage BETWEEN 0 AND 7),
  gate_status gate_status NOT NULL DEFAULT 'not_started',
  stage_checklist JSONB,
  objective_lens_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  passed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- One row per stage per project.
  UNIQUE (project_id, stage)
);

-- ========================================================================
-- UPDATED_AT TRIGGERS
--
-- Reuse the update_updated_at() function from 001_initial_schema.sql for
-- every table that carries an updated_at column (all except
-- project_briefs, which is append-only and has created_at only).
-- ========================================================================
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_objectives_updated_at
  BEFORE UPDATE ON project_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_milestones_updated_at
  BEFORE UPDATE ON project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_workstreams_updated_at
  BEFORE UPDATE ON project_workstreams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_risks_updated_at
  BEFORE UPDATE ON project_risks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER project_stage_gates_updated_at
  BEFORE UPDATE ON project_stage_gates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- HANDLE_NEW_PROJECT  — trigger on projects INSERT
--
-- When a new project is created, scaffold its child rows so the
-- initiation flow has slots to populate:
--   - five project_objectives rows, one per objective_type, classified
--     flexible by default;
--   - eight project_stage_gates rows, one per stage (0-7), not_started.
--
-- SECURITY DEFINER (mirroring handle_new_user) lets the seed write the
-- child rows regardless of RLS. The seeds are derived from the enum and
-- a generate_series so they stay correct if the stage range or the
-- objective_type enum changes.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- One objective slot per objective_type, in enum declaration order.
  INSERT INTO project_objectives (project_id, objective_type)
  SELECT NEW.id, ot
  FROM unnest(enum_range(NULL::objective_type)) AS ot;

  -- One stage-gate row per lifecycle stage, 0 through 7.
  INSERT INTO project_stage_gates (project_id, stage)
  SELECT NEW.id, gs
  FROM generate_series(0, 7) AS gs;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_project();

-- ========================================================================
-- 015_pulse_brief_widening_schema.sql
--
-- S1 of the Brief widening. Takes PULSE initiation from the eight-step flow
-- to the nine-step governing baseline of the PULSE Framework v1.1, up to and
-- including the Brief. ADDITIVE ONLY: new enums, new nullable columns, and
-- new tables. Nothing is dropped or renamed, so live projects, locked briefs,
-- and the downstream modules (Gate, Risk register, Action Log, digest,
-- workspace) keep working unchanged.
--
-- New steps this schema serves:
--   3 Scope and Site               -> project_scope_site (1:1)
--   4 Organisation and Governance  -> project_stakeholders, projects.authority,
--                                     reporting cadence
--   6 Financial Baseline           -> project_budget (1:1) + project_funding_milestones
--   7 Programme                    -> project_stage_gates.target_date
--   8 Risks, Assumptions, Constraints and Dependencies
--                                  -> project_assumptions / _constraints / _dependencies
-- Plus structured size measures and a country on step 1, an objective
-- override reason on step 5, and a completion-and-handover field on step 2.
--
-- The two 1:1 records (scope_site, budget) are seeded by handle_new_project()
-- for new projects. Projects created before this migration have no seed row,
-- so the wizard steps insert-if-absent (upsert on project_id) when they save.
--
-- Idempotent: enum creates are guarded, columns and tables use IF NOT EXISTS,
-- triggers are dropped before create. Apply in the Supabase SQL editor.
-- ========================================================================

-- ========================================================================
-- NEW ENUMS  (guarded so a re-run is a no-op, mirroring 009)
-- ========================================================================

-- Jurisdiction for geography tailoring (framework Section 7).
DO $$ BEGIN
  CREATE TYPE project_country AS ENUM ('united_kingdom', 'nigeria', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- The role a party plays (project_stakeholders.role). The framework's named
-- set, plus other for anything else.
DO $$ BEGIN
  CREATE TYPE stakeholder_role AS ENUM (
    'developer', 'funder', 'project_manager', 'consultant', 'contractor', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Planning or consent status of the site (project_scope_site.planning_status).
-- Generic by design; the UI relabels per country (UK planning, Nigeria consent).
DO $$ BEGIN
  CREATE TYPE planning_status AS ENUM (
    'no_application', 'pre_application', 'outline_consent', 'full_consent',
    'reserved_matters', 'approved', 'refused', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- The shape of the money behind the scheme (project_budget.funding_structure_type).
DO $$ BEGIN
  CREATE TYPE funding_structure_type AS ENUM (
    'senior_debt', 'mezzanine', 'equity', 'jv', 'development_finance',
    'bridging', 'off_plan_presales', 'self_funded', 'grant', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- A funding milestone's state (project_funding_milestones.status).
DO $$ BEGIN
  CREATE TYPE funding_milestone_status AS ENUM ('planned', 'secured', 'drawn');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- PROJECTS  new columns
--   step 1: country (location keeps the city), structured size measures
--   step 2: what completion and handover require
--   step 4: reporting cadence and who the digest serves
-- The named authority FK is added after project_stakeholders exists, below.
-- ========================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS country             project_country,
  ADD COLUMN IF NOT EXISTS size_measures       JSONB,
  ADD COLUMN IF NOT EXISTS completion_handover TEXT,
  ADD COLUMN IF NOT EXISTS reporting_cadence   TEXT,
  ADD COLUMN IF NOT EXISTS digest_recipient    TEXT;

COMMENT ON COLUMN projects.country IS
  'Jurisdiction for geography tailoring (framework Section 7). projects.location holds the city.';
COMMENT ON COLUMN projects.size_measures IS
  'Structured size measures suited to the project type (unit count, gross internal area, plot size, storeys). Legacy free-text size is retained in projects.size.';
COMMENT ON COLUMN projects.completion_handover IS
  'Step 2: what completion and handover will require. Sets what done means at the far end.';
COMMENT ON COLUMN projects.reporting_cadence IS
  'Step 4: the agreed reporting cadence (a recorded baseline fact).';
COMMENT ON COLUMN projects.digest_recipient IS
  'Step 4: who the weekly digest serves (a recorded baseline fact; does not wire the live digest).';

-- ========================================================================
-- PROJECT_OBJECTIVES  override reason (step 5)
-- target reuses the existing definition column; derived criticality is
-- computed in app code from classification, not stored.
-- ========================================================================
ALTER TABLE project_objectives
  ADD COLUMN IF NOT EXISTS override_reason TEXT;

COMMENT ON COLUMN project_objectives.override_reason IS
  'Optional reason the developer gave when overriding a default classification.';

-- ========================================================================
-- PROJECT_STAGE_GATES  a target date per gate (step 7)
-- Seeds the lifecycle programme baseline the Programme Tracker measures
-- against. Additive: the Gate module reads gate_status, passed_at, decided_by
-- and over_constraint_acknowledged, none of which change here.
-- ========================================================================
ALTER TABLE project_stage_gates
  ADD COLUMN IF NOT EXISTS target_date DATE;

COMMENT ON COLUMN project_stage_gates.target_date IS
  'Step 7: target date for this stage gate.';

-- ========================================================================
-- PROJECT_STAKEHOLDERS  the parties and their roles (step 4)
-- The single named authority is recorded on projects.authority_stakeholder_id
-- (added below), not as a flag here, so a project has exactly one authority.
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_stakeholders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  organisation TEXT,
  role         stakeholder_role NOT NULL DEFAULT 'other',
  contact      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECT_SCOPE_SITE  the development brief and the site (step 3), one per
-- project. Scope detail varies by type, so the mix and quantum are held
-- structured rather than as fixed columns.
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_scope_site (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  development_summary  TEXT,
  mix_quantum          JSONB,
  spec_standard        TEXT,
  site_area            TEXT,
  planning_status      planning_status,
  planning_constraints TEXT,
  physical_constraints TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON COLUMN project_scope_site.mix_quantum IS
  'Structured mix and quantum, shaped to the project type (a tower and a single plot differ).';

-- ========================================================================
-- PROJECT_BUDGET  the headline financial baseline (step 6), one per project.
-- The breakdown varies in shape, so it is held structured. The headline total
-- stays on projects.budget and the currency on projects.currency. Building the
-- model behind these figures is STACK's job (the STACK nudge sits on step 6).
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_budget (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  budget_breakdown       JSONB,
  funding_structure_type funding_structure_type,
  funding_notes          TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON COLUMN project_budget.budget_breakdown IS
  'Headline budget breakdown, at minimum hard cost, soft cost and contingency, in projects.currency.';

-- ========================================================================
-- PROJECT_FUNDING_MILESTONES  the points at which funding is drawn or must be
-- in place (step 6). Many per project.
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_funding_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount      NUMERIC,
  target_date DATE,
  status      funding_milestone_status NOT NULL DEFAULT 'planned',
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- RAID siblings to project_risks (step 8): assumptions, constraints and
-- dependencies. Each carries a link to the objective it bears on and a
-- cascaded criticality, exactly like project_risks, so the cascade reaches
-- the whole RAID picture. These seed the Risk register's later RAID
-- expansion; no downstream module reads them yet (out of scope here).
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_assumptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  detail              TEXT,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality         criticality_level NOT NULL DEFAULT 'standard',
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS project_constraints (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  detail              TEXT,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality         criticality_level NOT NULL DEFAULT 'standard',
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS project_dependencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  detail              TEXT,
  linked_objective_id UUID REFERENCES project_objectives(id) ON DELETE SET NULL,
  criticality         criticality_level NOT NULL DEFAULT 'standard',
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================================
-- PROJECTS.authority_stakeholder_id  the single named authority (step 4),
-- the one point that signs off a gate and approves a re-baseline. Added now
-- that project_stakeholders exists. ON DELETE SET NULL keeps the project
-- intact if the chosen party is later removed.
-- ========================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS authority_stakeholder_id UUID
    REFERENCES project_stakeholders(id) ON DELETE SET NULL;

COMMENT ON COLUMN projects.authority_stakeholder_id IS
  'The named authority: the single project_stakeholders party that governs gate sign-off and re-baseline.';

-- ========================================================================
-- UPDATED_AT TRIGGERS for the new tables (reuse update_updated_at() from 001).
-- Dropped before create so a re-run is a no-op.
-- ========================================================================
DROP TRIGGER IF EXISTS project_stakeholders_updated_at ON project_stakeholders;
CREATE TRIGGER project_stakeholders_updated_at
  BEFORE UPDATE ON project_stakeholders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_scope_site_updated_at ON project_scope_site;
CREATE TRIGGER project_scope_site_updated_at
  BEFORE UPDATE ON project_scope_site
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_budget_updated_at ON project_budget;
CREATE TRIGGER project_budget_updated_at
  BEFORE UPDATE ON project_budget
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_funding_milestones_updated_at ON project_funding_milestones;
CREATE TRIGGER project_funding_milestones_updated_at
  BEFORE UPDATE ON project_funding_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_assumptions_updated_at ON project_assumptions;
CREATE TRIGGER project_assumptions_updated_at
  BEFORE UPDATE ON project_assumptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_constraints_updated_at ON project_constraints;
CREATE TRIGGER project_constraints_updated_at
  BEFORE UPDATE ON project_constraints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS project_dependencies_updated_at ON project_dependencies;
CREATE TRIGGER project_dependencies_updated_at
  BEFORE UPDATE ON project_dependencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- HANDLE_NEW_PROJECT  also seed the two 1:1 records the new steps update,
-- alongside the existing five objectives and eight stage gates. CREATE OR
-- REPLACE keeps the existing trigger (on_project_created) pointing at it.
-- The seeds for old projects are handled by upsert in the wizard steps.
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

  -- One scope-and-site record and one budget record for the wizard to update.
  INSERT INTO project_scope_site (project_id) VALUES (NEW.id);
  INSERT INTO project_budget (project_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

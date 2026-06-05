-- ========================================================================
-- 008_gate_decision.sql
--
-- M5, Gate 1 to 2. Records the go decision that advances a project from
-- Stage 1 (Objectives and Funding) to Stage 2 (Consultant Appointment).
--
-- The decision is written onto the project_stage_gates row that represents
-- the stage being closed: stage = 1 is the Gate 1 to 2 row. Three facts the
-- decision needs already have homes on that table and are reused as-is:
--   - outcome (passed)  -> gate_status set to 'passed'
--   - when              -> passed_at (this is decided_at)
--   - lens satisfied    -> objective_lens_confirmed set true
-- Two facts have no column yet, so this migration adds them:
--   - decided_by                   who passed the gate (the auth user id)
--   - over_constraint_acknowledged whether the developer acknowledged an
--                                  over-constrained objective set at sign-off
--
-- Idempotent: every add is guarded with IF NOT EXISTS, so re-running is safe.
-- RLS is untouched. The project_stage_gates owner policies in
-- 005_pulse_projects_rls.sql already let the owner update these rows, and
-- projects.current_stage is updated under the existing projects policies, so
-- no policy changes are needed.
--
-- Apply this in the Supabase SQL editor before testing.
-- ========================================================================

-- Who signed the gate off. Nullable: the eight seeded rows carry no decision
-- until their gate is passed. ON DELETE SET NULL keeps a passed gate's record
-- intact if the auth user is ever removed.
ALTER TABLE project_stage_gates
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Whether the developer acknowledged proceeding with no flexible objective
-- (the over-constraint caution at Gate 1 to 2). Defaults to false, the
-- correct reading for every gate not yet passed and for any gate passed
-- without an over-constraint warning.
ALTER TABLE project_stage_gates
  ADD COLUMN IF NOT EXISTS over_constraint_acknowledged BOOLEAN NOT NULL DEFAULT false;

-- current_stage is defined in 004 with a Stage 1 default and a 0..7 CHECK.
-- Confirmed present; this guarded add is a no-op there and only protects a
-- database that somehow lacks the column. Postgres skips the add entirely
-- when the column already exists, so the existing default and CHECK are
-- left intact.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS current_stage INTEGER NOT NULL DEFAULT 1;

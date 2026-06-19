-- ========================================================================
-- 018_action_log_reroot_schema.sql
--
-- Phase 2, A1. The schema widening that re-roots the Action Log on the
-- 8-6-4. ADDITIVE ONLY: new nullable columns, one new enum, and new values
-- on an existing enum. Nothing is dropped or renamed, so every action
-- already logged keeps working unchanged, and the live Action Log (which
-- does not yet read these columns) is unaffected until the later sub-steps
-- wire them in.
--
-- What this serves (the re-root additions, by later sub-step):
--   A2 live criticality + override -> criticality_override, override_reason
--   A3 gate-readiness              -> stage
--   A4 provenance and citation     -> reason
--   A5 RAID surfacing              -> source += assumption, constraint, dependency
--   A7 outcome capture on close    -> outcome, variance
--
-- COLUMN NOTES
--   stage          The lifecycle stage (0 to 7) the action bears on, the
--                  basis of the gate-readiness view. Stamped at creation in
--                  app code from A3 onward (the project's current_stage, or
--                  the play's stage for a playbook action). Null on rows
--                  created before that, read as the current stage by the
--                  gate-readiness view, so no existing action is lost.
--   reason         The citable one-line why an engine-surfaced or promoted
--                  action was raised. Null for a hand-logged action. The
--                  engine knowledge-source label (this project, playbook
--                  library) is derived from source in app code (A4), so no
--                  separate provenance column is added now; one follows only
--                  if external-reference or network sources land.
--   criticality_override / override_reason
--                  The constrained, reason-tagged deviation from the derived
--                  criticality. DOWNWARD ONLY: it may lower the weight the
--                  linked objective derives (in the binary scheme, critical
--                  to standard), never raise it, so nothing is protected more
--                  than the objective it serves. Enforced in app code (A2);
--                  the derivation is never erased, both values are shown.
--                  Reuses the criticality_level enum (one vocabulary).
--   outcome / variance
--                  Captured when an action is closed (A7), the input to the
--                  lessons-learnt loop and the gate reconciliation. outcome
--                  is a small enum; variance is the free-text deviation from
--                  plan. Both null until close, and close stays permissive.
--
-- SOURCE ENUM. action_source gains assumption, constraint, and dependency,
-- so the needs-your-response feed can promote a RAID item (project_assumptions,
-- project_constraints, project_dependencies) to a tracked action the same way
-- it promotes a risk, with source_id carrying the originating row id
-- (polymorphic, no FK, as for risk).
--
-- RLS is untouched: the project_actions owner policies in 010_action_log.sql
-- already scope every row, whatever its columns. updated_at is still
-- maintained by the shared trigger from 010. No new index: stage and the
-- override are filtered within a single project's small action set, already
-- covered by idx_project_actions_project_id.
--
-- Idempotent: the enum create is guarded, ADD VALUE uses IF NOT EXISTS, and
-- every column add uses IF NOT EXISTS, so re-running is safe.
--
-- Apply this in the Supabase SQL editor before testing. If the editor wraps
-- the whole script in one transaction and objects to the ADD VALUE lines,
-- run those three ALTER TYPE statements on their own first, then the rest.
-- ========================================================================

-- The outcome recorded when an action is closed (A7). delivered: done as
-- planned. partial: done with a compromise worth noting. not_delivered:
-- closed without delivering. The variance column carries the narrative.
DO $$ BEGIN
  CREATE TYPE action_outcome AS ENUM ('delivered', 'partial', 'not_delivered');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- New source values for the RAID feed (A5). Appended to the existing
-- manual / risk / programme / playbook. IF NOT EXISTS makes a re-run a no-op.
ALTER TYPE action_source ADD VALUE IF NOT EXISTS 'assumption';
ALTER TYPE action_source ADD VALUE IF NOT EXISTS 'constraint';
ALTER TYPE action_source ADD VALUE IF NOT EXISTS 'dependency';

-- The new columns, all nullable and additive (see COLUMN NOTES above).
ALTER TABLE project_actions
  ADD COLUMN IF NOT EXISTS stage                INTEGER CHECK (stage BETWEEN 0 AND 7),
  ADD COLUMN IF NOT EXISTS reason               TEXT,
  ADD COLUMN IF NOT EXISTS criticality_override criticality_level,
  ADD COLUMN IF NOT EXISTS override_reason      TEXT,
  ADD COLUMN IF NOT EXISTS outcome              action_outcome,
  ADD COLUMN IF NOT EXISTS variance             TEXT;

COMMENT ON COLUMN project_actions.stage IS
  'Lifecycle stage (0 to 7) the action bears on; basis of the gate-readiness view. Stamped at creation from A3 onward; null read as the current stage.';
COMMENT ON COLUMN project_actions.reason IS
  'The citable one-line why an engine-surfaced or promoted action was raised. Null for a hand-logged action.';
COMMENT ON COLUMN project_actions.criticality_override IS
  'Constrained downward-only deviation from the derived criticality (critical to standard only); never raises it. Enforced in app code; the derivation is never erased.';
COMMENT ON COLUMN project_actions.override_reason IS
  'The reason recorded with a criticality_override, shown alongside the derived value.';
COMMENT ON COLUMN project_actions.outcome IS
  'Outcome recorded when the action is closed (A7): the lessons-learnt input. Null until close.';
COMMENT ON COLUMN project_actions.variance IS
  'Free-text deviation from plan recorded at close, alongside outcome.';

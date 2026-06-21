-- ========================================================================
-- 019_programme_entries_persistence.sql
--
-- Step 7 Brief programme update, sub-step 1b. Stores the developer's
-- programme choices against the curated template (lib/engine/programmeTemplate.js):
-- per stage gate an N/A flag, and per template milestone a chosen date and an
-- optional note. The chosen gate date already lives on project_stage_gates.target_date
-- (added in 015), so this extends that same store rather than starting a parallel one.
--
-- Choices ride on the existing project_stage_gates rows, so they sit inside the
-- Brief data the wizard reads and the existing project_briefs lock snapshot
-- captures at lock. No new table, no separate snapshot.
--
-- ADDITIVE ONLY: two new nullable-or-defaulted columns on an existing table.
-- Nothing is dropped or renamed. The Gate module's own columns (gate_status,
-- passed_at, decided_by, over_constraint_acknowledged, stage_checklist) are
-- untouched, so Gate, the brief and the downstream modules keep working.
--
-- Store choices only. Advised dates are derived at read time by
-- lib/engine/programmeSchedule.js and are never persisted here.
--
-- RLS and indexes are unchanged: row-level policies cover new columns
-- automatically, and a per-stage JSONB of choices needs no index (it is read
-- with the row, never filtered on). Idempotent: IF NOT EXISTS guards a re-run.
-- Apply in the Supabase SQL editor.
-- ========================================================================

-- ========================================================================
-- PROJECT_STAGE_GATES  programme choices (step 7, sub-step 1b)
--   target_na          the developer marked this stage gate not applicable
--   milestone_choices  per template milestone, the chosen date and an optional
--                      note, keyed by the milestone's stable key (programmeTemplate.js)
-- ========================================================================
ALTER TABLE project_stage_gates
  ADD COLUMN IF NOT EXISTS target_na        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS milestone_choices JSONB;

COMMENT ON COLUMN project_stage_gates.target_na IS
  'Step 7: the developer marked this stage gate not applicable. The chosen gate date stays in target_date.';

COMMENT ON COLUMN project_stage_gates.milestone_choices IS
  'Step 7: the developer''s choices for this stage''s template milestones, an object keyed by the milestone''s stable key (lib/engine/programmeTemplate.js): { "<key>": { "target_date": "YYYY-MM-DD" | null, "note": text | null } }. Stores choices only; advised dates are derived, never stored.';

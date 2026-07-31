-- 033: the declared entry stage (Note 12, mid-project adoption).
--
-- PULSE assumed every project enters at initiation and moves forward from
-- Stage 1. A developer adopting PULSE mid-lifecycle declares where the project
-- already is at Step 1 (Project Definition): "Where is this project today?".
-- Every stage before the declared stage reads as complete, finished before the
-- project entered PULSE; its gates are recorded as completed prior to adoption,
-- never run through the gate ceremony.
--
-- Additive only: one new column on projects, defaulted to the from-scratch
-- entry stage (Stage 1, Project Objectives and Funding), so every existing
-- project and every project set up from scratch behaves exactly as today.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS entry_stage INTEGER NOT NULL DEFAULT 1
    CHECK (entry_stage BETWEEN 0 AND 7);

COMMENT ON COLUMN projects.entry_stage IS
  'The lifecycle stage the project was at when it adopted PULSE (Step 1, Where is this project today?). Stages before it are complete prior to adoption. Default 1, the from-scratch entry stage.';

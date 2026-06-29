-- ========================================================================
-- 021_programme_milestone_actuals.sql
--
-- Programme module Phase 3.3, the milestone actuals store. One new table,
-- programme_milestone_actuals, the mutable counterpart to the frozen v1
-- baseline (020): the record of which milestones have been met. The combined
-- met-points view the percent-complete engine (3.1) and the RAG engine (3.2)
-- read is stitched in app code (programmeActualsStore.js) from this table plus
-- the gate-met status the existing gate mechanic already records on
-- project_stage_gates. No second record of gate-met is created here.
--
-- THE DELIBERATE OPPOSITE OF THE BASELINE. 020 is an append-only, immutable,
-- versioned snapshot. This table is mutable: one row per met milestone per
-- project, correctable in place (amend the met date) and removable (un-mark).
-- A row's existence means the milestone is met; there is no met-false row and
-- no partial state.
--
-- KEYED TO THE MILESTONE, NOT TO A BASELINE VERSION. milestone_key is the
-- point's stable key (the template key the assembled baseline carries), not a
-- reference to any programme_baselines row. So an actual rides through a
-- re-baseline untouched, and a row for a point a later baseline no longer holds
-- is simply ignored by the engines, which iterate the baseline and only ever
-- look a point up by its key. The key is NOT validated against a baseline here:
-- surfacing only real milestones to mark is the UI's job.
--
-- GATES ARE NOT HERE. A gate is not a milestone and gets no second met record.
-- Gate-met is read from the existing mechanic: project_stage_gates carries
-- gate_status ('passed' means met) and passed_at (the date it was passed), one
-- row per stage (0..7), and the stage integer maps one to one onto the
-- baseline's gate_<stage> key. The view assembly stitches the two in app code.
--
-- THE AUDIT STAMP. recorded_by and recorded_at record who marked the milestone
-- met and when, set once at the mark and preserved across amendments as the
-- provenance of the met record. updated_at is the shared last-updated stamp,
-- maintained by the update_updated_at() trigger from 001: it equals recorded_at
-- on a fresh mark and is bumped on every amendment, since the row is correctable.
--
-- RLS mirrors 010_action_log.sql: a user reaches an actual only through a
-- project they own, with SELECT, INSERT, UPDATE and DELETE (the un-mark)
-- policies. The mark-or-amend write is the record_milestone_actual function,
-- a single atomic upsert that preserves the original audit stamp on amendment.
--
-- Idempotent: the table, indexes and trigger use IF NOT EXISTS or DROP-before-
-- create, the policies are guarded, and the function is CREATE OR REPLACE, so
-- re-running is safe. Apply this in the Supabase SQL editor before testing.
-- Do NOT apply it to production before the live walkthrough; it lands at merge
-- through the normal flow.
-- ========================================================================

-- ========================================================================
-- PROGRAMME_MILESTONE_ACTUALS
--   project_id     the project the actual belongs to
--   milestone_key  the milestone's stable point key (the key the assembled
--                  baseline carries), keyed to the milestone, not a baseline
--                  version; not validated against any baseline here
--   met_date       the date the milestone was met
--   recorded_by    who marked it met (the auth user id), the audit stamp
--   recorded_at    when it was first marked met, preserved across amendments
--   updated_at     the last-updated stamp, bumped on every amendment
-- ========================================================================
CREATE TABLE IF NOT EXISTS programme_milestone_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  met_date DATE NOT NULL,
  -- ON DELETE SET NULL keeps a met record intact if the auth user is ever
  -- removed, mirroring decided_by on project_stage_gates (008).
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A milestone is either met (one row) or not (no row): one actual per point.
  -- This unique constraint is also the conflict target the mark-or-amend upsert
  -- keys on, and its leading column (project_id) serves the per-project read, so
  -- no separate project_id index is needed.
  CONSTRAINT programme_milestone_actuals_point_unique UNIQUE (project_id, milestone_key)
);

COMMENT ON TABLE programme_milestone_actuals IS
  'Mutable store of met milestones (Programme Phase 3.3). One row per met milestone per project; a row''s existence means the milestone is met (no met-false row, no partial state). Keyed by milestone_key to the milestone itself, not to a baseline version, so it rides through a re-baseline. The combined met-points view the engines read is stitched in app code from this table plus gate-met on project_stage_gates.';
COMMENT ON COLUMN programme_milestone_actuals.milestone_key IS
  'The milestone''s stable point key (the key the assembled baseline carries). Not a baseline reference and not validated against a baseline here; the engines ignore a key no baseline contains.';
COMMENT ON COLUMN programme_milestone_actuals.met_date IS
  'The date the milestone was met. Correctable by amending the row.';
COMMENT ON COLUMN programme_milestone_actuals.recorded_by IS
  'Who marked the milestone met (the auth user id). Set at the mark and preserved across amendments.';
COMMENT ON COLUMN programme_milestone_actuals.recorded_at IS
  'When the milestone was first marked met. Set at the mark and preserved across amendments.';
COMMENT ON COLUMN programme_milestone_actuals.updated_at IS
  'The last-updated stamp (update_updated_at() trigger from 001). Equals recorded_at on a fresh mark; bumped on every amendment.';

-- ========================================================================
-- LAST-UPDATED STAMP via the shared trigger function (001), per convention,
-- so an amendment bumps updated_at without app code setting it.
-- ========================================================================
DROP TRIGGER IF EXISTS programme_milestone_actuals_updated_at ON programme_milestone_actuals;
CREATE TRIGGER programme_milestone_actuals_updated_at
  BEFORE UPDATE ON programme_milestone_actuals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- ROW LEVEL SECURITY. Reachable only through an owned project, mirroring
-- 010_action_log.sql. SELECT, INSERT, UPDATE and DELETE: a mutable, correctable
-- store, where the DELETE is the un-mark.
-- ========================================================================
ALTER TABLE programme_milestone_actuals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own milestone actuals"
    ON programme_milestone_actuals FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_milestone_actuals.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own milestone actuals"
    ON programme_milestone_actuals FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_milestone_actuals.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own milestone actuals"
    ON programme_milestone_actuals FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_milestone_actuals.project_id
          AND projects.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_milestone_actuals.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own milestone actuals"
    ON programme_milestone_actuals FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_milestone_actuals.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- RECORD_MILESTONE_ACTUAL  the mark-or-amend write path
--
-- One atomic upsert keyed on (project_id, milestone_key): insert the row if the
-- milestone was not yet met, update the met date if it was. The audit stamp is
-- the provenance of the met record, so on an amendment the original recorded_by
-- and recorded_at are PRESERVED (they are not in the DO UPDATE SET); only the
-- met date changes, and the update_updated_at() trigger bumps updated_at. The
-- point unique constraint is the conflict target, so a second mark of the same
-- milestone amends rather than duplicating.
--
-- SECURITY INVOKER: the function runs as the caller, so RLS applies and the
-- caller can only ever touch their own project's actuals. recorded_by defaults
-- to auth.uid() when not supplied.
-- ========================================================================
CREATE OR REPLACE FUNCTION record_milestone_actual(
  p_project_id    UUID,
  p_milestone_key TEXT,
  p_met_date      DATE,
  p_recorded_by   UUID DEFAULT NULL
)
RETURNS programme_milestone_actuals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row programme_milestone_actuals;
BEGIN
  INSERT INTO programme_milestone_actuals (
    project_id, milestone_key, met_date, recorded_by
  ) VALUES (
    p_project_id,
    p_milestone_key,
    p_met_date,
    COALESCE(p_recorded_by, auth.uid())
  )
  ON CONFLICT (project_id, milestone_key)
  -- Amend: only the met date changes. recorded_by and recorded_at are left
  -- untouched (preserved provenance); the BEFORE UPDATE trigger bumps updated_at.
  DO UPDATE SET met_date = EXCLUDED.met_date
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- The write path is called by authenticated developers from the app. RLS
-- (SECURITY INVOKER above) still scopes every row to the caller's own projects,
-- so anon cannot reach another developer's data.
REVOKE EXECUTE ON FUNCTION record_milestone_actual(UUID, TEXT, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_milestone_actual(UUID, TEXT, DATE, UUID) TO authenticated;

-- ========================================================================
-- 020_programme_baselines.sql
--
-- Programme module Phase 2.2, the v1 baseline store. One new table,
-- programme_baselines, holding the frozen operational baseline produced at
-- the end of set-up: one immutable row per version per project. v1 is the
-- first row, written at lock. A re-baseline later writes a new row (v2, v3,
-- and on) and never edits an old one. The current baseline is the latest
-- version, the single row whose superseded_at is null, read wholesale by the
-- tracking surface with nothing re-derived.
--
-- This mirrors the append-only project_briefs snapshot (004): a versioned
-- jsonb snapshot, unique version per project, no updated_at. It is the
-- persistence behind set-up step 5 in the Programme specification. The lock
-- screen (Phase 2.3) and progress, status and RAG (Phase 3) are NOT here.
--
-- WHAT THE FROZEN SNAPSHOT IS. The programme column holds the whole
-- self-contained object assembleProgramme (lib/engine/programmeAssembly.js)
-- produces: the fully-resolved two-level programme, every gate and milestone
-- dated, criticality baked, each item tagged carried or added. It is stored
-- as-is and read back as-is. Nothing about a baseline is re-derived at read.
--
-- THE ONE-CURRENT INVARIANT, held structurally. Exactly one row per project
-- has a null superseded_at: the current baseline. The partial unique index
-- below makes the database itself reject a second current row. A re-baseline
-- supersedes the prior row and inserts the new one atomically in the
-- lock_programme_baseline function, so a reader never sees zero or two current
-- baselines.
--
-- IMMUTABLE CONTENT. The frozen programme is never edited. The only write
-- ever made to an existing row is stamping superseded_at, once, at
-- re-baseline. The programme_baselines_immutable trigger enforces this: every
-- column except superseded_at is frozen, and superseded_at is set once and
-- never cleared or rewritten.
--
-- THE RE-BASELINE REASON. Null for v1 (the first baseline carries no reason),
-- required and non-empty on every later version. The reason_rule CHECK
-- enforces this at the row level; the store enforces it in app code too.
--
-- NOT STORED HERE. The RAG tolerance is a tracking-time dial owned by Phase 3,
-- defaulted to four weeks there. It is deliberately absent from this table and
-- from a baseline row. No actuals, no met-milestone record, no progress: those
-- are Phase 3 concerns kept outside the frozen baseline.
--
-- RLS mirrors 010_action_log.sql: a user reaches a baseline only through a
-- project they own. SELECT, INSERT and UPDATE policies (the UPDATE covers the
-- supersede stamp); no DELETE policy, the store is append-only.
--
-- Idempotent: the table, indexes and trigger use IF NOT EXISTS or DROP-before-
-- create, and the policies and functions are guarded or CREATE OR REPLACE, so
-- re-running is safe. Apply this in the Supabase SQL editor before testing.
-- Do NOT apply it to production before the live walkthrough; it lands at merge
-- through the normal flow.
-- ========================================================================

-- ========================================================================
-- PROGRAMME_BASELINES
--   project_id         the project the baseline belongs to
--   version            1 for v1, incrementing on each re-baseline
--   source_brief_id    the locked Brief (v0) this baseline was assembled from,
--                      for provenance (project_briefs.id)
--   locked_by          the user who locked this baseline
--   locked_at          when it was locked
--   programme          the frozen assembled programme, the whole object from
--                      assembleProgramme, stored as jsonb and never edited
--   rebaseline_reason  null for v1, required on every later version
--   superseded_at      null while this row is the current baseline, stamped
--                      when a newer version replaces it
--   created_at         when the row was written
-- ========================================================================
CREATE TABLE IF NOT EXISTS programme_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  -- source_brief_id and locked_by are part of the immutable lock record, frozen
  -- by the programme_baselines_immutable trigger below. ON DELETE NO ACTION,
  -- not SET NULL: a SET NULL is an internal UPDATE that would fire that trigger
  -- and abort the parent delete, and it would erase frozen provenance. NO ACTION
  -- has its check deferred to statement end, so a project delete (which cascades
  -- the brief, the user's projects and this baseline together via project_id)
  -- still succeeds, with no row left referencing the removed parent. A locked
  -- Brief is append-only and never deleted on its own.
  source_brief_id UUID REFERENCES project_briefs(id) ON DELETE NO ACTION,
  locked_by UUID REFERENCES auth.users(id) ON DELETE NO ACTION,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  programme JSONB NOT NULL,
  rebaseline_reason TEXT,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Version numbers do not repeat within a project.
  CONSTRAINT programme_baselines_version_unique UNIQUE (project_id, version),
  -- v1 carries no reason; every later version carries a non-empty one.
  CONSTRAINT programme_baselines_reason_rule CHECK (
    (version = 1 AND rebaseline_reason IS NULL)
    OR (version > 1 AND rebaseline_reason IS NOT NULL AND btrim(rebaseline_reason) <> '')
  )
);

COMMENT ON TABLE programme_baselines IS
  'Append-only store of the frozen operational programme baseline (Programme Phase 2.2). One immutable row per version per project; the current baseline is the row with a null superseded_at. The programme column is the whole assembleProgramme object, never re-derived at read.';
COMMENT ON COLUMN programme_baselines.version IS
  '1 for v1 (the first baseline at lock), incrementing on each re-baseline.';
COMMENT ON COLUMN programme_baselines.source_brief_id IS
  'The locked Brief (v0) this baseline was assembled from, for provenance (project_briefs.id).';
COMMENT ON COLUMN programme_baselines.programme IS
  'The frozen assembled programme: the whole self-contained object from lib/engine/programmeAssembly.js assembleProgramme. Stored as-is and read back as-is. Immutable after write.';
COMMENT ON COLUMN programme_baselines.rebaseline_reason IS
  'Null for v1; required and non-empty on every later version. The recorded why of a re-baseline.';
COMMENT ON COLUMN programme_baselines.superseded_at IS
  'Null while this row is the current baseline; stamped once when a newer version replaces it. Never cleared or rewritten.';

-- ========================================================================
-- INDEXES
--   the parent lookup, plus the load-bearing invariant: exactly one current
--   baseline per project. The partial unique index makes the database reject
--   a second row with a null superseded_at for the same project.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_programme_baselines_project_id
  ON programme_baselines(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_programme_baselines_current
  ON programme_baselines(project_id) WHERE superseded_at IS NULL;

-- ========================================================================
-- IMMUTABILITY GUARD
--   The frozen programme is never edited. The only permitted write to an
--   existing row is stamping superseded_at, once, from null to a timestamp.
--   Every other column is frozen. This holds the immutable-snapshot rule
--   structurally, not just in app code.
-- ========================================================================
CREATE OR REPLACE FUNCTION programme_baselines_guard_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Every column except superseded_at is frozen for the life of the row.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.source_brief_id IS DISTINCT FROM OLD.source_brief_id
     OR NEW.locked_by IS DISTINCT FROM OLD.locked_by
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
     OR NEW.programme IS DISTINCT FROM OLD.programme
     OR NEW.rebaseline_reason IS DISTINCT FROM OLD.rebaseline_reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'programme_baselines rows are immutable except for the superseded_at stamp';
  END IF;
  -- superseded_at is set once, from null to a value, and never changed after.
  IF OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    RAISE EXCEPTION 'programme_baselines.superseded_at is set once and never changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programme_baselines_immutable ON programme_baselines;
CREATE TRIGGER programme_baselines_immutable
  BEFORE UPDATE ON programme_baselines
  FOR EACH ROW
  EXECUTE FUNCTION programme_baselines_guard_immutable();

-- ========================================================================
-- ROW LEVEL SECURITY. Reachable only through an owned project, mirroring
-- 010_action_log.sql. SELECT, INSERT and UPDATE (the supersede stamp). No
-- DELETE policy: the store is append-only and a baseline is never deleted.
-- ========================================================================
ALTER TABLE programme_baselines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own programme baselines"
    ON programme_baselines FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_baselines.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own programme baselines"
    ON programme_baselines FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_baselines.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can supersede own programme baselines"
    ON programme_baselines FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_baselines.project_id
          AND projects.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = programme_baselines.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- LOCK_PROGRAMME_BASELINE  the atomic write path
--
-- Supersede the current baseline (if any) and insert the new version in one
-- transaction, so the one-current invariant always holds with no window of
-- zero or two current rows. The version, the provenance reference, the locker,
-- the frozen programme and the reason are computed by the store's pure
-- decision logic (programmeBaselineStore.js) and passed in; this function is
-- the atomic executor. The reason_rule CHECK, the version unique constraint
-- and the partial unique current index are the structural backstops, so a
-- stale or malformed plan fails and rolls back rather than corrupting the
-- store.
--
-- SECURITY INVOKER: the function runs as the caller, so RLS applies and the
-- caller can only ever touch their own project's baselines. locked_by
-- defaults to auth.uid() when not supplied.
-- ========================================================================
CREATE OR REPLACE FUNCTION lock_programme_baseline(
  p_project_id       UUID,
  p_version          INTEGER,
  p_programme        JSONB,
  p_source_brief_id  UUID DEFAULT NULL,
  p_locked_by        UUID DEFAULT NULL,
  p_rebaseline_reason TEXT DEFAULT NULL
)
RETURNS programme_baselines
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_new programme_baselines;
BEGIN
  -- Stamp the prior current row superseded. This is the only write ever made
  -- to an existing baseline row, and it is a no-op when there is no current
  -- baseline (the v1 case). The partial unique current index guarantees at
  -- most one row matches, so after this there are zero current rows.
  UPDATE programme_baselines
    SET superseded_at = NOW()
    WHERE project_id = p_project_id
      AND superseded_at IS NULL;

  -- Insert the new version as the current baseline. The reason_rule CHECK and
  -- the version unique constraint reject a malformed or stale plan, rolling
  -- back the supersede above with it.
  INSERT INTO programme_baselines (
    project_id, version, source_brief_id, locked_by, programme, rebaseline_reason
  ) VALUES (
    p_project_id,
    p_version,
    p_source_brief_id,
    COALESCE(p_locked_by, auth.uid()),
    p_programme,
    p_rebaseline_reason
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- The write path is called by authenticated developers from the app. RLS
-- (SECURITY INVOKER above) still scopes every row to the caller's own
-- projects, so anon cannot reach another developer's data.
REVOKE EXECUTE ON FUNCTION lock_programme_baseline(UUID, INTEGER, JSONB, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_programme_baseline(UUID, INTEGER, JSONB, UUID, UUID, TEXT) TO authenticated;

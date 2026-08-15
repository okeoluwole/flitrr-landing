-- ============================================================================
-- 037: project archive, and the delete boundary at the brief lock.
--
-- Framework principle 4, locked baseline: the moment the Project Brief locks,
-- the project stops being a draft and becomes a governance record. Later
-- stages measure against it, the registers are event-sourced on top of it,
-- and the product's whole promise is that the record survives. A record can
-- leave the working list; it cannot be erased from the product.
--
-- So removal has two shapes, split exactly at the lock:
--
--   Never locked (a draft)   hard delete. Nothing of governance value exists;
--                            the cascade removes the set-up rows with it.
--   Locked at least once     archive. status moves to 'archived' (an enum
--                            value the schema has carried since 004, written
--                            here for the first time), the project leaves the
--                            working list, and archived_at / archived_by
--                            record who shelved it and when. Reversible.
--
-- The boundary is enforced HERE, at the write path, not in the UI. The list
-- already withholds its delete control from non-draft rows, but a client is
-- not a boundary: before this migration the database would have obeyed any
-- admin's delete on a fully locked project and cascaded away its briefs,
-- baselines, and event history. The trigger below makes the draft/record
-- line a property of the data, the same move 034 made for criticality.
--
-- The predicate is EXISTS(project_briefs): brief rows are created only by the
-- lock action (StepGeneratedBrief inserts them with is_locked true), so a
-- brief row's existence means this brief has been locked at least once.
-- Deliberately NOT is_locked = true: reopening a brief flips the latest
-- version to unlocked but the record of the locked versions, and possibly an
-- immutable programme baseline behind them, still stands. A reopened project
-- reads Define in the phase model, and it stays undeletable here. Ever
-- locked, always a record.
--
-- Additive only: two nullable columns, one trigger function, one trigger.
-- No existing column is altered or dropped, and archive itself needs no new
-- policy: it is an UPDATE, which 024 already scopes to organisation admins.
-- ============================================================================

-- The archive record: who shelved the project, and when. Null on a working
-- project. status = 'archived' is the state; these two are its provenance,
-- in the register grammar (record beats inference).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- The delete guard. BEFORE DELETE on projects: if any brief row exists, the
-- brief has been locked at least once and the project is a governance record,
-- so the delete is refused with a named, catchable reason. The list maps the
-- name to honest copy; operator scripts that must truly destroy a record
-- (fixture teardowns) delete the project's brief rows first, deliberately,
-- and then pass this check.
--
-- No SECURITY DEFINER: the function runs as the deleting caller, and the 024
-- member-read policy already makes the caller's own organisation's brief rows
-- visible, which is exactly the set that matters. The service role bypasses
-- row level security and sees every row, so the guard binds it hardest of all.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_project_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM project_briefs b WHERE b.project_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'project_is_locked_record: this project''s brief has been locked, so it is a governance record. Archive it instead of deleting it.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_guard_delete ON projects;
CREATE TRIGGER projects_guard_delete
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION guard_project_delete();

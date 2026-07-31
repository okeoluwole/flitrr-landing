-- ========================================================================
-- 036_raid_suggestion_state.sql
--
-- Note 7, the persisted state of a RAID suggestion. One new table,
-- project_raid_suggestion_state, holding what the developer has already done
-- with each PULSE Suggests candidate at Step 8 of initiation.
--
-- WHY THIS EXISTS. Dismiss cleared a card from the band and wrote nothing, so
-- every dismissed suggestion came back on the next load and the developer had
-- no way to make one stay gone. Add was covered only by an inference: a
-- candidate whose text exactly matched an item already captured was not
-- offered again, which is correct until the developer edits that text, at
-- which point the candidate reappears as though it had never been taken. Both
-- are the same missing thing. There was no record of what the developer had
-- DONE with a candidate, only a guess drawn from what the register happens to
-- say right now. This table is that record.
--
-- IT MIRRORS project_playbook_state (013), which is the established pattern
-- for exactly this problem and is already named as the dedupe for suggestions
-- in 031's own comment. One row per project and candidate, written when the
-- developer acts, read on load to suppress what they have already answered.
--
-- ONE DELIBERATE BREAK IN THE MIRROR. candidate_id is TEXT and carries no
-- foreign key, where project_playbook_state.play_id is a UUID referencing
-- playbook_plays. A RAID candidate is library content in code
-- (lib/engine/raidLibrary.js), not a row: its identifier is the authored `key`
-- constant on the candidate. If a candidate is later retired from the library
-- its state rows simply stop matching anything, which is harmless and needs no
-- cleanup job.
--
-- THE TWO STATES, and there is no third. `added` means the candidate became an
-- item in the project's own RAID list; `dismissed` means the developer declined
-- it. Both are settled: Postgres cannot remove an enum value once it exists, so
-- the vocabulary here is deliberately the smallest one that answers the
-- question the band asks. The existing playbook_state enum (accepted,
-- dismissed) is NOT reused: its vocabulary belongs to the playbook, and
-- coupling the two would make either one's evolution the other's problem.
--
-- RESTORING a dismissed suggestion is not built here and is logged for the
-- design language session (Note 15). Deleting a captured item does not clear
-- its `added` row, so a suggestion added and later deleted stays suppressed.
-- Both are known behaviour rather than oversights.
--
-- RLS follows the org-scoped rule 024_organisations_rls.sql applies to every
-- project-scoped child table, written out here because this table did not
-- exist when that migration ran: any member of the owning organisation may
-- read, and only an admin of it may write. This is the identical posture
-- project_risks carries, which is the table Step 8 writes captured risks into,
-- so anyone who can Add a RAID item can record its suggestion state and there
-- is no member who can Add but cannot Dismiss.
--
-- Idempotent: the enum create is guarded, the table and indexes use
-- IF NOT EXISTS, and the policies are guarded, so re-running is safe.
--
-- APPLIED to the live flitrr-app database on 2026-07-31, at Olu's direction: a
-- new table and a new type, neither of which any code on main reads or writes,
-- so nothing on production can behave differently because of it.
-- ========================================================================

-- What the developer did with a candidate. See THE TWO STATES above.
DO $$ BEGIN
  CREATE TYPE raid_suggestion_state AS ENUM ('added', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- PROJECT_RAID_SUGGESTION_STATE
--   project_id    the project the developer acted on
--   candidate_id  the RAID library candidate's authored key. TEXT and not a
--                 foreign key: a candidate is content in code, not a row
--   state         added or dismissed (raid_suggestion_state)
--   acted_at      when they acted
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_raid_suggestion_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  state raid_suggestion_state NOT NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One answer per candidate per project, and the conflict target every write
  -- upserts on: a candidate dismissed and later added updates its state rather
  -- than colliding.
  UNIQUE (project_id, candidate_id)
);

COMMENT ON TABLE project_raid_suggestion_state IS
  'What the developer has already done with each PULSE Suggests RAID candidate at Step 8 (Note 7): added it into the project, or dismissed it. Read on load to suppress what has already been answered, so a dismissal stays gone and an added candidate stays gone even after its captured text is edited. Mirrors project_playbook_state, which is the same dedupe for the playbook plays.';
COMMENT ON COLUMN project_raid_suggestion_state.candidate_id IS
  'The RAID library candidate''s authored key (lib/engine/raidLibrary.js). Deliberately TEXT with no foreign key: a candidate is library content in code, not a row. A retired candidate simply leaves rows that match nothing, which is harmless.';

-- ========================================================================
-- INDEXES. The per-project read the band makes on load. The UNIQUE constraint
-- above already indexes (project_id, candidate_id) and so leads with
-- project_id; this index is stated explicitly because the read path is the
-- per-project one and the settled design names it, and it costs one small
-- index on a table that holds a handful of rows per project.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_raid_suggestion_state_project_id
  ON project_raid_suggestion_state(project_id);

-- ========================================================================
-- ROW LEVEL SECURITY. The four policies 024 generates for every project-scoped
-- child table, reproduced here: members of the owning organisation read,
-- admins of it insert, update and delete.
-- ========================================================================
ALTER TABLE project_raid_suggestion_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Organisation members can read project_raid_suggestion_state"
    ON project_raid_suggestion_state FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_raid_suggestion_state.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can insert project_raid_suggestion_state"
    ON project_raid_suggestion_state FOR INSERT
    WITH CHECK (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_raid_suggestion_state.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can update project_raid_suggestion_state"
    ON project_raid_suggestion_state FOR UPDATE
    USING (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_raid_suggestion_state.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    )
    WITH CHECK (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_raid_suggestion_state.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can delete project_raid_suggestion_state"
    ON project_raid_suggestion_state FOR DELETE
    USING (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_raid_suggestion_state.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

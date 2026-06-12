-- ========================================================================
-- 013_playbook_engine.sql
--
-- M7.4, the playbook engine schema. Two tables:
--
--   - playbook_plays: the global curated content. Stage-keyed expert
--     plays (action plays for the log, risk plays for the register),
--     identified by a stable unique slug so seeding is idempotent
--     (014 inserts ON CONFLICT (slug) DO UPDATE, which never changes a
--     play's id, so project state rows keep pointing at the same play
--     across content updates). The objective column reuses the
--     objective_type enum: one vocabulary, and the deterministic key
--     that maps a play onto a project's own classified objective row
--     (project_objectives is UNIQUE (project_id, objective_type)).
--     Criticality is NOT stored per play beyond always_critical; it is
--     derived per project in app code (playbookModel.js): always
--     critical, or critical because the project classified that
--     objective non-negotiable. Cascading classification applied to
--     curated content.
--
--   - project_playbook_state: one row per project-play pair the
--     developer has acted on (accepted or dismissed). Live proposals
--     are DERIVED: plays for the project's current stage minus the
--     pairs here. Dismissed stays dismissed; no re-nagging.
--
-- RLS. playbook_plays is readable by all authenticated users and
-- writable by no one through the app (no write policies; content
-- enters by seeding in the SQL editor, which runs as postgres and
-- bypasses RLS). This mirrors the products table in 002.
-- project_playbook_state carries the standard owned-project policies
-- from 005, written per action.
--
-- Idempotent: guarded enum creates, IF NOT EXISTS on tables and
-- indexes, guarded policies. Run this BEFORE 014_playbook_seed.sql.
--
-- Apply this in the Supabase SQL editor before testing.
-- ========================================================================

-- A play proposes an action (for the log) or a risk (for the register).
DO $$ BEGIN
  CREATE TYPE play_type AS ENUM ('action', 'risk');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- The developer's response to a play: taken into the project, or
-- declined for this project. No third state; unacted pairs simply have
-- no row.
DO $$ BEGIN
  CREATE TYPE playbook_state AS ENUM ('accepted', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS playbook_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  type play_type NOT NULL,
  -- Lifecycle stage the play belongs to (framework stages 0 to 7).
  stage INTEGER NOT NULL CHECK (stage BETWEEN 0 AND 7),
  jurisdiction TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  -- The why line is the knowledge transfer. Surfaces in full, never
  -- truncated.
  why TEXT NOT NULL,
  -- The objective the play serves or threatens; the deterministic map
  -- onto the project's own classified objective.
  objective objective_type NOT NULL,
  -- True for the plays that are critical on every project, whatever the
  -- classification (for example PI insurance, statutory duty holders).
  always_critical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS playbook_plays_updated_at ON playbook_plays;
CREATE TRIGGER playbook_plays_updated_at
  BEFORE UPDATE ON playbook_plays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS project_playbook_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  play_id UUID NOT NULL REFERENCES playbook_plays(id) ON DELETE CASCADE,
  state playbook_state NOT NULL,
  acted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- One response per play per project. Also serves as the project_id
  -- lookup index.
  UNIQUE (project_id, play_id)
);

-- ========================================================================
-- ROW LEVEL SECURITY
-- ========================================================================

-- Curated content: any authenticated user can read, nothing can write
-- through the app (content enters by seeding only).
ALTER TABLE playbook_plays ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view playbook plays"
    ON playbook_plays FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Per-project state: reachable only through an owned project, per
-- action, mirroring 005_pulse_projects_rls.sql.
ALTER TABLE project_playbook_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own project playbook state"
    ON project_playbook_state FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_playbook_state.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own project playbook state"
    ON project_playbook_state FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_playbook_state.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own project playbook state"
    ON project_playbook_state FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_playbook_state.project_id
          AND projects.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_playbook_state.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own project playbook state"
    ON project_playbook_state FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_playbook_state.project_id
          AND projects.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- INDEXES, following 006: the proposal read path (stage plus type) and
-- the state side of the derive-proposals join. The unique pairs above
-- already index slug and (project_id, play_id).
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_playbook_plays_stage_type ON playbook_plays(stage, type);
CREATE INDEX IF NOT EXISTS idx_project_playbook_state_play_id ON project_playbook_state(play_id);

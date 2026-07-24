-- ========================================================================
-- 030_risk_events.sql
--
-- Note 19, the event-sourced status narrative on the Risk register. One new
-- table, project_risk_events, holding the recorded changes a developer makes
-- to a risk.
--
-- WHY THIS EXISTS. The register was telling the developer "Severity has
-- escalated." on five of six risks that had never been reviewed and had never
-- changed. The sentence was rendered from a LEVEL trigger (the score sits at
-- or above the escalation threshold for its criticality) but it was worded as
-- a CHANGE. A change sentence needs a recorded change to stand on, and there
-- was none, because nothing recorded one. This table is that record.
--
-- The rule the register now holds: an escalation line renders only when a row
-- here shows a band actually being raised, and it cites from, to, when and
-- who. Absent such a row the line does not render at all. That is the
-- deterministic principle applied to words: the platform says only what its
-- data can stand behind.
--
-- This is the table lib/engine/monitor.js designed and deliberately deferred
-- under D2, built here to the shape documented there so the schema is not
-- reworked:
--   event_type  'scored' | 'status_changed' | 'reviewed' | 'note_set'
--   from_value / to_value   the prior and new value, as text
--   occurred_at, actor_id   when, and who
-- Only 'scored' is written today (it carries the severity band transition the
-- escalation line reads). The other three values exist so the later trend and
-- dwell language has its home already, and so a reviewed or status event can
-- be appended without another migration.
--
-- WHAT from_value AND to_value HOLD for a 'scored' event: the derived severity
-- BAND key, one of 'serious', 'moderate', 'minor', 'unscored'. The band is what
-- the developer sees and what the escalation sentence is about, so the band is
-- what is recorded. The current likelihood and impact stay on project_risks;
-- this table records the transition, never the current state.
--
-- APPEND ONLY. One row per change event. Nothing is edited and nothing is
-- deleted, so the history of what changed and when survives, which is the only
-- thing that makes it usable as evidence. There is deliberately no UPDATE and
-- no DELETE policy, holding the append-only rule structurally rather than only
-- in app code, exactly as 029_reconcile_decisions.sql does.
--
-- RLS follows the org-scoped rule 024_organisations_rls.sql applies to every
-- project-scoped child table: any member of the owning organisation may read,
-- and only an admin of it may write, resolved by joining through projects with
-- the same helpers.
--
-- Idempotent: the enum create is guarded, the table and indexes use
-- IF NOT EXISTS, and the policies are guarded, so re-running is safe.
--
-- APPLIED to the live flitrr-app database on 2026-07-24, at Olu's direction:
-- additive and append-only, so it meets the bar for a live apply ahead of the
-- merge. Verified after the apply: the table carries its 8 columns, row level
-- security is on, and it holds SELECT and INSERT policies only, with no UPDATE
-- and no DELETE, so the append-only rule is structural. The table is empty.
-- ========================================================================

-- The kind of change recorded. See the D2 design note in lib/engine/monitor.js.
DO $$ BEGIN
  CREATE TYPE risk_event_type AS ENUM (
    'scored', 'status_changed', 'reviewed', 'note_set'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- PROJECT_RISK_EVENTS
--   project_id   the project the risk belongs to, so the org join and the
--                per-project read need no second hop through project_risks
--   risk_id      the risk that changed
--   event_type   the kind of change (risk_event_type)
--   from_value   the prior value: for 'scored', the severity band key before
--                the change; null when there was no prior value
--   to_value     the new value: for 'scored', the severity band key after
--   occurred_at  when the change happened
--   actor_id     who made it
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_id UUID NOT NULL REFERENCES project_risks(id) ON DELETE CASCADE,
  event_type risk_event_type NOT NULL,
  from_value TEXT,
  to_value TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- A change event that records no new value records nothing. Enforced in app
  -- code too; this is the structural backstop.
  CONSTRAINT risk_events_to_value CHECK (
    to_value IS NOT NULL AND btrim(to_value) <> ''
  )
);

COMMENT ON TABLE project_risk_events IS
  'Append-only record of the changes made to a risk (Note 19). The register renders an escalation line only from a row here that raised the severity band, citing from, to, when and who; absent such a row it renders no escalation line at all.';
COMMENT ON COLUMN project_risk_events.from_value IS
  'The prior value. For a scored event, the severity band key before the change (serious, moderate, minor, unscored). Null when there was no prior value.';
COMMENT ON COLUMN project_risk_events.to_value IS
  'The new value. For a scored event, the severity band key after the change. An escalation is a scored event whose band is more urgent than from_value.';

-- ========================================================================
-- INDEXES. The per-project read the register makes on load, and the
-- latest-per-risk read the escalation line needs.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_risk_events_project_id
  ON project_risk_events(project_id);

CREATE INDEX IF NOT EXISTS idx_risk_events_risk
  ON project_risk_events(risk_id, occurred_at DESC);

-- ========================================================================
-- ROW LEVEL SECURITY. The org-scoped rule 024 applies to every project-scoped
-- child table, written out here because this table did not exist when that
-- migration ran: members of the owning organisation read, admins of it insert.
-- No UPDATE and no DELETE policy, which holds the append-only rule
-- structurally.
-- ========================================================================
ALTER TABLE project_risk_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Organisation members can read project_risk_events"
    ON project_risk_events FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_risk_events.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can insert project_risk_events"
    ON project_risk_events FOR INSERT
    WITH CHECK (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_risk_events.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

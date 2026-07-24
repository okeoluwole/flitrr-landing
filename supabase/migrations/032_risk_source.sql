-- ========================================================================
-- 032_risk_source.sql
--
-- Note 19, provenance on the Risk register. Two new nullable columns on
-- project_risks, source and source_id, mirroring the pair project_actions has
-- carried since 011_action_sources.sql.
--
-- WHY THIS EXISTS. Note 19 asks the register's first-review queue to state
-- where its risks came from: "6 risks from your brief await first review". The
-- register could not say that, because nothing on the row recorded it. Every
-- risk looked alike whether the developer had written it into the Brief at
-- initiation or accepted it from a curated PULSE Suggests play weeks later.
-- Provenance that is asserted rather than read is exactly the kind of claim
-- this pass exists to remove, so the row now carries it.
--
-- THE VALUES:
--   source NULL         captured at initiation, so it sits in the locked
--                       Brief. This is the meaning of the existing rows, and
--                       leaving them null rather than backfilling a literal
--                       keeps the migration additive: no existing row is
--                       rewritten, and null already says the true thing.
--   source = 'playbook' added from a curated play; source_id is the
--                       playbook_plays row it came from.
--
-- ADDITIVE ONLY. Two nullable columns and one index. No existing column is
-- altered, no data is rewritten, and every existing read keeps working
-- untouched, because a surface that does not select these columns behaves
-- exactly as before.
--
-- RLS needs no change: policies are per table, and project_risks already
-- carries the org-scoped rule from 024_organisations_rls.sql.
--
-- Idempotent: both columns and the index use IF NOT EXISTS, so re-running is
-- safe.
--
-- APPLIED to the live flitrr-app database on 2026-07-24, at Olu's direction:
-- additive, so it meets the bar for a live apply ahead of the merge. Verified
-- after the apply: both columns are present and nullable, every existing risk
-- reads null (captured at initiation), and the apply raised no new security
-- advisory.
-- ========================================================================

ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IS NULL OR source IN ('playbook'));

ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS source_id UUID;

COMMENT ON COLUMN project_risks.source IS
  'Where the risk came from (Note 19). NULL means captured at initiation, so it sits in the locked Brief. playbook means it was added from a curated PULSE Suggests play, with source_id naming the play.';
COMMENT ON COLUMN project_risks.source_id IS
  'The playbook_plays row an accepted play came from. Deliberately not a foreign key, matching project_actions.source_id: the column is polymorphic by source and the provenance must outlive the row it points at.';

-- The provenance read the register's queue heading makes: how many of a
-- project's risks came from the Brief.
CREATE INDEX IF NOT EXISTS idx_project_risks_source
  ON project_risks(project_id, source);

-- ========================================================================
-- 011_action_sources.sql
--
-- M7.2, the source model for the Action Log. Two columns on
-- project_actions that record where a tracked action came from:
--
--   - source     an enum: manual, risk, programme, playbook. Every
--                existing row takes manual via the default, which is
--                correct: M7.1 actions were all logged by hand.
--   - source_id  the id of the originating record (a project_risks id
--                for source = risk, a playbook play id for source =
--                playbook). Polymorphic BY DESIGN, so it carries no
--                foreign key constraint: the column means different
--                tables for different sources, and a dangling id is
--                acceptable (a deleted source risk leaves the tracked
--                action in place, per the M7.2 spec).
--
-- The programme value is a stub: it exists in the enum and nowhere
-- else, reserving the vocabulary for the Programme module without
-- building any of it.
--
-- Risk-derived feed items are NOT rows here. They are computed at read
-- time from project_risks (see actionFeed.js) and only become
-- project_actions rows when promoted, with source = risk and source_id
-- set, which is also how the feed deduplicates (a risk with an open
-- tracked action generates no pushed item).
--
-- Idempotent: the enum create is guarded and the column adds use
-- IF NOT EXISTS, so re-running is safe. RLS is untouched: the
-- project_actions owner policies in 010_action_log.sql already scope
-- every row, whatever its source.
--
-- Apply this in the Supabase SQL editor before testing.
-- ========================================================================

-- Where a tracked action came from.
DO $$ BEGIN
  CREATE TYPE action_source AS ENUM ('manual', 'risk', 'programme', 'playbook');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE project_actions
  ADD COLUMN IF NOT EXISTS source    action_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- Supports the dedupe lookup (find the open tracked action for a given
-- source record). No FK, so this index is the lookup path.
CREATE INDEX IF NOT EXISTS idx_project_actions_source_id ON project_actions(source_id);

-- ========================================================================
-- 031_triage_decisions.sql
--
-- Notes 18 and 19, the triage grammar. One new table,
-- project_triage_decisions, holding the recorded decision a developer takes
-- on every queued item: the Critical Brief items awaiting triage on the
-- Action Log, and the PULSE Suggests plays on both the log and the Risk
-- register.
--
-- WHY THIS EXISTS. The queue had two responses (Track this, Review in
-- register) and no way to say no. An item a developer had considered and
-- declined looked identical to one they had never seen, so the queue could
-- only ever grow, and nothing recorded that a judgement had been made. There
-- is now an explicit decline path, and every queued item ends in a recorded
-- decision carrying who decided, when, and, for a decline, why.
--
-- IT REUSES THE PATTERN 029_reconcile_decisions.sql SET. A triage decision is
-- a governance decision on a Brief item, so it is recorded the same way a
-- reconcile decision is: an append-only row naming what was decided, on what,
-- by whom, and when, with the reason required where the decision needs one.
-- Nothing about the decision lives only in the interface.
--
-- THE FOUR DECISIONS (the triage_decision enum):
--   tracked    a queued Brief item was promoted into a tracked action
--   dismissed  a queued item or a suggestion was declined, with a required
--              one-line reason; the item leaves the queue and stays gone
--   added      a suggestion was accepted, into the Action Log as an action or
--              into the Risk register as a risk
--   reviewed   a queued risk was opened in the register for review
--
-- THE ITEM KINDS. 'risk', 'assumption', 'constraint' and 'dependency' are the
-- Brief items the Action Log queues; 'play' is a curated PULSE Suggests play
-- from playbook_plays. item_id is deliberately NOT a foreign key: the five
-- kinds live in five different tables, and a decision is a record of a
-- judgement that must survive the item it was taken on. item_name carries the
-- item's wording at the time, so the record reads without any join at all.
--
-- WHAT project_playbook_state STILL DOES. It remains the dedupe: one row per
-- project and play, which is what keeps an accepted or dismissed suggestion
-- from returning. It records acted_at but has no actor, and it is not append
-- only. This table is the audit trail beside it: who decided, when, and why.
-- The two are written together and neither replaces the other.
--
-- APPEND ONLY. One row per decision event, never edited, never deleted. The
-- current decision on an item is its latest row by decided_at. There is
-- deliberately no UPDATE and no DELETE policy, holding the rule structurally
-- rather than only in app code.
--
-- RLS follows the org-scoped rule 024_organisations_rls.sql applies to every
-- project-scoped child table: any member of the owning organisation may read,
-- and only an admin of it may write.
--
-- Idempotent: the enum create is guarded, the table and indexes use
-- IF NOT EXISTS, and the policies are guarded, so re-running is safe.
--
-- APPLIED to the live flitrr-app database on 2026-07-24, at Olu's direction:
-- additive and append-only, so it meets the bar for a live apply ahead of the
-- merge. Verified after the apply: the table carries its 12 columns, row level
-- security is on, and it holds SELECT and INSERT policies only, with no UPDATE
-- and no DELETE, so the append-only rule is structural. The table is empty.
-- ========================================================================

-- The recorded outcome of a triage decision. See THE FOUR DECISIONS above.
DO $$ BEGIN
  CREATE TYPE triage_decision AS ENUM (
    'tracked', 'dismissed', 'added', 'reviewed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- PROJECT_TRIAGE_DECISIONS
--   project_id         the project the decision belongs to
--   item_kind          risk, assumption, constraint, dependency, or play
--   item_id            the queued item's id in its own table; not a foreign
--                      key, because the kinds span five tables and the record
--                      outlives the item
--   item_name          the item's wording when the decision was taken, so the
--                      record reads without a join
--   surface            where the decision was taken: action_log or
--                      risk_register
--   decision           the recorded outcome (triage_decision)
--   reason             the one-line decline reason (required on a dismiss)
--   created_action_id  the action a tracked or added decision created
--   created_risk_id    the risk an added risk play created
--   decided_by         who decided
--   decided_at         when they decided
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_triage_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (
    item_kind IN ('risk', 'assumption', 'constraint', 'dependency', 'play')
  ),
  item_id UUID NOT NULL,
  item_name TEXT,
  surface TEXT NOT NULL CHECK (surface IN ('action_log', 'risk_register')),
  decision triage_decision NOT NULL,
  reason TEXT,
  created_action_id UUID REFERENCES project_actions(id) ON DELETE SET NULL,
  created_risk_id UUID REFERENCES project_risks(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A decline always carries its reason. That is the whole point of the
  -- decline path: saying no is a judgement, and a judgement with no reason
  -- recorded is indistinguishable from neglect. Enforced in app code too;
  -- this is the structural backstop.
  CONSTRAINT triage_decisions_dismiss_reason CHECK (
    decision <> 'dismissed' OR (reason IS NOT NULL AND btrim(reason) <> '')
  )
);

COMMENT ON TABLE project_triage_decisions IS
  'Append-only record of every decision taken on a queued item (Notes 18 and 19): the Critical Brief items awaiting triage on the Action Log, and the PULSE Suggests plays on the log and the Risk register. Carries who decided, when, and, for a decline, why. project_playbook_state stays the dedupe for suggestions; this is the trail beside it.';
COMMENT ON COLUMN project_triage_decisions.item_id IS
  'The queued item id in its own table (project_risks, project_assumptions, project_constraints, project_dependencies, or playbook_plays). Deliberately not a foreign key: the kinds span five tables and the record of a judgement outlives the item it was taken on.';
COMMENT ON COLUMN project_triage_decisions.reason IS
  'The one-line decline reason. Required on a dismiss, by the triage_decisions_dismiss_reason check.';

-- ========================================================================
-- INDEXES. The per-project read the log and the register make on load, and
-- the latest-per-item read (the current decision on an item is its newest
-- row), which is also what the queue filters the declined items out with.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_triage_decisions_project_id
  ON project_triage_decisions(project_id);

CREATE INDEX IF NOT EXISTS idx_triage_decisions_item
  ON project_triage_decisions(project_id, item_kind, item_id, decided_at DESC);

-- ========================================================================
-- ROW LEVEL SECURITY. The org-scoped rule 024 applies to every project-scoped
-- child table, written out here because this table did not exist when that
-- migration ran: members of the owning organisation read, admins of it insert.
-- No UPDATE and no DELETE policy, which holds the append-only rule
-- structurally.
-- ========================================================================
ALTER TABLE project_triage_decisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Organisation members can read project_triage_decisions"
    ON project_triage_decisions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_triage_decisions.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can insert project_triage_decisions"
    ON project_triage_decisions FOR INSERT
    WITH CHECK (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_triage_decisions.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- 029_reconcile_decisions.sql
--
-- Note 14, the one decision grammar at Reconcile dates. One new table,
-- project_reconcile_decisions, holding the recorded decision a developer
-- takes on every flagged Brief date during Programme set-up.
--
-- WHY THIS EXISTS. Before this, only two of the possible outcomes left a
-- trace: an accepted recommendation and a kept date rode along in the
-- in-memory resolution set, and the VERIFY LOCALLY card was attest-only, a
-- checkbox that vanished at the end of the flow. A baseline-setting decision
-- that leaves no record is a silent omission. Every flagged date now ends in
-- a row here, carrying who decided, when, what they decided, and the
-- operational date the decision set.
--
-- THIS IS THE BRIEF'S APPROVALS TRAIL. A reconcile decision is a
-- baseline-setting decision, so it is stamped against the locked Brief
-- version it was taken on (source_brief_id) with its decider and timestamp,
-- exactly as the Brief lock and the stage gates are. It sits alongside them
-- as governance history, not beside them as loose UI state. The locked Brief
-- itself is NEVER mutated by a decision: an amended date sets the
-- OPERATIONAL date on the baseline and is recorded here as a variance from
-- the Brief's target, which is what lets the lock-time reconciliation check
-- (lib/engine/programmeReconciliation.js) read it as explained rather than as
-- a blocking mismatch.
--
-- THE FIVE DECISIONS (the reconcile_decision enum):
--   accepted  the engine's recommended date is agreed
--   kept      the developer's own date is held, with a required reason; the
--             tracked optimism
--   amended   neither offered date is right, so the developer sets the
--             operational date here; a recorded variance from the Brief
--   verified  the attestation: checked locally, with the note if one was
--             given
--   deferred  verify later; the flow proceeds and an open verification
--             action is raised on the Action Log, carried on action_id
--
-- APPEND ONLY. One row per decision event. Re-deciding a point (stepping
-- back to reconcile and changing an answer) appends a new row; the current
-- decision for a point is the latest by decided_at. Nothing is edited and
-- nothing is deleted, so the history of what was decided and when survives.
--
-- RLS follows the org-scoped rule 024_organisations_rls.sql applies to every
-- project-scoped child table: any member of the owning organisation may read,
-- and only an admin of it may write. The organisation is resolved by joining
-- through projects, using the same helpers. SELECT and INSERT only; there is
-- deliberately no UPDATE and no DELETE policy, which is the append-only rule
-- held structurally rather than only in app code.
--
-- Numbered 029, not 028: 028_stack_schemes.sql is taken on the STACK branch
-- and is already applied to the live database.
--
-- Idempotent: the enum create is guarded, the table and indexes use
-- IF NOT EXISTS, and the policies are guarded, so re-running is safe.
--
-- APPLIED to the live flitrr-app database on 2026-07-24, at Olu's direction,
-- ahead of the end-to-end walkthrough. Verified after the apply: the enum
-- carries its five values, the table carries its 16 columns, 4 foreign keys
-- and 5 CHECK constraints, row level security is on with SELECT and INSERT
-- policies only, and the two guard CHECKs were confirmed against real rows
-- (a kept date with no reason and an amend with no date were both rejected;
-- a valid attestation was accepted, then removed). The table is empty, and
-- the apply raised no new security advisory.
-- ========================================================================

-- The recorded outcome of a decision on one flagged date. See THE FIVE
-- DECISIONS above.
DO $$ BEGIN
  CREATE TYPE reconcile_decision AS ENUM (
    'accepted', 'kept', 'amended', 'verified', 'deferred'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- PROJECT_RECONCILE_DECISIONS
--   project_id        the project the decision belongs to
--   source_brief_id   the locked Brief version the decision was taken
--                     against, the provenance that puts this row in the
--                     Brief's approvals history (project_briefs.id)
--   point_key         the flagged point's stable key: `gate_<stage>` for a
--                     gate, the template's milestone key for a milestone
--   point_kind        'gate' or 'milestone'
--   point_name        the point's name at the time of the decision, so the
--                     record reads without a template join
--   stage             the lifecycle stage (0 to 7) the point sits in
--   tier              the reality-check tier that flagged it: propose,
--                     force, or flag_verify
--   decision          the recorded outcome (reconcile_decision)
--   brief_date        the developer's own date, from the Brief
--   recommended_date  the engine's recommendation, where the tier carries
--                     one (null for flag_verify, which never invents a
--                     jurisdictional number)
--   agreed_date       the operational date this decision sets
--   note              the keep reason (required), the amend reason, or the
--                     verify note (optional)
--   action_id         the open verification action raised for a deferred
--                     decision (project_actions.id); null otherwise
--   decided_by        who decided
--   decided_at        when they decided
-- ========================================================================
CREATE TABLE IF NOT EXISTS project_reconcile_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- ON DELETE NO ACTION, not SET NULL: the Brief version a decision was taken
  -- against is frozen provenance and is never erased. A project delete
  -- cascades the brief and these rows together through project_id, and NO
  -- ACTION defers its check to statement end, so that delete still succeeds.
  source_brief_id UUID REFERENCES project_briefs(id) ON DELETE NO ACTION,
  point_key TEXT NOT NULL,
  point_kind TEXT NOT NULL CHECK (point_kind IN ('gate', 'milestone')),
  point_name TEXT,
  stage INTEGER CHECK (stage BETWEEN 0 AND 7),
  tier TEXT NOT NULL CHECK (tier IN ('propose', 'force', 'flag_verify')),
  decision reconcile_decision NOT NULL,
  brief_date DATE,
  recommended_date DATE,
  agreed_date DATE,
  note TEXT,
  action_id UUID REFERENCES project_actions(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A kept date is tracked optimism, so it always carries its reason. An
  -- amended date always sets an operational date. Both rules are enforced in
  -- app code too; this is the structural backstop.
  CONSTRAINT reconcile_decisions_kept_reason CHECK (
    decision <> 'kept' OR (note IS NOT NULL AND btrim(note) <> '')
  ),
  CONSTRAINT reconcile_decisions_amend_date CHECK (
    decision <> 'amended' OR agreed_date IS NOT NULL
  )
);

COMMENT ON TABLE project_reconcile_decisions IS
  'Append-only record of every decision taken on a flagged date at Programme set-up (Note 14). A baseline-setting decision, stamped against the locked Brief version with its decider and timestamp, so it sits in the Brief approvals history alongside the lock and the gates. The locked Brief is never mutated.';
COMMENT ON COLUMN project_reconcile_decisions.source_brief_id IS
  'The locked Brief version the decision was taken against (project_briefs.id): the provenance that places this row in the Brief approvals history.';
COMMENT ON COLUMN project_reconcile_decisions.point_key IS
  'The flagged point stable key: gate_<stage> for a gate, the template milestone key for a milestone. Unique across a reality check.';
COMMENT ON COLUMN project_reconcile_decisions.agreed_date IS
  'The operational date this decision sets. For an amend it differs from brief_date, and the lock-time reconciliation reads that gap as an explained variance rather than a blocking mismatch.';
COMMENT ON COLUMN project_reconcile_decisions.action_id IS
  'The open verification action raised on the Action Log for a deferred (verify later) decision. Null for every other decision.';

-- ========================================================================
-- INDEXES. The parent lookup, and the latest-per-point read (the current
-- decision for a point is its newest row).
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_reconcile_decisions_project_id
  ON project_reconcile_decisions(project_id);

CREATE INDEX IF NOT EXISTS idx_reconcile_decisions_point
  ON project_reconcile_decisions(project_id, point_key, decided_at DESC);

-- ========================================================================
-- ROW LEVEL SECURITY. The same org-scoped rule 024 applies to every other
-- project-scoped child table, written out here because this table did not
-- exist when that migration ran: members of the owning organisation read,
-- admins of it insert. No UPDATE and no DELETE policy, which holds the
-- append-only rule structurally.
-- ========================================================================
ALTER TABLE project_reconcile_decisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Organisation members can read project_reconcile_decisions"
    ON project_reconcile_decisions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_reconcile_decisions.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Organisation admins can insert project_reconcile_decisions"
    ON project_reconcile_decisions FOR INSERT
    WITH CHECK (
      is_organisation_admin()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_reconcile_decisions.project_id
          AND p.organisation_id = current_user_organisation_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

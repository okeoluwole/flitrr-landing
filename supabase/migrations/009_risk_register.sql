-- ========================================================================
-- 009_risk_register.sql
--
-- M6.1, the Risk register substrate. Turns the baselined initial risk
-- profile (wizard Step 7) into a living register the developer manages from
-- Stage 2 onward: each risk can be scored, given a status and a one-line
-- response, reviewed, and closed.
--
-- ONE SOURCE OF TRUTH PER CONCEPT. project_risks is the table the later
-- monitoring modules (Programme, Dashboard) will also read, so this reuses
-- what is already there rather than adding parallel columns:
--   - likelihood / impact: the existing risk_level scale (low/medium/high) is
--     already three levels. The register relabels it in the UI (Unlikely/
--     Possible/Likely and Limited/Significant/Severe) and derives severity
--     from the stored value. No new likelihood/impact columns.
--   - status: the existing column is a native enum (risk_status: open/
--     mitigated/closed) that neither the wizard nor the Brief reads or writes.
--     It is repurposed in place to the register's lifecycle, so there is one
--     status column, not two.
-- Two genuinely new columns are added: last_reviewed_at and response_note.
--
-- BASELINE VS LIVE. The frozen Brief snapshot remains the baseline; the live
-- project_risks columns evolve as the developer re-assesses. There is no third
-- copy of likelihood/impact to keep in sync.
--
-- Severity is NOT stored. It is derived in app code from the stored
-- likelihood and impact levels (see riskModel.js), so there is one source.
--
-- Idempotent: the enum create is guarded, the status conversion runs only
-- while the column is still the old type, and the column adds use IF NOT
-- EXISTS, so re-running is safe. RLS is untouched: the project_risks owner
-- policies in 005_pulse_projects_rls.sql already scope these for select and
-- update.
--
-- Apply this in the Supabase SQL editor before testing.
-- ========================================================================

-- The register lifecycle. A risk is watched, acted on, accepted, or closed.
-- Closing keeps the row (closed risks are not deleted), it just leaves the
-- default list.
DO $$ BEGIN
  CREATE TYPE risk_register_status AS ENUM ('watching', 'acting', 'accepted', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Repurpose the existing status column in place, but only while it is still
-- the old risk_status type, so a re-run is a no-op. The old values map onto
-- the register's: open is the starting "watching" state, mitigated is "acting",
-- closed stays closed. In practice every row is 'open' (the wizard never set
-- status), so this is a clean reset to 'watching'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_risks'
      AND column_name = 'status'
      AND udt_name = 'risk_status'
  ) THEN
    ALTER TABLE project_risks ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE project_risks
      ALTER COLUMN status TYPE risk_register_status
      USING (
        CASE status::text
          WHEN 'open' THEN 'watching'
          WHEN 'mitigated' THEN 'acting'
          WHEN 'closed' THEN 'closed'
          ELSE 'watching'
        END
      )::risk_register_status;
    ALTER TABLE project_risks ALTER COLUMN status SET DEFAULT 'watching';
  END IF;
END $$;

-- The old enum is now unused (only project_risks.status referenced it), so
-- drop it and keep one status type in the schema. IF EXISTS makes a re-run
-- safe after the type is already gone.
DROP TYPE IF EXISTS risk_status;

-- The two genuinely new columns. last_reviewed_at is null until the developer
-- engages with a risk (M6.2's not-yet-engaged signal and review-recency
-- trigger read it). response_note is the optional one-line response.
ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_note    TEXT;

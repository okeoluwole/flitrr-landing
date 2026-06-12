-- ========================================================================
-- 012_weekly_digest.sql
--
-- M7.3, the weekly digest schema. Two small pieces:
--
--   - profiles.digest_enabled: the user's one notification preference,
--     default true. The M7.3 spec calls for a user_preferences table only
--     if no profile table exists; profiles (001) is exactly that table,
--     one row per auth user, so the flag lives there rather than on a
--     parallel table (one source of truth per concept, as in 009/010).
--
--   - digest_sends: one row per user per scheduled run, recording what
--     was sent. The UNIQUE (user_id, run_key) pair is the double-send
--     guard: run_key is the Monday date of the UTC week the run belongs
--     to, so a re-triggered route within the same week cannot email the
--     same user twice. summary is the audit payload (project names and
--     action counts), point-in-time jsonb like project_briefs.content.
--
-- RLS. digest_sends is written only by the digest job, which runs with
-- the secret (service role) key and bypasses RLS; through the app a user
-- can read their own send history and write nothing, mirroring the
-- restricted-by-design posture of 002 (design_partner_submissions has no
-- select; this has no insert). profiles policies (002) already let a
-- user read and update their own row, which covers digest_enabled.
--
-- Idempotent: the column add and table create are guarded with IF NOT
-- EXISTS and the policy is guarded, so re-running is safe.
--
-- Apply this in the Supabase SQL editor before testing. To re-test a
-- digest run within the same week, delete that week's rows from
-- digest_sends first.
-- ========================================================================

-- The one notification preference: the weekly digest, on by default,
-- honoured by the digest job and flipped off by the unsubscribe route.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT true;

-- One row per user per scheduled run. run_key is the Monday of the UTC
-- week (computed by the digest job), so weekly cadence is enforced by the
-- unique pair, not by timing luck.
CREATE TABLE IF NOT EXISTS digest_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_key DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  summary JSONB,
  -- The double-send guard: one send per user per scheduled run. Also
  -- serves as the user_id lookup index.
  UNIQUE (user_id, run_key)
);

-- ========================================================================
-- ROW LEVEL SECURITY. Users can see their own send history; nothing can
-- be written through the app (no insert/update/delete policies). The
-- digest job writes with the secret key, which bypasses RLS.
-- ========================================================================
ALTER TABLE digest_sends ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own digest sends"
    ON digest_sends FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

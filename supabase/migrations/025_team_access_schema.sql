-- ========================================================================
-- 025_team_access_schema.sql
--
-- The team and access engine, schema only. Step 1 of two:
--   025 schema (this file), 026 functions, triggers, guards and policies.
-- The two apply as one ordered set, in order, in the Supabase SQL editor.
--
-- This builds on the Step 2 organisation model (022 schema, 023 backfill,
-- 024 row level security). It lets a customer's own organisation admin run
-- their team from inside the product: invite members by email, remove
-- (deactivate) and restore (reactivate) them, and promote or demote admins,
-- all under a seat cap and a last-admin guard.
--
-- WHAT THIS FILE ADDS, additive only:
--   1. organisation_members.deactivated_at: a nullable timestamp. NULL means
--      active (every existing row, by the column default). A non-null value
--      means the membership is deactivated: the seat is freed and 026 makes
--      the row level security helpers treat the person as having no access.
--   2. pending_invitations: one row per outstanding email invite. The invite
--      is written here before the invite email is sent, so the sign-up trigger
--      (026) can see it and place the new user in the inviting organisation
--      instead of a solo one.
--   3. invitation_status: the native enum for the invite lifecycle, matching
--      the house style (organisation_role in 022, the enums from 004 onward).
--
-- Nothing is dropped or renamed, so every existing flow keeps working. The
-- deactivated_at column is nullable with no default change, so existing
-- memberships stay active. Idempotent: the enum create is guarded, the column
-- and table use IF NOT EXISTS, the indexes use IF NOT EXISTS, so re-running is
-- safe.
--
-- Apply in the Supabase SQL editor, after 024 and before 026. Do not apply to
-- the hosted flitrr-app project until this has been reviewed.
-- ========================================================================

-- ========================================================================
-- 1. ORGANISATION_MEMBERS.deactivated_at  the active/deactivated status
--    Remove means deactivate, not delete. A deactivated person keeps their
--    account and everything they authored stays and stays visible to the rest
--    of the organisation; their seat frees and 026 denies them all app data.
--    NULL is active (the existing rows, and the column default); a timestamp
--    records when the membership was deactivated.
-- ========================================================================
ALTER TABLE organisation_members
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

COMMENT ON COLUMN organisation_members.deactivated_at IS
  'When the membership was deactivated. NULL means active. A deactivated member keeps their account and authored work, frees their seat, and is denied all app data by the row level security helpers (026).';

-- A partial index for the active-membership lookups the helpers and the team
-- screen make. The unique (user_id) and (organisation_id, user_id) constraints
-- from 022 still serve the keyed lookups; this narrows the common active scan.
CREATE INDEX IF NOT EXISTS idx_organisation_members_active
  ON organisation_members (organisation_id)
  WHERE deactivated_at IS NULL;

-- ========================================================================
-- 2. INVITATION_STATUS  the invite lifecycle
--    pending:   sent, awaiting acceptance. Holds a seat. Cancellable.
--    consumed:  accepted. The membership now exists; the invite is spent.
--    cancelled: withdrawn by an admin before acceptance. Frees the seat.
-- ========================================================================
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'consumed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================================================================
-- 3. PENDING_INVITATIONS  one row per email invite
--    The invite is written here first, then the invite email is sent, so the
--    sign-up trigger (026) can see a pending invite for the new auth user's
--    email and join them to the inviting organisation instead of creating a
--    solo one. role is constrained to member for now; an admin promotes a
--    member to admin after they have joined.
--
--    email is stored lower-case (a CHECK enforces it) so the unique pending
--    rule and the trigger's lookup are case-insensitive without per-query
--    lowering. invited_by is the admin who sent it; invited_user_id is the
--    invitee's auth user (set after the invite call returns), kept so a cancel
--    can revoke the unaccepted auth invite. Both reference auth.users with
--    ON DELETE SET NULL so removing either user leaves the audit row intact.
-- ========================================================================
CREATE TABLE IF NOT EXISTS pending_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL CHECK (email = lower(email)),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role            organisation_role NOT NULL DEFAULT 'member' CHECK (role = 'member'),
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          invitation_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pending_invitations IS
  'One row per email invite to join an organisation. Written before the invite email is sent so the sign-up trigger (026) can place the new user in the inviting organisation. status: pending (holds a seat, cancellable), consumed (accepted, membership exists), cancelled (withdrawn).';
COMMENT ON COLUMN pending_invitations.invited_user_id IS
  'The invitee''s auth user id, recorded after the invite call returns. Used to revoke the unaccepted auth invite when an admin cancels.';

-- Only one live (pending) invite per email at a time, so the same email cannot
-- hold two live invites. The index is GLOBAL (no organisation_id in the key),
-- which matches the one-organisation rule from 022: a person joins exactly one
-- organisation, so a live invite for an email belongs to at most one. This
-- global uniqueness is also what keeps the per-organisation seat count exact:
-- a pending invite is counted in exactly one organisation. Consumed and
-- cancelled rows are kept for history and do not block a fresh invite later.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitations_email_live
  ON pending_invitations (email)
  WHERE status = 'pending';

-- The admin's pending-list query and the per-organisation seat count.
CREATE INDEX IF NOT EXISTS idx_pending_invitations_organisation
  ON pending_invitations (organisation_id);

-- ========================================================================
-- 026_team_access_security.sql
--
-- The team and access engine: functions, triggers, guards and policies.
-- Step 2 of two: run after 025. This file teaches the row level security
-- helpers about deactivation, makes the sign-up trigger invite-aware, adds the
-- acceptance path that joins an invited user, enforces the last-admin invariant
-- in the database, and adds the admin-only functions and policies the team
-- screen drives.
--
-- HOW THE PIECES FIT:
--   - HELPERS (current_user_organisation_id, is_organisation_admin) gain a
--     "deactivated_at IS NULL" clause. A deactivated membership now resolves to
--     no organisation and no admin rights, so the existing 024 policies deny a
--     deactivated user every project-scoped read and write, with no other
--     change to that security.
--   - SIGN-UP (handle_new_user) becomes invite-aware: an email with a pending
--     invite does NOT get a solo organisation. It is joined to the inviting
--     organisation at acceptance instead.
--   - JOIN (join_invited_user) is the one place that turns a pending invite
--     into a membership: it creates the membership, grants PULSE access, and
--     consumes the invite, but ONLY if the membership was actually created. If
--     the email already belongs to another organisation (a user belongs to
--     exactly one), it does nothing and leaves the invite pending, so a seat is
--     never silently lost. It is idempotent.
--   - ACCEPTANCE (handle_invite_acceptance) is a tightly-guarded trigger on
--     auth.users that runs join_invited_user at the moment an invited user
--     confirms (email_confirmed_at goes from null to set). It can never abort
--     the confirmation: any data error degrades to "invite stays pending".
--   - CLAIM (claim_pending_invitation) is a belt-and-braces RPC the set-password
--     step calls, so an invited user is joined even if the trigger did not fire
--     for the live auth configuration. Same idempotent join.
--   - LAST-ADMIN GUARD (enforce_last_admin) is a set-level statement trigger: it
--     refuses any update that leaves an organisation with zero active admins,
--     including a multi-row update, so the guard cannot be bypassed. The same
--     rule is mirrored in lib/team/adminGuard.js for instant UI feedback.
--   - ACTION FUNCTIONS (create_pending_invitation, cancel_invitation,
--     promote/demote/deactivate/reactivate_member) are SECURITY DEFINER so they
--     can write organisation_members and pending_invitations past row level
--     security, while each enforces admin-of-the-same-organisation inside. The
--     024 posture of no direct client writes is kept: pending_invitations has a
--     SELECT policy only, and all writes flow through these functions or the
--     server-side service role.
--
-- Idempotent: every function uses CREATE OR REPLACE, every trigger is dropped
-- before create, ENABLE ROW LEVEL SECURITY and the policy drops are safe to
-- repeat. Additive only; nothing an existing flow depends on is dropped.
--
-- PRESERVES EXISTING BEHAVIOUR: a self-signup (no pending invite) is handled
-- exactly as before (profile, PULSE access self_signup, solo organisation with
-- the user as its admin). The current admin, already active, is unaffected by
-- the helper change. The 024 tenant wall is unchanged.
--
-- Apply in the Supabase SQL editor, after 025. Do not apply to the hosted
-- flitrr-app project until this has been reviewed.
-- ========================================================================

-- Guard: 026 depends on the 025 schema. Fail loudly (rather than breaking row
-- level security by redefining the helpers against a missing column) if 025 has
-- not run.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisation_members'
      AND column_name = 'deactivated_at'
  ) THEN
    RAISE EXCEPTION 'Run 025_team_access_schema.sql before 026: organisation_members.deactivated_at is missing.';
  END IF;
END $$;

-- ========================================================================
-- HELPERS  a deactivated membership is no access.
--   Adding "deactivated_at IS NULL" is the single lever that denies a
--   deactivated user everything: current_user_organisation_id() returns NULL
--   and is_organisation_admin() returns false, so every 024 policy (which
--   compares to these) matches no rows for them. The organisation_members
--   SELECT policy keeps its "user_id = auth.uid()" branch, so a deactivated
--   user can still read their own membership row, which the app boundary uses
--   to show the deactivated notice.
-- ========================================================================
CREATE OR REPLACE FUNCTION current_user_organisation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id
  FROM organisation_members
  WHERE user_id = auth.uid()
    AND deactivated_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_user_organisation_id() IS
  'The organisation the authenticated caller belongs to, or NULL when they have no active membership (a deactivated membership resolves to NULL). SECURITY DEFINER so policies that call it do not recurse on organisation_members.';

CREATE OR REPLACE FUNCTION is_organisation_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND deactivated_at IS NULL
  );
$$;

COMMENT ON FUNCTION is_organisation_admin() IS
  'True when the authenticated caller is an active admin of their organisation. A deactivated admin returns false. SECURITY DEFINER for the same no-recursion reason as current_user_organisation_id().';

ALTER FUNCTION current_user_organisation_id() OWNER TO postgres;
ALTER FUNCTION is_organisation_admin() OWNER TO postgres;

-- ========================================================================
-- HANDLE_NEW_USER  invite-aware sign-up.
--   A new auth user with a pending invite for their email is an invited member:
--   they get only their profile here. Their membership, their PULSE access, and
--   consuming the invite all happen at acceptance (join_invited_user), so a
--   cancelled or never-accepted invite leaves no organisation, no access grant,
--   and no held membership behind. This is also what stops an invited member
--   wrongly getting their own solo organisation and colliding with the unique
--   membership constraint.
--
--   A new auth user with no pending invite is a self-signup and is handled
--   exactly as before: PULSE access (self_signup) and a solo organisation of
--   one with the user as its admin.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pulse_product_id UUID;
  v_email          TEXT;
  v_invited        BOOLEAN;
  new_org_id       UUID;
  new_org_name     TEXT;
BEGIN
  v_email := lower(btrim(NEW.email));

  INSERT INTO profiles (id, email, full_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company_name'
  );

  v_invited := EXISTS (
    SELECT 1 FROM pending_invitations
    WHERE email = v_email AND status = 'pending'
  );

  -- Invited member: profile only. Everything else waits for acceptance.
  IF v_invited THEN
    RETURN NEW;
  END IF;

  -- Self-signup, unchanged: PULSE access, then the user's solo organisation and
  -- their admin membership of it.
  SELECT id INTO pulse_product_id FROM products WHERE slug = 'pulse';
  IF pulse_product_id IS NOT NULL THEN
    INSERT INTO product_access (user_id, product_id, granted_by)
    VALUES (NEW.id, pulse_product_id, 'self_signup');
  END IF;

  new_org_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'company_name'), ''),
    NULLIF(btrim(NEW.email), ''),
    'Organisation ' || left(NEW.id::text, 8)
  );

  INSERT INTO organisations (name, seat_limit)
  VALUES (new_org_name, 1)
  RETURNING id INTO new_org_id;

  INSERT INTO organisation_members (organisation_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- ========================================================================
-- JOIN_INVITED_USER  the single, idempotent invite-to-membership step.
--   Creates the membership in the inviting organisation, grants PULSE access,
--   and consumes the invite, but ONLY when the membership is actually created.
--   A user belongs to exactly one organisation (organisation_members.user_id is
--   unique), so if the email already belongs to another organisation the insert
--   is a no-op and this function does NOTHING ELSE: it does not grant access and
--   does not consume the invite, so the seat is never silently lost and the
--   admin keeps seeing the pending invite. Safe to call more than once.
-- ========================================================================
CREATE OR REPLACE FUNCTION join_invited_user(p_user_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email          TEXT := lower(btrim(p_email));
  v_invite         pending_invitations%ROWTYPE;
  v_joined         BOOLEAN;
  pulse_product_id UUID;
BEGIN
  -- Already in an organisation: nothing to claim.
  IF EXISTS (SELECT 1 FROM organisation_members WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  SELECT * INTO v_invite
  FROM pending_invitations
  WHERE email = v_email AND status = 'pending'
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO organisation_members (organisation_id, user_id, role)
  VALUES (v_invite.organisation_id, p_user_id, v_invite.role)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE user_id = p_user_id AND organisation_id = v_invite.organisation_id
  ) INTO v_joined;

  -- The insert did not take (the user already belongs to another organisation).
  -- Do not grant access and do not consume the invite: leave the seat and the
  -- pending row intact for the admin to resolve.
  IF NOT v_joined THEN
    RETURN;
  END IF;

  SELECT id INTO pulse_product_id FROM products WHERE slug = 'pulse';
  IF pulse_product_id IS NOT NULL THEN
    INSERT INTO product_access (user_id, product_id, granted_by)
    VALUES (p_user_id, pulse_product_id, 'admin_invite')
    ON CONFLICT (user_id, product_id) DO NOTHING;
  END IF;

  UPDATE pending_invitations
  SET status = 'consumed',
      invited_user_id = COALESCE(invited_user_id, p_user_id)
  WHERE id = v_invite.id;
END;
$$;

ALTER FUNCTION join_invited_user(UUID, TEXT) OWNER TO postgres;

-- ========================================================================
-- HANDLE_INVITE_ACCEPTANCE  join the invited user at acceptance.
--   Supabase creates the invited auth user at invite time (unconfirmed), so the
--   sign-up trigger runs then. Acceptance is a later UPDATE that sets
--   email_confirmed_at. The WHEN clause fires this trigger ONLY on that exact
--   null-to-set transition, so ordinary sign-ins and token refreshes never run
--   it. The body is wrapped so a data error can never abort the confirmation
--   UPDATE: it degrades to "invite stays pending", which the claim RPC and the
--   app boundary then handle.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_invite_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM join_invited_user(NEW.id, NEW.email);
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the user's email confirmation for a recoverable data
    -- condition. The invite is left pending; claim_pending_invitation and the
    -- app boundary recover it.
    NULL;
  END;
  RETURN NEW;
END;
$$;

ALTER FUNCTION handle_invite_acceptance() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_invite_accepted ON auth.users;
CREATE TRIGGER on_auth_user_invite_accepted
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_invite_acceptance();

-- ========================================================================
-- CLAIM_PENDING_INVITATION  belt-and-braces acceptance from the app.
--   The set-password step calls this for the just-signed-in invited user, so a
--   pending invite is joined even if the database trigger did not fire for the
--   live auth configuration. It only acts for a confirmed user, and reuses the
--   same idempotent join, so calling it when the trigger already joined them is
--   a no-op.
-- ========================================================================
CREATE OR REPLACE FUNCTION claim_pending_invitation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_email     TEXT;
  v_confirmed TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT email, email_confirmed_at INTO v_email, v_confirmed
  FROM auth.users WHERE id = v_uid;

  -- Only a confirmed (accepted) user joins.
  IF v_confirmed IS NULL THEN
    RETURN;
  END IF;

  PERFORM join_invited_user(v_uid, v_email);
END;
$$;

ALTER FUNCTION claim_pending_invitation() OWNER TO postgres;

-- ========================================================================
-- ENFORCE_LAST_ADMIN  the database-level last-admin guard, set-level.
--   An organisation must always have at least one active admin. This is a
--   statement-level trigger using transition tables, so it holds even for a
--   multi-row update (a per-row trigger reasoning against a stale snapshot could
--   let two admins demote each other in one statement and leave zero). For every
--   organisation that had an active admin taken out of active-admin status in
--   the statement, it asserts at least one active admin still remains, and
--   refuses the whole statement otherwise.
--
--   UPDATE only, deliberately. The app never deletes a membership (remove means
--   deactivate, an UPDATE). The only deletes are out-of-band teardown (an
--   organisation or auth user being removed, which cascades), where this guard
--   must not interfere. There is no client delete path to organisation_members.
-- ========================================================================
CREATE OR REPLACE FUNCTION enforce_last_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  FOR v_org IN
    SELECT DISTINCT o.organisation_id
    FROM old_rows o
    JOIN new_rows n ON n.id = o.id
    WHERE (o.role = 'admin' AND o.deactivated_at IS NULL)
      AND NOT (n.role = 'admin' AND n.deactivated_at IS NULL)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM organisation_members m
      WHERE m.organisation_id = v_org
        AND m.role = 'admin'
        AND m.deactivated_at IS NULL
    ) THEN
      RAISE EXCEPTION 'An organisation must keep at least one active admin. Promote another member to admin before demoting or deactivating the last admin.'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

ALTER FUNCTION enforce_last_admin() OWNER TO postgres;

DROP TRIGGER IF EXISTS organisation_members_last_admin ON organisation_members;
CREATE TRIGGER organisation_members_last_admin
  AFTER UPDATE ON organisation_members
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION enforce_last_admin();

-- ========================================================================
-- TEAM_MEMBERS  the admin's roster, with emails.
--   profiles is own-row-only under 002, so the admin cannot read co-members'
--   emails through the authenticated client. This SECURITY DEFINER function
--   returns the roster (member plus their profile email and name) for the
--   caller's own organisation, and only to an admin (it returns no rows
--   otherwise). It does not loosen the profiles policy for any other read.
-- ========================================================================
CREATE OR REPLACE FUNCTION team_members()
RETURNS TABLE (
  user_id        UUID,
  email          TEXT,
  full_name      TEXT,
  role           organisation_role,
  deactivated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, p.email, p.full_name, m.role, m.deactivated_at, m.created_at
  FROM organisation_members m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE is_organisation_admin()
    AND m.organisation_id = current_user_organisation_id()
  ORDER BY (m.deactivated_at IS NOT NULL), (m.role <> 'admin'), p.email;
$$;

COMMENT ON FUNCTION team_members() IS
  'The roster (member plus profile email and name) for the caller''s organisation, returned only to an active admin. SECURITY DEFINER so it can read co-members'' profiles without loosening the profiles policy.';

ALTER FUNCTION team_members() OWNER TO postgres;

-- ========================================================================
-- CREATE_PENDING_INVITATION  seat-checked invite write, atomic.
--   Called server-side by the invite route before it sends the invite email.
--   It checks the caller is an admin, the email is sane, not already attached to
--   any organisation (a person belongs to exactly one) and not already a live
--   invite, and that a seat is free, then inserts the pending row. The route
--   then calls Supabase invite-by-email and records the invited auth user id.
-- ========================================================================
CREATE OR REPLACE FUNCTION create_pending_invitation(invite_email TEXT)
RETURNS pending_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org        UUID;
  v_email      TEXT;
  v_limit      INTEGER;
  v_active     INTEGER;
  v_pending    INTEGER;
  v_exist_org  UUID;
  v_exist_deact TIMESTAMPTZ;
  v_row        pending_invitations;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can invite members.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_org := current_user_organisation_id();
  v_email := lower(btrim(invite_email));

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Enter a valid email address.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A person belongs to exactly one organisation. Reject any email already
  -- attached to a membership, with a message that fits the case.
  SELECT m.organisation_id, m.deactivated_at INTO v_exist_org, v_exist_deact
  FROM organisation_members m
  JOIN profiles p ON p.id = m.user_id
  WHERE lower(btrim(p.email)) = v_email
  LIMIT 1;
  IF FOUND THEN
    IF v_exist_org = v_org AND v_exist_deact IS NULL THEN
      RAISE EXCEPTION 'That email is already an active member of your organisation.'
        USING ERRCODE = 'raise_exception';
    ELSIF v_exist_org = v_org THEN
      RAISE EXCEPTION 'That person is a deactivated member of your organisation. Reactivate them instead of inviting.'
        USING ERRCODE = 'raise_exception';
    ELSE
      RAISE EXCEPTION 'That person already belongs to an organisation.'
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  -- Already a live invite for this email (a live invite is unique across
  -- organisations, matching the one-organisation rule).
  IF EXISTS (
    SELECT 1 FROM pending_invitations
    WHERE email = v_email AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'There is already a pending invite for that email.'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- Seat check, atomic with the insert: a seat must be free.
  SELECT seat_limit INTO v_limit FROM organisations WHERE id = v_org;
  SELECT count(*) INTO v_active
  FROM organisation_members
  WHERE organisation_id = v_org AND deactivated_at IS NULL;
  SELECT count(*) INTO v_pending
  FROM pending_invitations
  WHERE organisation_id = v_org AND status = 'pending';

  IF (v_active + v_pending) >= COALESCE(v_limit, 1) THEN
    RAISE EXCEPTION 'All % seats are in use. Free a seat by deactivating a member, or contact Flitrr to raise your seat limit.', COALESCE(v_limit, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Insert. The partial unique index backs the live-invite rule against a
  -- concurrent insert; catch it and re-raise the same friendly message.
  BEGIN
    INSERT INTO pending_invitations (email, organisation_id, role, invited_by, status)
    VALUES (v_email, v_org, 'member', auth.uid(), 'pending')
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'There is already a pending invite for that email.'
      USING ERRCODE = 'raise_exception';
  END;

  RETURN v_row;
END;
$$;

ALTER FUNCTION create_pending_invitation(TEXT) OWNER TO postgres;

-- ========================================================================
-- CANCEL_INVITATION  withdraw a pending invite. Admin only.
--   Marks the pending row cancelled (only while it is still pending, so a cancel
--   that races an acceptance is a clean no-op) and returns the row, whose email
--   and invited_user_id let the route revoke the unaccepted auth invite. Frees
--   the seat and lets the email be invited again.
-- ========================================================================
CREATE OR REPLACE FUNCTION cancel_invitation(invitation_id UUID)
RETURNS pending_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_row pending_invitations;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can manage the team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_org := current_user_organisation_id();

  UPDATE pending_invitations
  SET status = 'cancelled'
  WHERE id = invitation_id
    AND organisation_id = v_org
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invite is no longer pending.'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_row;
END;
$$;

ALTER FUNCTION cancel_invitation(UUID) OWNER TO postgres;

-- ========================================================================
-- PROMOTE / DEMOTE / DEACTIVATE / REACTIVATE  the membership actions.
--   Each runs as definer (to write organisation_members past row level
--   security) but enforces "caller is an admin of the same organisation"
--   inside. The last-admin trigger backs demote and deactivate; reactivate
--   carries its own seat check. None can touch another organisation.
--
--   DEPENDENCY FOR A LATER LAYER. Deactivation deliberately does NOT reassign
--   any edit rights. Members are read-only in this step (no per-area edit
--   grants exist yet), so there is nothing to move when someone is deactivated.
--   When the per-area edit-rights layer lands, deactivate_member must be
--   revisited to reassign or revoke a deactivated person's edit grants. There
--   is nothing to migrate here today; this note marks the seam.
-- ========================================================================
CREATE OR REPLACE FUNCTION promote_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can manage the team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_org := current_user_organisation_id();

  UPDATE organisation_members
  SET role = 'admin'
  WHERE user_id = target_user_id
    AND organisation_id = v_org
    AND deactivated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That active member is not in your organisation.'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION demote_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can manage the team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_org := current_user_organisation_id();

  -- The last-admin trigger refuses this update if it would leave no active
  -- admin, with a clear message. Active admins only (matches the team screen).
  UPDATE organisation_members
  SET role = 'member'
  WHERE user_id = target_user_id
    AND organisation_id = v_org
    AND role = 'admin'
    AND deactivated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That active admin is not in your organisation.'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION deactivate_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org UUID;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can manage the team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_org := current_user_organisation_id();

  -- The last-admin trigger refuses this if the target is the last active admin.
  UPDATE organisation_members
  SET deactivated_at = NOW()
  WHERE user_id = target_user_id
    AND organisation_id = v_org
    AND deactivated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That active member is not in your organisation.'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reactivate_member(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org     UUID;
  v_limit   INTEGER;
  v_active  INTEGER;
  v_pending INTEGER;
BEGIN
  IF NOT is_organisation_admin() THEN
    RAISE EXCEPTION 'Only an organisation admin can manage the team.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_org := current_user_organisation_id();

  -- Reactivating returns a person to active, taking a seat. A seat must be free.
  SELECT seat_limit INTO v_limit FROM organisations WHERE id = v_org;
  SELECT count(*) INTO v_active
  FROM organisation_members
  WHERE organisation_id = v_org AND deactivated_at IS NULL;
  SELECT count(*) INTO v_pending
  FROM pending_invitations
  WHERE organisation_id = v_org AND status = 'pending';

  IF (v_active + v_pending) >= COALESCE(v_limit, 1) THEN
    RAISE EXCEPTION 'All % seats are in use. Free a seat before reactivating, or contact Flitrr to raise your seat limit.', COALESCE(v_limit, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE organisation_members
  SET deactivated_at = NULL
  WHERE user_id = target_user_id
    AND organisation_id = v_org
    AND deactivated_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That deactivated member is not in your organisation.'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

ALTER FUNCTION promote_member(UUID) OWNER TO postgres;
ALTER FUNCTION demote_member(UUID) OWNER TO postgres;
ALTER FUNCTION deactivate_member(UUID) OWNER TO postgres;
ALTER FUNCTION reactivate_member(UUID) OWNER TO postgres;

-- The team screen and the set-password step call these as the authenticated
-- user. EXECUTE to authenticated; each function enforces its own admin or
-- confirmed-user check inside, so an unauthorised call is rejected rather than
-- silently doing nothing.
GRANT EXECUTE ON FUNCTION team_members() TO authenticated;
GRANT EXECUTE ON FUNCTION create_pending_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_pending_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION promote_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION demote_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reactivate_member(UUID) TO authenticated;

-- ========================================================================
-- PENDING_INVITATIONS  row level security: SELECT only.
--   An admin of the owning organisation may read its invites (the team screen
--   needs this). There are NO client write policies: every write goes through a
--   SECURITY DEFINER function above (create_pending_invitation, cancel_invitation
--   and the join path) or the server-side service role (the invite route's
--   invited_user_id write and its rollback). This mirrors the 024 posture for
--   organisation_members and removes any client path to manipulate an invite's
--   status. The sign-up and join functions read this table as SECURITY DEFINER,
--   so they are unaffected by the policy.
-- ========================================================================
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read their organisation invites" ON pending_invitations;
CREATE POLICY "Admins can read their organisation invites"
  ON pending_invitations FOR SELECT
  USING (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

-- Remove any client write policies from an earlier draft of this migration; all
-- writes flow through the definer functions or the service role.
DROP POLICY IF EXISTS "Admins can create their organisation invites" ON pending_invitations;
DROP POLICY IF EXISTS "Admins can update their organisation invites" ON pending_invitations;
DROP POLICY IF EXISTS "Admins can delete their organisation invites" ON pending_invitations;

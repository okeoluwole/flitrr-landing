-- ========================================================================
-- team_access_manual_check.sql
--
-- Manual verification of the team and access engine (migrations 025 and 026),
-- the companion to organisations_rls_manual_check.sql. There is no Supabase
-- integration harness in this repo (the Vitest suite is pure logic and never
-- touches the database), so this is the script to run by hand on a database
-- that has 022 to 026 applied. Do NOT run it against live data.
--
-- IT ENDS IN AN ERROR ON PURPOSE, exactly like the organisations check: it
-- accumulates each check's outcome and RAISES the verdict at the end. The
-- dashboard shows the error text (the verdict), and the exception aborts the
-- transaction so every disposable user, organisation and project rolls back and
-- nothing persists. A green "Success" would be the wrong outcome here.
--
-- READ THE RESULT LIKE THIS:
--   ERROR ... TEAM ACCESS VERIFICATION PASSED: all N checks passed ...   -> good.
--   ERROR ... TEAM ACCESS VERIFICATION FAILED: ... <which checks> ...     -> investigate.
--   ERROR ... RLS not enforced ...                                        -> the session
--       bypassed row level security (ran as a superuser/owner). Re-run in a
--       normal SQL editor.
--
-- WHAT IS PROVEN, matching the brief:
--   1. A deactivated member is denied all organisation data, and resolves to no
--      organisation and no admin rights (the helper change).
--   2. An active member of the same organisation is not denied that data.
--   3. Reactivation restores access.
--   4. The last-admin guard: the sole active admin cannot demote or deactivate
--      itself; once another member is promoted to admin, it can.
--
-- The seat-availability rule is covered by the pure unit tests (tests/
-- teamSeats.test.js) and enforced by create_pending_invitation and
-- reactivate_member; it is not re-proven here.
--
-- NOTE. The disposable users are inserted into auth.users with a small, common
-- set of columns. If your auth schema rejects that insert on some other NOT
-- NULL column, add it to the three INSERT rows below. Everything rolls back.
-- ========================================================================

DO $check$
DECLARE
  org_a       UUID;
  old_org1    UUID;
  old_org2    UUID;
  u_admin     UUID := gen_random_uuid();
  u_member1   UUID := gen_random_uuid();
  u_member2   UUID := gen_random_uuid();
  u_invitee   UUID := gen_random_uuid();
  proj_a      UUID;
  v_org       UUID;
  v_admin     BOOLEAN;
  n           INTEGER;
  raised      BOOLEAN;
  ok          BOOLEAN;
  checks      INTEGER := 0;
  fails       INTEGER := 0;
  failed_list TEXT := '';
BEGIN
  -- ===================== SETUP (as the migration runner) =====================
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u_admin,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-admin@example.com'),
    (u_member1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-member1@example.com'),
    (u_member2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-member2@example.com');

  -- The sign-up trigger gave each a solo organisation. Use the admin's as org A,
  -- widen its seat limit, and re-home the two members into it as members (the
  -- delete of their solo admin membership is allowed: the last-admin guard is on
  -- update, not delete).
  SELECT organisation_id INTO org_a FROM organisation_members WHERE user_id = u_admin;
  UPDATE organisations SET seat_limit = 5 WHERE id = org_a;

  SELECT organisation_id INTO old_org1 FROM organisation_members WHERE user_id = u_member1;
  DELETE FROM organisation_members WHERE user_id = u_member1;
  DELETE FROM organisations WHERE id = old_org1;
  INSERT INTO organisation_members (organisation_id, user_id, role) VALUES (org_a, u_member1, 'member');

  SELECT organisation_id INTO old_org2 FROM organisation_members WHERE user_id = u_member2;
  DELETE FROM organisation_members WHERE user_id = u_member2;
  DELETE FROM organisations WHERE id = old_org2;
  INSERT INTO organisation_members (organisation_id, user_id, role) VALUES (org_a, u_member2, 'member');

  INSERT INTO projects (user_id, organisation_id, name)
    VALUES (u_admin, org_a, 'Team Verify Project') RETURNING id INTO proj_a;

  -- ===================== INVITE ACCEPTANCE (as the migration runner) =========
  -- A pending invite, the invited auth user (the sign-up trigger must NOT give
  -- them a solo organisation), then confirmation joins them to the inviting
  -- organisation and consumes the invite.
  INSERT INTO pending_invitations (email, organisation_id, role, invited_by, status)
    VALUES ('team-invitee@example.com', org_a, 'member', u_admin, 'pending');

  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u_invitee, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'team-invitee@example.com');

  SELECT count(*) INTO n FROM organisation_members WHERE user_id = u_invitee;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | invited user has no membership before acceptance'; END IF;

  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = u_invitee;

  SELECT organisation_id INTO v_org FROM organisation_members WHERE user_id = u_invitee;
  ok := (v_org = org_a); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | invited user joins the inviting organisation at acceptance'; END IF;

  SELECT count(*) INTO n FROM pending_invitations WHERE email = 'team-invitee@example.com' AND status = 'consumed';
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | the invite is consumed at acceptance'; END IF;

  PERFORM set_config('role', 'authenticated', true);

  -- ===================== ENFORCEMENT GUARD =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_member2::text, 'role', 'authenticated')::text, true);
  IF current_setting('is_superuser') <> 'off' THEN
    RAISE EXCEPTION 'RLS not enforced: session is still superuser after the role downgrade. Aborting to avoid a false pass.';
  END IF;

  -- ===================== ADMIN deactivates a member =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_admin::text, 'role', 'authenticated')::text, true);

  raised := false;
  BEGIN PERFORM deactivate_member(u_member1);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := NOT raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin deactivates a member'; END IF;

  -- ===================== 1. DEACTIVATED member is denied =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_member1::text, 'role', 'authenticated')::text, true);

  v_org := current_user_organisation_id();
  ok := (v_org IS NULL); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | deactivated member resolves to no organisation'; END IF;

  v_admin := is_organisation_admin();
  ok := (v_admin = false); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | deactivated member is not an admin'; END IF;

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | deactivated member cannot read organisation data'; END IF;

  -- ===================== 2. ACTIVE member is not denied =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_member2::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | active member can read organisation data'; END IF;

  -- ===================== 4. LAST-ADMIN guard =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_admin::text, 'role', 'authenticated')::text, true);

  -- The sole active admin (member1 deactivated, member2 a member) cannot demote
  -- itself.
  raised := false;
  BEGIN PERFORM demote_member(u_admin);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | last admin cannot demote itself'; END IF;

  -- Nor deactivate itself.
  raised := false;
  BEGIN PERFORM deactivate_member(u_admin);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | last admin cannot deactivate itself'; END IF;

  -- Promote member2 to admin, then the original admin can be demoted.
  raised := false;
  BEGIN PERFORM promote_member(u_member2);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := NOT raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin promotes another member to admin'; END IF;

  raised := false;
  BEGIN PERFORM demote_member(u_admin);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := NOT raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin can demote itself once another admin exists'; END IF;

  -- ===================== 3. REACTIVATION restores access =====================
  -- member2 is now an active admin; reactivate member1 (a seat is free, the
  -- organisation is under its seat limit).
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_member2::text, 'role', 'authenticated')::text, true);

  raised := false;
  BEGIN PERFORM reactivate_member(u_member1);
  EXCEPTION WHEN OTHERS THEN raised := true; END;
  ok := NOT raised; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin reactivates a deactivated member'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_member1::text, 'role', 'authenticated')::text, true);

  v_org := current_user_organisation_id();
  ok := (v_org = org_a); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | reactivated member resolves to their organisation'; END IF;

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | reactivated member can read organisation data again'; END IF;

  -- ===================== VERDICT (intentional, forces rollback) =====================
  IF fails = 0 THEN
    RAISE EXCEPTION 'TEAM ACCESS VERIFICATION PASSED: all % checks passed, deactivation denies, reactivation restores, and the last-admin guard holds. (This error is intentional: it rolls the check back so nothing persisted.)', checks;
  ELSE
    RAISE EXCEPTION 'TEAM ACCESS VERIFICATION FAILED: % of % checks failed:%. (Rolled back; nothing persisted.)', fails, checks, failed_list;
  END IF;
END
$check$;

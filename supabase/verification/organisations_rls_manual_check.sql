-- ========================================================================
-- organisations_rls_manual_check.sql
--
-- Manual verification of the organisation tenant boundary (migrations 022,
-- 023, 024). There is no Supabase integration test harness in this repo (the
-- Vitest suite is pure engine logic and never touches the database), so this
-- is the script to run by hand on the local or development database after the
-- three migrations are applied. Do NOT run it against live data.
--
-- HOW IT REPORTS, AND WHY IT ENDS IN AN ERROR ON PURPOSE. The Supabase
-- dashboard SQL editor does not display RAISE NOTICE output, and a temp results
-- table cannot be written once the script downgrades its role to authenticated
-- (the role the checks must run as). So the script accumulates each check's
-- outcome in an in-memory variable and, at the very end, RAISES the verdict as
-- an exception. That is intentional and does two jobs at once: the verdict is
-- shown (the dashboard always shows an error message), and the exception aborts
-- the transaction, so every disposable user, organisation and project the
-- script created is rolled back and nothing persists. A green "Success" would
-- actually be the wrong outcome here.
--
-- READ THE RESULT LIKE THIS:
--   ERROR ... RLS VERIFICATION PASSED: all N checks passed ...   -> good.
--   ERROR ... RLS VERIFICATION FAILED: ... <which checks> ...     -> investigate.
--   ERROR ... RLS not enforced ...                                -> the session
--       bypassed row level security (ran as a superuser/owner), so the run was
--       aborted rather than print a false pass. Re-run in a normal SQL editor.
--
-- WORKING WITH THE SIGN-UP TRIGGER, NOT AGAINST IT. The SQL editor role is not
-- the owner of auth.users, so it cannot disable the on_auth_user_created
-- trigger. The script therefore lets that trigger run: inserting the three
-- disposable auth users makes the trigger provision each one a profile, default
-- PULSE access, and a solo organisation with an admin membership (the real 023
-- path, which this also verifies). The test topology is then built from those
-- auto organisations: the A admin's becomes org A, the B admin's becomes org B,
-- and the A member is re-homed from their own solo organisation into org A as a
-- member (exactly how Olu will place a corporate member by hand until the
-- onboarding UI lands).
--
-- HOW IT IMPERSONATES A USER. It switches the current role to authenticated and
-- sets request.jwt.claims so that auth.uid() returns the chosen user id, exactly
-- as a real request from that signed-in user would. Before scoring anything it
-- asserts that row level security is actually being enforced. Expected denials
-- (an admin-only write by a member, or any cross-organisation write) are caught
-- so the run reaches its verdict.
--
-- WHAT IS PROVEN, matching the brief and the load-bearing paths:
--   1. A member of organisation A cannot read or write organisation B's data.
--   2. A member reads but cannot write their own organisation's data (projects
--      and child tables, including the named programme tables).
--   3. An admin can read and write their own organisation's data.
--   4. The BEFORE INSERT trigger tenants a new project: an admin insert that
--      sets no organisation_id (the real app path) comes back tenanted to the
--      admin's own organisation.
--
-- NOTE. The disposable users are inserted into auth.users with a small, common
-- set of columns. If your auth schema rejects that insert on some other NOT
-- NULL column, add it to the three INSERT rows below. Everything rolls back, so
-- a failed run leaves nothing behind.
-- ========================================================================

DO $check$
DECLARE
  org_a          UUID;
  org_b          UUID;
  member_old_org UUID;
  u_a_admin      UUID := gen_random_uuid();
  u_a_member     UUID := gen_random_uuid();
  u_b_admin      UUID := gen_random_uuid();
  proj_a         UUID;
  proj_b         UUID;
  v_trig_org     UUID;
  n              INTEGER;
  denied         BOOLEAN;
  ok             BOOLEAN;
  checks         INTEGER := 0;
  fails          INTEGER := 0;
  failed_list    TEXT := '';
BEGIN
  -- Scoring is inlined per check as: checks := checks + 1; IF NOT ok THEN
  -- fails := fails + 1; failed_list := failed_list || ' | <detail>'; END IF;

  -- ===================== SETUP (as the migration runner) =====================
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u_a_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-a-admin@example.com'),
    (u_a_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-a-member@example.com'),
    (u_b_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-b-admin@example.com');

  SELECT organisation_id INTO org_a FROM organisation_members WHERE user_id = u_a_admin;
  SELECT organisation_id INTO org_b FROM organisation_members WHERE user_id = u_b_admin;
  UPDATE organisations SET seat_limit = 5 WHERE id IN (org_a, org_b);

  SELECT organisation_id INTO member_old_org FROM organisation_members WHERE user_id = u_a_member;
  DELETE FROM organisation_members WHERE user_id = u_a_member;
  DELETE FROM organisations WHERE id = member_old_org;
  INSERT INTO organisation_members (organisation_id, user_id, role) VALUES (org_a, u_a_member, 'member');

  INSERT INTO projects (user_id, organisation_id, name)
    VALUES (u_a_admin, org_a, 'Verify Project A') RETURNING id INTO proj_a;
  INSERT INTO projects (user_id, organisation_id, name)
    VALUES (u_b_admin, org_b, 'Verify Project B') RETURNING id INTO proj_b;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a_member::text, 'role', 'authenticated')::text, true);

  -- ===================== ENFORCEMENT GUARD =====================
  IF current_setting('is_superuser') <> 'off' THEN
    RAISE EXCEPTION 'RLS not enforced: session is still superuser after the role downgrade. Aborting to avoid a false pass.';
  END IF;
  SELECT count(*) INTO n FROM projects WHERE id = proj_b;
  IF n <> 0 THEN
    RAISE EXCEPTION 'RLS not enforced: a member of A can see an org B project. Aborting to avoid a false pass.';
  END IF;

  -- ===================== 3. ADMIN reads and writes own =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a_admin::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin reads own project'; END IF;

  UPDATE projects SET name = 'Verify Project A edited' WHERE id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin updates own project'; END IF;

  denied := false;
  BEGIN INSERT INTO project_actions (project_id, description) VALUES (proj_a, 'verify admin insert');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := NOT denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin inserts a child row in own project'; END IF;

  INSERT INTO projects (user_id, name) VALUES (u_a_admin, 'Verify trigger project')
    RETURNING organisation_id INTO v_trig_org;
  ok := (v_trig_org = org_a); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | BEFORE INSERT trigger tenants a new project'; END IF;

  denied := false;
  BEGIN INSERT INTO programme_milestone_actuals (project_id, milestone_key, met_date) VALUES (proj_a, 'verify-key', CURRENT_DATE);
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := NOT denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin records a milestone actual'; END IF;

  denied := false;
  BEGIN INSERT INTO programme_baselines (project_id, version, programme) VALUES (proj_a, 1, '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := NOT denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin locks a programme baseline'; END IF;

  -- ===================== 2. MEMBER reads, cannot write own =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a_member::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member reads own organisation project'; END IF;

  SELECT count(*) INTO n FROM project_objectives WHERE project_id = proj_a;
  ok := (n > 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member reads own organisation child rows'; END IF;

  SELECT count(*) INTO n FROM programme_milestone_actuals WHERE project_id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member reads own organisation programme actuals'; END IF;

  SELECT count(*) INTO n FROM programme_baselines WHERE project_id = proj_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member reads own organisation programme baseline'; END IF;

  UPDATE projects SET name = 'member edit attempt' WHERE id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot update own organisation project'; END IF;

  UPDATE project_objectives SET definition = 'member edit attempt' WHERE project_id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot update own organisation child rows'; END IF;

  denied := false;
  BEGIN INSERT INTO project_actions (project_id, description) VALUES (proj_a, 'member insert attempt');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot insert a child row'; END IF;

  denied := false;
  BEGIN INSERT INTO programme_milestone_actuals (project_id, milestone_key, met_date) VALUES (proj_a, 'member-key', CURRENT_DATE);
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot record a milestone actual'; END IF;

  -- ===================== 1. MEMBER of A cannot touch B =====================
  SELECT count(*) INTO n FROM projects WHERE id = proj_b;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member of A cannot read org B project'; END IF;

  denied := false;
  BEGIN INSERT INTO project_actions (project_id, description) VALUES (proj_b, 'cross-tenant insert attempt');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member of A cannot write org B data'; END IF;

  -- ===================== cross-organisation from the B admin side =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_b_admin::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM projects WHERE id = proj_a;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot read org A project'; END IF;

  SELECT count(*) INTO n FROM programme_milestone_actuals WHERE project_id = proj_a;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot read org A programme actuals'; END IF;

  UPDATE projects SET name = 'B admin cross edit' WHERE id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot update org A project'; END IF;

  UPDATE project_objectives SET definition = 'B admin cross edit' WHERE project_id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot update org A child rows'; END IF;

  DELETE FROM project_objectives WHERE project_id = proj_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot delete org A child rows'; END IF;

  denied := false;
  BEGIN INSERT INTO programme_milestone_actuals (project_id, milestone_key, met_date) VALUES (proj_a, 'cross-key', CURRENT_DATE);
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot write org A programme data'; END IF;

  SELECT count(*) INTO n FROM projects WHERE id = proj_b;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B reads own project'; END IF;

  UPDATE projects SET name = 'Verify Project B edited' WHERE id = proj_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B updates own project'; END IF;

  -- ===================== VERDICT (intentional, forces rollback) =====================
  IF fails = 0 THEN
    RAISE EXCEPTION 'RLS VERIFICATION PASSED: all % checks passed, the tenant boundary holds. (This error is intentional: it rolls the check back so nothing persisted.)', checks;
  ELSE
    RAISE EXCEPTION 'RLS VERIFICATION FAILED: % of % checks failed:%. (Rolled back; nothing persisted.)', fails, checks, failed_list;
  END IF;
END
$check$;

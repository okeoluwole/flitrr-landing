-- ========================================================================
-- stack_schemes_manual_check.sql
--
-- Manual verification of the STACK saved scheme store (migration 028). The
-- Vitest suite is pure engine logic and never touches the database, so this
-- is the script to run by hand on the local or development database after
-- 028 is applied (which itself requires 022 to 024). Do NOT run it against
-- live data.
--
-- Same mechanics as organisations_rls_manual_check.sql: the script builds a
-- disposable two-organisation topology by inserting auth users (letting the
-- 023 sign-up trigger provision each a solo organisation), downgrades the
-- session to the authenticated role, impersonates each user through
-- request.jwt.claims, and accumulates check outcomes. It ENDS IN AN ERROR ON
-- PURPOSE: the final RAISE shows the verdict (the dashboard always displays
-- an error message) and aborts the transaction, so everything the script
-- created is rolled back and nothing persists.
--
-- READ THE RESULT LIKE THIS:
--   ERROR ... STACK SCHEMES VERIFICATION PASSED ...  -> good.
--   ERROR ... STACK SCHEMES VERIFICATION FAILED ...  -> investigate.
--   ERROR ... RLS not enforced ...                   -> the session bypassed
--       row level security; re-run in a normal SQL editor.
-- ========================================================================

DO $check$
DECLARE
  org_a       UUID;
  org_b       UUID;
  member_old  UUID;
  u_a_admin   UUID := gen_random_uuid();
  u_a_member  UUID := gen_random_uuid();
  u_b_admin   UUID := gen_random_uuid();
  scheme_a    UUID;
  v_org       UUID;
  v_version   TEXT;
  n           INTEGER;
  denied      BOOLEAN;
  ok          BOOLEAN;
  checks      INTEGER := 0;
  fails       INTEGER := 0;
  failed_list TEXT := '';
BEGIN
  -- ===================== SETUP (as the migration runner) =====================
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u_a_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-stack-a-admin@example.com'),
    (u_a_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-stack-a-member@example.com'),
    (u_b_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-stack-b-admin@example.com');

  SELECT organisation_id INTO org_a FROM organisation_members WHERE user_id = u_a_admin;
  SELECT organisation_id INTO org_b FROM organisation_members WHERE user_id = u_b_admin;
  UPDATE organisations SET seat_limit = 5 WHERE id IN (org_a, org_b);

  SELECT organisation_id INTO member_old FROM organisation_members WHERE user_id = u_a_member;
  DELETE FROM organisation_members WHERE user_id = u_a_member;
  DELETE FROM organisations WHERE id = member_old;
  INSERT INTO organisation_members (organisation_id, user_id, role) VALUES (org_a, u_a_member, 'member');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a_admin::text, 'role', 'authenticated')::text, true);

  -- ===================== ENFORCEMENT GUARD =====================
  IF current_setting('is_superuser') <> 'off' THEN
    RAISE EXCEPTION 'RLS not enforced: session is still superuser after the role downgrade. Aborting to avoid a false pass.';
  END IF;

  -- ===================== ADMIN A: insert, trigger, read, update =====================
  -- Insert WITHOUT organisation_id: the BEFORE INSERT trigger must tenant the
  -- row to the caller's organisation, the same load-bearing path the save
  -- action will use.
  INSERT INTO stack_schemes (name, inputs, engine_version, created_by)
    VALUES ('Verify Scheme A', '{"gdv": 1000000}'::jsonb, '1.0.0', u_a_admin)
    RETURNING id, organisation_id INTO scheme_a, v_org;
  ok := (v_org = org_a); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | BEFORE INSERT trigger tenants a new scheme'; END IF;

  SELECT count(*) INTO n FROM stack_schemes WHERE id = scheme_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin reads own scheme'; END IF;

  UPDATE stack_schemes SET inputs = '{"gdv": 2000000}'::jsonb, engine_version = '1.0.0' WHERE id = scheme_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin updates own scheme (the save-over path)'; END IF;

  SELECT engine_version INTO v_version FROM stack_schemes WHERE id = scheme_a;
  ok := (v_version = '1.0.0'); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | engine version stamp survives the save-over'; END IF;

  -- A blank name must be rejected by the check constraint, whoever writes it.
  denied := false;
  BEGIN INSERT INTO stack_schemes (name, inputs, engine_version) VALUES ('   ', '{}'::jsonb, '1.0.0');
  EXCEPTION WHEN check_violation THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | blank scheme name is rejected'; END IF;

  -- ===================== MEMBER A: reads, cannot write =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a_member::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM stack_schemes WHERE id = scheme_a;
  ok := (n = 1); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member reads own organisation scheme'; END IF;

  denied := false;
  BEGIN INSERT INTO stack_schemes (name, inputs, engine_version) VALUES ('Member insert attempt', '{}'::jsonb, '1.0.0');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot insert a scheme'; END IF;

  UPDATE stack_schemes SET name = 'member edit attempt' WHERE id = scheme_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot update a scheme'; END IF;

  DELETE FROM stack_schemes WHERE id = scheme_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | member cannot delete a scheme'; END IF;

  -- ===================== ADMIN B: the tenant boundary =====================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_b_admin::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM stack_schemes WHERE id = scheme_a;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot read org A scheme'; END IF;

  UPDATE stack_schemes SET name = 'B admin cross edit' WHERE id = scheme_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot update org A scheme'; END IF;

  DELETE FROM stack_schemes WHERE id = scheme_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  ok := (n = 0); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot delete org A scheme'; END IF;

  -- An explicit cross-tenant insert (organisation_id set to org A by hand)
  -- must fail the WITH CHECK, not slip past the trigger default.
  denied := false;
  BEGIN INSERT INTO stack_schemes (organisation_id, name, inputs, engine_version) VALUES (org_a, 'Cross-tenant insert attempt', '{}'::jsonb, '1.0.0');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  ok := denied; checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B cannot insert into org A'; END IF;

  -- And B admin's own save path still works.
  INSERT INTO stack_schemes (name, inputs, engine_version, created_by)
    VALUES ('Verify Scheme B', '{"gdv": 500000}'::jsonb, '1.0.0', u_b_admin)
    RETURNING organisation_id INTO v_org;
  ok := (v_org = org_b); checks := checks + 1; IF NOT ok THEN fails := fails + 1; failed_list := failed_list || ' | admin of B saves a scheme in own organisation'; END IF;

  -- ===================== VERDICT (intentional, forces rollback) =====================
  IF fails = 0 THEN
    RAISE EXCEPTION 'STACK SCHEMES VERIFICATION PASSED: all % checks passed, the scheme store holds the tenant boundary. (This error is intentional: it rolls the check back so nothing persisted.)', checks;
  ELSE
    RAISE EXCEPTION 'STACK SCHEMES VERIFICATION FAILED: % of % checks failed:%. (Rolled back; nothing persisted.)', fails, checks, failed_list;
  END IF;
END
$check$;

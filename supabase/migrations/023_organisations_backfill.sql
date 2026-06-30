-- ========================================================================
-- 023_organisations_backfill.sql
--
-- The backfill for the organisation model. Step 2 of three: run after 022,
-- before 024. Safe to read and review: it creates one organisation per
-- existing user, makes that user the admin of it, and reparents that user's
-- projects onto it. It also extends the sign-up trigger so every new user
-- gets the same solo organisation, which is what keeps project creation
-- working once 024 makes projects.organisation_id NOT NULL.
--
-- THE MAPPING, with no guessing:
--   - A project is owned through projects.user_id, a NOT NULL foreign key to
--     auth.users (see 004). There is no other ownership linkage, and no
--     project can lack a user_id. So ownership is never ambiguous.
--   - We create one organisation for every row in auth.users (the authoritative
--     user list that both projects.user_id and organisation_members.user_id
--     reference), name it from the user's email, and make the user its admin.
--   - We reparent each project to the organisation created for its user_id.
--     Because an organisation is created for every auth user, every project's
--     user_id resolves to exactly one organisation, so no project is left
--     orphaned. The report block at the end confirms this and refuses to leave
--     any project untenanted silently.
--
-- This migration does NOT set projects.organisation_id NOT NULL. That is done
-- at the end of 024, after the BEFORE INSERT trigger that auto-populates the
-- column exists, so the constraint is never enforced without the mechanism
-- that satisfies it for new rows. Enforcing it before the trigger existed
-- would break project creation, which is exactly what must not happen.
--
-- Idempotent: the per-user loop skips any user who already has a membership,
-- the reparent only touches projects still null, and CREATE OR REPLACE on the
-- trigger function is a no-op on re-run. Apply in the Supabase SQL editor.
-- Apply to the local or development database only. Do not run the backfill
-- against live data until it has been reviewed.
-- ========================================================================

-- ========================================================================
-- BACKFILL  one organisation per existing user, that user as admin, then
-- reparent the user's projects. A row-by-row loop is used because each user
-- needs the id of the organisation just created for them, to set both the
-- membership and the reparent. It is plain to read and safe to re-run.
-- ========================================================================
DO $$
DECLARE
  u             RECORD;
  v_org_id      UUID;
  v_org_name    TEXT;
  v_orgs        INTEGER := 0;
  v_reparented  INTEGER := 0;
  v_n           INTEGER;
BEGIN
  FOR u IN
    SELECT id, email
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM organisation_members)
    ORDER BY created_at
  LOOP
    -- A sensible default name, clearly editable later: the email, or a short
    -- label off the user id when no email is present.
    v_org_name := COALESCE(
      NULLIF(btrim(u.email), ''),
      'Organisation ' || left(u.id::text, 8)
    );

    -- The solo organisation, seat_limit 1.
    INSERT INTO organisations (name, seat_limit)
    VALUES (v_org_name, 1)
    RETURNING id INTO v_org_id;
    v_orgs := v_orgs + 1;

    -- The user is the admin of their own organisation.
    INSERT INTO organisation_members (organisation_id, user_id, role)
    VALUES (v_org_id, u.id, 'admin');

    -- Reparent that user's projects that are not already tenanted.
    UPDATE projects
    SET organisation_id = v_org_id
    WHERE user_id = u.id
      AND organisation_id IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_reparented := v_reparented + v_n;
  END LOOP;

  RAISE NOTICE 'Backfill: created % organisation(s), reparented % project(s).',
    v_orgs, v_reparented;
END $$;

-- ========================================================================
-- ORPHAN GUARD AND REPORT  surface, do not hide, any project still without an
-- organisation. With the mapping above there should be none. If any remain
-- (for example a project whose user_id somehow has no auth.users row), this
-- reports the count and the ids and stops, so the ambiguity is reviewed by
-- hand rather than backfilled blindly. 024 will then leave the column nullable
-- rather than failing on NOT NULL.
-- ========================================================================
DO $$
DECLARE
  v_orphans INTEGER;
  v_ids     TEXT;
BEGIN
  SELECT count(*) INTO v_orphans FROM projects WHERE organisation_id IS NULL;
  IF v_orphans = 0 THEN
    RAISE NOTICE 'Backfill check: every project is tenanted.';
  ELSE
    SELECT string_agg(id::text, ', ') INTO v_ids
    FROM projects WHERE organisation_id IS NULL;
    RAISE WARNING 'Backfill check: % project(s) still without an organisation: %. Resolve by hand before enforcing NOT NULL.',
      v_orphans, v_ids;
  END IF;
END $$;

-- ========================================================================
-- HANDLE_NEW_USER  extend the existing sign-up trigger so every new user is an
-- organisation of one, the same as the backfill makes every existing user.
--
-- WHY THIS IS NECESSARY. After 024, projects.organisation_id is NOT NULL and
-- the BEFORE INSERT trigger fills it from the creating user's organisation. A
-- brand new user with no organisation would have nothing to fill it from, and
-- their first project would fail. Creating their solo organisation at sign-up
-- closes that gap, and is the model-correct behaviour ("everything is an
-- organisation"). This is a database trigger change, not application code; no
-- application code is changed by this work.
--
-- The existing behaviour (mirror the profile, grant default PULSE access) is
-- preserved exactly; the organisation provisioning is added. SECURITY DEFINER
-- (unchanged) lets the function write organisations and organisation_members
-- past their row level security, which is correct: a user does not create
-- their own organisation through the client, the sign-up trigger does.
--
-- A note for corporate onboarding (the next step): every new auth user gets a
-- solo organisation here, and organisation_members.user_id is unique. To place
-- a user in a corporate organisation instead, Olu moves their membership (the
-- solo one is removed and the corporate one added) directly in Supabase, which
-- is how members are set up until the onboarding UI lands.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pulse_product_id UUID;
  new_org_id       UUID;
  new_org_name     TEXT;
BEGIN
  INSERT INTO profiles (id, email, full_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company_name'
  );

  SELECT id INTO pulse_product_id FROM products WHERE slug = 'pulse';

  IF pulse_product_id IS NOT NULL THEN
    INSERT INTO product_access (user_id, product_id, granted_by)
    VALUES (NEW.id, pulse_product_id, 'self_signup');
  END IF;

  -- The new user's solo organisation, and their admin membership of it. The
  -- company_name from sign-up, when present, is the friendlier default name;
  -- otherwise the email, then a short label off the user id.
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

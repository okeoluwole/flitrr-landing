-- ========================================================================
-- 038_stack_product.sql
--
-- STACK joins the product launcher. The /dashboard launcher is data-driven:
-- a signed-in reader sees a card for every products row their
-- product_access grants, so until now STACK was reachable only by URL.
-- This migration makes STACK a first-class product of the platform:
--
--   1. A products row for STACK, status live.
--   2. Both products' copy settles on the locked one-liners the marketing
--      nav carries (PULSE's row still held its 001 seed sentence and
--      in_build status; both products have been live on flitrr.com since
--      2026-08-16).
--   3. A backfill: every user with a PULSE grant gets a STACK grant,
--      mirroring how they acquired PULSE, so existing readers see the new
--      card without re-inviting anyone.
--   4. The two grant paths learn the second product: handle_new_user
--      (self sign-up) and join_invited_user (invite acceptance) grant both
--      PULSE and STACK. The slugs stay an explicit list, never "every
--      product", so a future planned product is not auto-granted by
--      accident.
--
-- Both function bodies are the 026 definitions verbatim with ONLY the
-- grant statements widened (a slug list replaces the single pulse lookup).
-- Everything else (the invited-member early return, the one-organisation
-- guard, the invite role, the seat-preserving no-op) is unchanged.
--
-- Idempotent: the insert and the backfill are guarded by NOT EXISTS /
-- ON CONFLICT, the updates are absolute, and the function bodies are
-- CREATE OR REPLACE. Apply after 026 (it replaces functions defined there).
-- ========================================================================

-- ========================================================================
-- 1 + 2. The products rows: STACK inserted, both on the locked one-liners.
-- ========================================================================
INSERT INTO products (slug, name, description, status)
SELECT 'stack', 'STACK', 'Feasibility, budgets and funding.', 'live'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'stack');

UPDATE products
SET description = 'Project delivery and programme management.',
    status = 'live'
WHERE slug = 'pulse';

-- ========================================================================
-- 3. Backfill: a STACK grant beside every existing PULSE grant, carrying
-- the same granted_by so the acquisition story stays truthful.
-- ========================================================================
INSERT INTO product_access (user_id, product_id, granted_by)
SELECT pa.user_id, stack.id, pa.granted_by
FROM product_access pa
JOIN products pulse ON pulse.id = pa.product_id AND pulse.slug = 'pulse'
CROSS JOIN (SELECT id FROM products WHERE slug = 'stack') AS stack
ON CONFLICT (user_id, product_id) DO NOTHING;

-- ========================================================================
-- 4a. HANDLE_NEW_USER: the 026 definition, with the self-signup grant
-- widened from PULSE alone to the explicit live pair.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  -- Self-signup: access to the platform's live products, then the user's
  -- solo organisation and their admin membership of it.
  INSERT INTO product_access (user_id, product_id, granted_by)
  SELECT NEW.id, p.id, 'self_signup'
  FROM products p
  WHERE p.slug IN ('pulse', 'stack');

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
-- 4b. JOIN_INVITED_USER: the 026 definition, with the acceptance grant
-- widened the same way. The one-organisation guard, the invite's own role,
-- and the seat-preserving no-op are untouched.
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

  INSERT INTO product_access (user_id, product_id, granted_by)
  SELECT p_user_id, p.id, 'admin_invite'
  FROM products p
  WHERE p.slug IN ('pulse', 'stack')
  ON CONFLICT (user_id, product_id) DO NOTHING;

  UPDATE pending_invitations
  SET status = 'consumed',
      invited_user_id = COALESCE(invited_user_id, p_user_id)
  WHERE id = v_invite.id;
END;
$$;

ALTER FUNCTION join_invited_user(UUID, TEXT) OWNER TO postgres;

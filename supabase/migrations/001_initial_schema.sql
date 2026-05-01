-- ========================================================================
-- 001_initial_schema.sql
--
-- Core schema for the Flitrr authenticated application:
--   - profiles               (one row per auth.users entry)
--   - products               (Flitrr products: PULSE, future products)
--   - product_access         (which user has access to which product)
--   - design_partner_submissions (lead capture from design-partner forms)
--
-- Plus two trigger-driven workflows:
--   - on auth.users INSERT  → create profile + grant default access
--   - on auth.users UPDATE  → mirror last_sign_in_at into profiles
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- PROFILES
-- ========================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  role TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- PRODUCTS
-- ========================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('live', 'in_build', 'planned')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO products (slug, name, description, status)
VALUES (
  'pulse',
  'PULSE',
  'Properly set up your projects, then monitor what matters.',
  'in_build'
);

-- ========================================================================
-- PRODUCT_ACCESS
-- ========================================================================
CREATE TABLE product_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  granted_by TEXT NOT NULL CHECK (granted_by IN ('self_signup', 'admin_invite', 'design_partner')),
  UNIQUE (user_id, product_id)
);

-- ========================================================================
-- DESIGN_PARTNER_SUBMISSIONS
-- ========================================================================
CREATE TABLE design_partner_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  portfolio_size TEXT NOT NULL CHECK (portfolio_size IN ('1', '2_to_3', '4_plus')),
  primary_market TEXT NOT NULL CHECK (primary_market IN ('uk', 'nigeria', 'both')),
  source_page TEXT NOT NULL CHECK (source_page IN ('flitrr_com', 'pulse_page')),
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  converted_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ========================================================================
-- HANDLE_NEW_USER  — trigger on auth.users INSERT
--
-- When a new auth user is created, mirror the row into profiles and
-- grant default PULSE access (granted_by='self_signup'). SECURITY
-- DEFINER lets this function bypass RLS for these system writes.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pulse_product_id UUID;
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ========================================================================
-- HANDLE_USER_SIGN_IN  — trigger on auth.users UPDATE
--
-- Mirror auth.users.last_sign_in_at into profiles.last_sign_in_at so
-- application code can read it without crossing into the auth schema.
-- ========================================================================
CREATE OR REPLACE FUNCTION handle_user_sign_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE profiles
    SET last_sign_in_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_sign_in();

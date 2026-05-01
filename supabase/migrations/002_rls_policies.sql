-- ========================================================================
-- 002_rls_policies.sql
--
-- Row Level Security for all four tables. Run after 001_initial_schema.
-- ========================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_partner_submissions ENABLE ROW LEVEL SECURITY;

-- A user can read and update only their own profile row.
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Any authenticated user can read the products catalogue.
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- A user can see only their own product access rows.
CREATE POLICY "Users can view own product access"
  ON product_access FOR SELECT
  USING (auth.uid() = user_id);

-- The design-partner form is public — anonymous and authenticated
-- users can submit. There is intentionally no SELECT policy, so no
-- non-admin user can read submissions.
CREATE POLICY "Anyone can submit design partner form"
  ON design_partner_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

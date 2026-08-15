-- ========================================================================
-- 028_stack_schemes.sql
--
-- STACK back end, sub-step 3.1: the saved scheme store. One new table,
-- stack_schemes, holding a named engine input set per organisation so a
-- developer can save a scheme and load it back. This is the first STACK
-- table and the first table on the platform that is org-scoped directly
-- rather than through a project.
--
-- INPUTS ONLY, NEVER RESULTS. The engine is deterministic: the same inputs
-- always give the same result, so a loaded scheme recomputes rather than
-- reading a stored answer. What is stored is the complete input set (the
-- code form of the workbook's Inputs tab) as JSONB, plus the engine version
-- that computed it when saved (ENGINE_VERSION in lib/stack/engine/index.js),
-- so a recompute under a later engine is distinguishable from the run the
-- developer saved.
--
-- ORG-SCOPED DIRECTLY, NO PROJECT. STACK sits upstream of delivery and its
-- first feature is standalone, so a scheme belongs to the organisation, not
-- to a project. There is deliberately no project_id column. The later
-- attachment to the shared Flitrr project spine adds a nullable project_id
-- additively; nothing here has to be reworked for it.
--
-- RLS IS THE UNIFORM PLATFORM RULE (024): member read, admin write, resolved
-- against organisation_id directly since there is no project to join
-- through. The SECURITY DEFINER helpers from 024
-- (current_user_organisation_id, is_organisation_admin) are reused, not
-- redefined. A BEFORE INSERT trigger tenants a new scheme to the caller's
-- organisation when the insert does not set one, mirroring
-- set_project_organisation_id on projects.
--
-- NAMES ARE NOT UNIQUE. Two schemes in one organisation may share a name
-- (versions of the same deal, saved twice). The list surface orders by
-- updated_at, so the developer always sees the latest first; uniqueness is
-- a UX concern, not an integrity one.
--
-- Idempotent: the table and index use IF NOT EXISTS, the trigger and
-- policies are dropped before create, and ENABLE ROW LEVEL SECURITY is safe
-- to repeat. Apply in the Supabase SQL editor, after 024 (it depends on the
-- helpers and on organisations). Apply to the development database only;
-- production lands at merge through the normal flow.
-- ========================================================================

-- ========================================================================
-- STACK_SCHEMES
--   organisation_id  the owning organisation (the tenant boundary)
--   name             the developer's name for the scheme
--   inputs           the complete engine input set, JSONB
--   engine_version   ENGINE_VERSION at the moment of save
--   created_by       who saved it first (the auth user id), the audit stamp
--   created_at       when it was first saved
--   updated_at       the last-updated stamp, bumped on every save-over
-- ========================================================================
CREATE TABLE IF NOT EXISTS stack_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  engine_version TEXT NOT NULL,
  -- ON DELETE SET NULL keeps a saved scheme intact if the auth user is ever
  -- removed, mirroring recorded_by on programme_milestone_actuals (021).
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A scheme must have a real name: the list surface renders it, and the
  -- save action trims before writing. Guarded here so no client can store a
  -- blank one.
  CONSTRAINT stack_schemes_name_not_blank CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE stack_schemes IS
  'Saved STACK schemes (Bucket 3.1): a named engine input set per organisation. Inputs only, never results; the engine is deterministic, so a loaded scheme recomputes. Org-scoped directly (no project_id); the later spine attachment adds one additively.';
COMMENT ON COLUMN stack_schemes.inputs IS
  'The complete engine input set (the code form of the workbook''s Inputs tab), as passed to computeAppraisal. Stored whole and opaque; the engine, not the database, is the authority on its shape.';
COMMENT ON COLUMN stack_schemes.engine_version IS
  'ENGINE_VERSION (lib/stack/engine/index.js) at the moment of save, so a recompute under a later engine is distinguishable from the run the developer saved.';
COMMENT ON COLUMN stack_schemes.created_by IS
  'Who saved the scheme first (auth user id). The audit stamp; preserved across save-overs.';

-- The list surface reads one organisation's schemes newest first. The leading
-- column also serves the tenant filter, so no separate organisation_id index
-- is needed.
CREATE INDEX IF NOT EXISTS stack_schemes_org_updated_idx
  ON stack_schemes (organisation_id, updated_at DESC);

-- The shared last-updated stamp, maintained by update_updated_at() from 001,
-- the same trigger every mutable table on the platform uses.
DROP TRIGGER IF EXISTS stack_schemes_updated_at ON stack_schemes;
CREATE TRIGGER stack_schemes_updated_at
  BEFORE UPDATE ON stack_schemes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================================================
-- BEFORE INSERT TRIGGER  tenant a new scheme to the caller's organisation
-- when the insert does not set one, mirroring set_project_organisation_id on
-- projects (024). The insert WITH CHECK below runs after this trigger, so it
-- sees the populated organisation_id.
-- ========================================================================
CREATE OR REPLACE FUNCTION set_stack_scheme_organisation_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organisation_id IS NULL THEN
    NEW.organisation_id := current_user_organisation_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stack_schemes_set_organisation_id ON stack_schemes;
CREATE TRIGGER stack_schemes_set_organisation_id
  BEFORE INSERT ON stack_schemes
  FOR EACH ROW
  EXECUTE FUNCTION set_stack_scheme_organisation_id();

-- ========================================================================
-- ROW LEVEL SECURITY  the uniform platform rule from 024: member read,
-- admin write, against organisation_id directly.
-- ========================================================================
ALTER TABLE stack_schemes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organisation members can read stack_schemes" ON stack_schemes;
CREATE POLICY "Organisation members can read stack_schemes"
  ON stack_schemes FOR SELECT
  USING (organisation_id = current_user_organisation_id());

DROP POLICY IF EXISTS "Organisation admins can insert stack_schemes" ON stack_schemes;
CREATE POLICY "Organisation admins can insert stack_schemes"
  ON stack_schemes FOR INSERT
  WITH CHECK (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

DROP POLICY IF EXISTS "Organisation admins can update stack_schemes" ON stack_schemes;
CREATE POLICY "Organisation admins can update stack_schemes"
  ON stack_schemes FOR UPDATE
  USING (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  )
  WITH CHECK (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

DROP POLICY IF EXISTS "Organisation admins can delete stack_schemes" ON stack_schemes;
CREATE POLICY "Organisation admins can delete stack_schemes"
  ON stack_schemes FOR DELETE
  USING (
    is_organisation_admin()
    AND organisation_id = current_user_organisation_id()
  );

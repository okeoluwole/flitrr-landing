-- ========================================================================
-- 039_stack_scheme_project.sql
--
-- The STACK spine attachment. 028 created stack_schemes org-scoped
-- directly and promised: "The later attachment to the shared Flitrr
-- project spine adds a nullable project_id additively; nothing here has
-- to be reworked for it." This is that attachment.
--
-- A scheme MAY name the project it appraises. The link is optional and
-- additive: an unlinked scheme is exactly what every scheme was before
-- this migration, and no read, write, or policy changes for rows that
-- leave it null. The tenant boundary stays organisation_id and the RLS
-- rule stays the uniform 024 member-read admin-write; the project link is
-- context, never a second access path.
--
--   - ON DELETE SET NULL: deleting a project (the draft hard-delete path,
--     037) releases its schemes back to plain organisation schemes rather
--     than destroying the appraisal work.
--   - Same-organisation integrity: a BEFORE trigger refuses a link to
--     another organisation's project. SECURITY DEFINER, because the check
--     must see the project's true organisation even where row level
--     security would hide the row from the caller. It is named to sort
--     after 028's tenant trigger (set_... before validate_...), so on
--     insert it always sees the populated organisation_id.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, and
-- the trigger is dropped before create. Apply after 037 (it references
-- projects as the archive/delete arc left them).
-- ========================================================================

ALTER TABLE stack_schemes
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN stack_schemes.project_id IS
  'The project this scheme appraises, when the developer has linked one. Optional and additive (the 028 spine promise): the tenant boundary stays organisation_id, and deleting the project releases the scheme (SET NULL) rather than destroying it.';

-- The workspace-side read this attachment exists for: "the schemes linked
-- to this project". Partial, because most schemes may never link.
CREATE INDEX IF NOT EXISTS stack_schemes_project_idx
  ON stack_schemes (project_id)
  WHERE project_id IS NOT NULL;

-- ========================================================================
-- SAME-ORGANISATION INTEGRITY  a scheme may only link a project of its own
-- organisation. The FK proves the project exists; this proves it is ours.
-- ========================================================================
CREATE OR REPLACE FUNCTION validate_stack_scheme_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_org UUID;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Trigger ordering makes this unreachable on insert (the 028 tenant
  -- trigger has already filled organisation_id), but a null here would
  -- make the comparison below silently pass, so it fails closed instead.
  IF NEW.organisation_id IS NULL THEN
    RAISE EXCEPTION 'a scheme must belong to an organisation before it can link a project';
  END IF;

  SELECT organisation_id INTO v_project_org
  FROM projects
  WHERE id = NEW.project_id;

  IF v_project_org IS NULL OR v_project_org <> NEW.organisation_id THEN
    RAISE EXCEPTION 'a scheme can only link a project in its own organisation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stack_schemes_validate_project ON stack_schemes;
CREATE TRIGGER stack_schemes_validate_project
  BEFORE INSERT OR UPDATE ON stack_schemes
  FOR EACH ROW
  EXECUTE FUNCTION validate_stack_scheme_project();

-- ============================================================================
-- 034: criticality derived at the point of capture (test note 2).
--
-- Framework principle 3, cascading classification: an item serving or
-- threatening a non-negotiable objective is itself critical, and nothing
-- inherits more protection than the objective it serves. Criticality is
-- therefore derived, never chosen. This migration enforces that rule at the
-- write path for the five capture tables (workstreams, risks, assumptions,
-- constraints, dependencies), and records the basis beside the value so
-- "inherited from [objective]" is a read of stored fact.
--
-- Additive only: new nullable columns, one new trigger function per concern,
-- triggers on existing tables. No existing column is altered or dropped.
-- Locked brief snapshots (project_briefs) are never touched: the triggers
-- reach only the five live capture tables.
--
-- The derivation rule here deliberately mirrors lib/engine/criticality.js
-- (toStoredCriticality / exceedsLinkedObjective). It is the one necessary
-- second expression of the rule, at the write path itself, and is pinned by
-- tests on both sides.
-- ============================================================================

-- The recorded basis: the deriving objective's type and classification at the
-- moment of the write. Null on an unlinked item (nothing conferred the value).
ALTER TABLE project_workstreams
  ADD COLUMN IF NOT EXISTS criticality_basis_type objective_type,
  ADD COLUMN IF NOT EXISTS criticality_basis_classification objective_classification;

ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS criticality_basis_type objective_type,
  ADD COLUMN IF NOT EXISTS criticality_basis_classification objective_classification;

ALTER TABLE project_assumptions
  ADD COLUMN IF NOT EXISTS criticality_basis_type objective_type,
  ADD COLUMN IF NOT EXISTS criticality_basis_classification objective_classification;

ALTER TABLE project_constraints
  ADD COLUMN IF NOT EXISTS criticality_basis_type objective_type,
  ADD COLUMN IF NOT EXISTS criticality_basis_classification objective_classification;

ALTER TABLE project_dependencies
  ADD COLUMN IF NOT EXISTS criticality_basis_type objective_type,
  ADD COLUMN IF NOT EXISTS criticality_basis_classification objective_classification;

-- ----------------------------------------------------------------------------
-- The write-path derivation. BEFORE INSERT OR UPDATE on each capture table:
--   1. Look up the linked objective (if any).
--   2. Reject an explicit attempt to write critical that the link does not
--      carry (an insert, or an update that changes the value): nothing
--      inherits more protection than the objective it serves.
--   3. Stamp the derived criticality and its basis. The derivation is the
--      only writer of the field, so a stale value carried through an
--      unrelated update is silently healed to the derivation rather than
--      rejected.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION derive_capture_criticality()
RETURNS TRIGGER AS $$
DECLARE
  obj_type objective_type;
  obj_classification objective_classification;
  derived criticality_level;
BEGIN
  IF NEW.linked_objective_id IS NOT NULL THEN
    SELECT o.objective_type, o.classification
      INTO obj_type, obj_classification
      FROM project_objectives o
     WHERE o.id = NEW.linked_objective_id;
  END IF;

  IF obj_classification = 'non_negotiable' THEN
    derived := 'critical';
  ELSE
    derived := 'standard';
  END IF;

  IF NEW.criticality = 'critical'
     AND derived <> 'critical'
     AND (TG_OP = 'INSERT' OR NEW.criticality IS DISTINCT FROM OLD.criticality)
  THEN
    RAISE EXCEPTION
      'criticality_exceeds_objective: an item can only be critical when it is linked to a non-negotiable objective';
  END IF;

  NEW.criticality := derived;
  NEW.criticality_basis_type := obj_type;
  NEW.criticality_basis_classification := obj_classification;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_workstreams_derive_criticality ON project_workstreams;
CREATE TRIGGER project_workstreams_derive_criticality
  BEFORE INSERT OR UPDATE ON project_workstreams
  FOR EACH ROW
  EXECUTE FUNCTION derive_capture_criticality();

DROP TRIGGER IF EXISTS project_risks_derive_criticality ON project_risks;
CREATE TRIGGER project_risks_derive_criticality
  BEFORE INSERT OR UPDATE ON project_risks
  FOR EACH ROW
  EXECUTE FUNCTION derive_capture_criticality();

DROP TRIGGER IF EXISTS project_assumptions_derive_criticality ON project_assumptions;
CREATE TRIGGER project_assumptions_derive_criticality
  BEFORE INSERT OR UPDATE ON project_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION derive_capture_criticality();

DROP TRIGGER IF EXISTS project_constraints_derive_criticality ON project_constraints;
CREATE TRIGGER project_constraints_derive_criticality
  BEFORE INSERT OR UPDATE ON project_constraints
  FOR EACH ROW
  EXECUTE FUNCTION derive_capture_criticality();

DROP TRIGGER IF EXISTS project_dependencies_derive_criticality ON project_dependencies;
CREATE TRIGGER project_dependencies_derive_criticality
  BEFORE INSERT OR UPDATE ON project_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION derive_capture_criticality();

-- ----------------------------------------------------------------------------
-- Reclassification before lock. When an objective's classification changes,
-- every dependent capture row recomputes through the same derivation: the
-- touch-update below fires each table's BEFORE UPDATE trigger, so the rule is
-- written once. Locked snapshots are separate records (project_briefs) and
-- are not touched; post-lock the app freezes classification edits, so this
-- fires on the pre-lock draft baseline.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_capture_criticality()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.classification IS DISTINCT FROM OLD.classification THEN
    UPDATE project_workstreams SET linked_objective_id = NEW.id
      WHERE linked_objective_id = NEW.id;
    UPDATE project_risks SET linked_objective_id = NEW.id
      WHERE linked_objective_id = NEW.id;
    UPDATE project_assumptions SET linked_objective_id = NEW.id
      WHERE linked_objective_id = NEW.id;
    UPDATE project_constraints SET linked_objective_id = NEW.id
      WHERE linked_objective_id = NEW.id;
    UPDATE project_dependencies SET linked_objective_id = NEW.id
      WHERE linked_objective_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_objectives_recompute_criticality ON project_objectives;
CREATE TRIGGER project_objectives_recompute_criticality
  AFTER UPDATE OF classification ON project_objectives
  FOR EACH ROW
  EXECUTE FUNCTION recompute_capture_criticality();

COMMENT ON FUNCTION derive_capture_criticality() IS
  'Note 2: criticality is derived from the linked objective at the write path (non-negotiable gives critical, anything else standard), an explicit critical beyond the link is rejected, and the basis is recorded beside the value. Mirrors lib/engine/criticality.js.';
COMMENT ON FUNCTION recompute_capture_criticality() IS
  'Note 2: a pre-lock reclassification recomputes every dependent capture row through the derive trigger. Locked brief snapshots are never touched.';

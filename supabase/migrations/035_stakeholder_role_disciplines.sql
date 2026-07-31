-- 035: the party role disciplines (Note 3).
--
-- Two gaps the end-to-end test found in stakeholder_role. Sales Agent was
-- missing, and on the Nigeria off-plan model the sales agent leads the sales
-- workstream that funds the build. And one flat `consultant` value collapsed
-- the disciplines the Brief's Parties section depends on, so the architect, the
-- quantity surveyor, the engineer and even the sales agent all rendered as
-- "Consultant" in a lender-facing document.
--
-- Additive only. ALTER TYPE ... ADD VALUE cannot remove or rename anything, so
-- every existing row keeps the value it holds and every existing code path that
-- reads one keeps working.
--
-- `consultant` is deliberately NOT removed. Postgres cannot drop an enum value,
-- and rows may hold it. It stays valid and readable; the application retires it
-- from the picker so no new party can take it, and renders it as
-- "Consultant (unspecified)" so an existing row reads as needing reassignment.
-- No row is rewritten by this migration.
--
-- `project_manager` already exists and is not re-added; the application simply
-- shows it among the disciplines it belongs with.
--
-- IF NOT EXISTS makes each addition idempotent, so a re-run is a no-op, matching
-- the guarded enum creation in 015.

ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'sales_agent';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'architect';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'quantity_surveyor';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'structural_engineer';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'services_mep_engineer';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'planning_consultant';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'clerk_of_works';
ALTER TYPE stakeholder_role ADD VALUE IF NOT EXISTS 'other_consultant';

COMMENT ON TYPE stakeholder_role IS
  'The role a party plays (project_stakeholders.role): the principals (developer, funder, sales_agent, contractor), the consultant disciplines (architect, quantity_surveyor, structural_engineer, services_mep_engineer, planning_consultant, project_manager, clerk_of_works, other_consultant), and other. The legacy flat value `consultant` is retired from the picker but stays valid, and renders as "Consultant (unspecified)".';

-- ========================================================================
-- 007_pulse_financials.sql
--
-- Phase A of M3.5: optional headline financial capture on projects, plus
-- the project's reporting currency.
--
-- PULSE records a small set of figures the developer can estimate at
-- initiation and presents them on the brief (step 8). It does not model
-- them: there is no derived debt and equity split, no loan-to-value, no
-- profit calculation. Full financial detail lives elsewhere (a developer's
-- appraisal spreadsheet, a lender's model) and is reached through a link.
--
-- Columns added to projects (the figures are nullable, consistent with the
-- permissive entry everywhere else in the flow):
--   - budget               the total budget the developer has allotted
--   - projected_gdv        projected gross development value
--   - projected_roi        projected return on investment, as a percentage
--   - financial_detail_url an optional link to the full appraisal
--   - currency             the project's reporting currency (GBP, NGN, USD)
--
-- currency uses a native enum and is NOT NULL with a GBP default, matching
-- the fixed-domain enum house style of 004 and reflecting the framework's
-- geography tailoring (the UK and Nigeria are first-class; USD is a common
-- third). The brief formats every money figure with this currency's symbol.
--
-- No new tables, no new RLS (these are columns on projects, already
-- protected by the policies in 005), no trigger changes.
-- ========================================================================

-- Reporting currency for a project (projects.currency). Add a value to the
-- enum to support another currency later.
CREATE TYPE project_currency AS ENUM (
  'GBP',
  'NGN',
  'USD'
);

ALTER TABLE projects
  ADD COLUMN budget               NUMERIC,
  ADD COLUMN projected_gdv        NUMERIC,
  ADD COLUMN projected_roi        NUMERIC,
  ADD COLUMN financial_detail_url TEXT,
  ADD COLUMN currency             project_currency NOT NULL DEFAULT 'GBP';

-- Document the conventions a reader cannot infer from the type alone: ROI is
-- stored as a percentage (28 means 28%), and the money figures are
-- denominated in the project's currency column.
COMMENT ON COLUMN projects.budget IS
  'Total budget the developer has allotted (a decision, not an estimate), denominated in projects.currency.';
COMMENT ON COLUMN projects.projected_gdv IS
  'Projected gross development value, denominated in projects.currency. Headline estimate only; not modelled.';
COMMENT ON COLUMN projects.projected_roi IS
  'Projected return on investment, stored as a percentage. 28 means 28 percent.';
COMMENT ON COLUMN projects.financial_detail_url IS
  'Optional link to the developer''s full financial appraisal, wherever they keep it.';
COMMENT ON COLUMN projects.currency IS
  'Reporting currency for the project''s money figures. GBP, NGN or USD; defaults to GBP.';

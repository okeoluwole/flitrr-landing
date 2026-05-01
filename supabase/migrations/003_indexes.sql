-- ========================================================================
-- 003_indexes.sql
--
-- Performance indexes. Run after 001 and 002.
-- ========================================================================

CREATE INDEX idx_product_access_user_id ON product_access(user_id);
CREATE INDEX idx_product_access_product_id ON product_access(product_id);

CREATE INDEX idx_design_partner_submissions_email ON design_partner_submissions(email);
CREATE INDEX idx_design_partner_submissions_submitted_at ON design_partner_submissions(submitted_at DESC);

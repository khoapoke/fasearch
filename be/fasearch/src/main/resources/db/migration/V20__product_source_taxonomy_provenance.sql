-- R5 additive provenance for the deterministic taxonomy repair (candidate DB only).
-- Raw first-party product_type / tags per sourced row; the repair manifest maps them
-- to canonical categories. No existing column is altered.
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_product_type VARCHAR(200);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_tags TEXT;
COMMENT ON COLUMN san_pham.source_product_type IS 'Raw first-party feed product_type (provenance for category mapping)';
COMMENT ON COLUMN san_pham.source_tags IS 'Raw first-party feed tags payload (provenance only, never a category signal)';

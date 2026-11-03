-- Source attribution and provenance snapshots for the AI catalog candidate.
-- Additive only: no existing column, row or identifier is changed or removed.
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_host VARCHAR(150);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_product_id VARCHAR(100);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_payload_sha256 VARCHAR(64);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_fetched_at TIMESTAMP;
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_price NUMERIC(15,2);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_currency VARCHAR(10);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS source_brand VARCHAR(150);
-- curation_class documents why a row is or is not publicly visible; never deletes history.
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS curation_class VARCHAR(30);

ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS source_variant_id VARCHAR(100);
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS source_sku VARCHAR(100);
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS source_price NUMERIC(15,2);
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS source_available BOOLEAN;

-- Stable identity is (source host, source product/variant id); rows without a source stay NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_san_pham_source_identity
    ON san_pham(source_host, source_product_id)
    WHERE source_host IS NOT NULL AND source_product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bien_the_source_identity
    ON bien_the_sp(source_variant_id)
    WHERE source_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_san_pham_curation_class ON san_pham(curation_class);

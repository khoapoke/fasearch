CREATE TABLE catalog_products (
    id UUID PRIMARY KEY,
    product_group_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES user_accounts(id),
    active_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

CREATE TABLE product_versions (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES catalog_products(id),
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('DRAFT', 'PROCESSING', 'NEEDS_REVIEW', 'INDEXED', 'ACTIVE', 'FAILED', 'ARCHIVED')),
    title VARCHAR(250) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('TOP', 'BOTTOM', 'ONE_PIECE')),
    changed_by UUID NOT NULL REFERENCES user_accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, version_no),
    UNIQUE (product_id, id)
);

ALTER TABLE catalog_products
    ADD CONSTRAINT active_version_same_product_fk
    FOREIGN KEY (id, active_version_id)
    REFERENCES product_versions(product_id, id);

CREATE INDEX product_versions_product_latest_ix ON product_versions (product_id, version_no DESC);

CREATE TABLE product_images (
    id UUID PRIMARY KEY,
    product_version_id UUID NOT NULL REFERENCES product_versions(id),
    storage_uri TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX product_images_one_primary_ix
    ON product_images (product_version_id) WHERE is_primary;

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES user_accounts(id),
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id UUID NOT NULL,
    previous_version_id UUID,
    new_version_id UUID,
    trace_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_events_resource_ix ON audit_events (resource_type, resource_id, created_at DESC);

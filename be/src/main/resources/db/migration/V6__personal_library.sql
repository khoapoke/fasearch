CREATE TABLE saved_products (
    account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL
        CHECK (product_id ~ '^[A-Za-z0-9_.-]{1,128}$'),
    product_version_id TEXT NOT NULL
        CHECK (product_version_id ~ '^[A-Za-z0-9_.-]{1,128}$'),
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, product_id)
);
CREATE INDEX saved_products_owner_order_ix
    ON saved_products (account_id, saved_at DESC, product_id ASC);

CREATE TABLE library_preferences (
    account_id UUID PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE,
    record_history BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE search_history (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('IMAGE', 'TEXT', 'COMPOSED')),
    query_text TEXT NULL CHECK (query_text IS NULL OR char_length(query_text) <= 1024),
    result_count INTEGER NOT NULL CHECK (result_count >= 0),
    catalog_snapshot_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    index_version TEXT NOT NULL,
    result_refs JSONB NOT NULL DEFAULT '[]',
    trace_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, trace_id)
);
CREATE INDEX search_history_owner_order_ix
    ON search_history (account_id, created_at DESC, id DESC);

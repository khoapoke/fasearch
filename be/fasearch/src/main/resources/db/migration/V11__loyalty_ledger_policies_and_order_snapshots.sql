ALTER TABLE khach_hang
    ADD COLUMN diem_giu_cho INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN sales_history_complete BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT ck_customer_diem_giu_cho CHECK (diem_giu_cho >= 0);

ALTER TABLE hang_thanh_vien
    ADD COLUMN nguong_doanh_so DECIMAL(19, 2),
    ADD COLUMN phien_ban_doanh_so BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_hang_sales_threshold CHECK (nguong_doanh_so IS NULL OR nguong_doanh_so >= 0),
    ADD CONSTRAINT ck_hang_sales_version CHECK (phien_ban_doanh_so >= 0);
CREATE UNIQUE INDEX uq_hang_sales_threshold
    ON hang_thanh_vien (nguong_doanh_so) WHERE nguong_doanh_so IS NOT NULL AND da_xoa = FALSE;

CREATE TABLE loyalty_policy (
    policy_id BIGSERIAL PRIMARY KEY,
    current_version BIGINT NOT NULL DEFAULT 1 CHECK (current_version > 0),
    status VARCHAR(10) NOT NULL DEFAULT 'DISABLED' CHECK (status IN ('ENABLED', 'DISABLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_loyalty_one_enabled_policy ON loyalty_policy ((1)) WHERE status = 'ENABLED';

CREATE TABLE loyalty_policy_version (
    version_id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT NOT NULL REFERENCES loyalty_policy(policy_id) ON DELETE RESTRICT,
    version BIGINT NOT NULL CHECK (version > 0),
    earn_currency_per_point DECIMAL(19, 2) NOT NULL CHECK (earn_currency_per_point > 0),
    redeem_currency_per_point DECIMAL(19, 2) NOT NULL CHECK (redeem_currency_per_point > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loyalty_policy_version UNIQUE (policy_id, version)
);

CREATE TABLE loyalty_ledger_entry (
    entry_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES khach_hang(ma_kh) ON DELETE RESTRICT,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('OPENING', 'HOLD', 'RELEASE', 'REDEEM', 'EARN')),
    points INTEGER NOT NULL CHECK (points >= 0 AND (entry_type = 'OPENING' OR points > 0)),
    order_id BIGINT REFERENCES don_hang(ma_don_hang) ON DELETE RESTRICT,
    source_key VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loyalty_customer_source UNIQUE (customer_id, source_key)
);
CREATE INDEX ix_loyalty_customer_history ON loyalty_ledger_entry (customer_id, occurred_at DESC, entry_id DESC);
CREATE INDEX ix_loyalty_order_entries ON loyalty_ledger_entry (order_id, entry_type);
CREATE UNIQUE INDEX uq_loyalty_opening_once ON loyalty_ledger_entry (customer_id) WHERE entry_type = 'OPENING';
CREATE FUNCTION reject_loyalty_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'loyalty ledger is append-only';
END;
$$;
CREATE TRIGGER trg_loyalty_ledger_append_only
    BEFORE UPDATE OR DELETE ON loyalty_ledger_entry
    FOR EACH ROW EXECUTE FUNCTION reject_loyalty_ledger_mutation();

CREATE TABLE loyalty_order_hold (
    order_id BIGINT PRIMARY KEY REFERENCES don_hang(ma_don_hang) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES khach_hang(ma_kh) ON DELETE RESTRICT,
    points INTEGER NOT NULL CHECK (points > 0),
    status VARCHAR(10) NOT NULL CHECK (status IN ('HELD', 'RELEASED', 'CONSUMED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_loyalty_hold_customer_status ON loyalty_order_hold (customer_id, status);

ALTER TABLE don_hang
    ADD COLUMN redeemed_points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN points_discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN loyalty_policy_id BIGINT,
    ADD COLUMN loyalty_policy_version BIGINT,
    ADD COLUMN redeem_currency_per_point_snapshot DECIMAL(19, 2),
    ADD COLUMN earned_points INTEGER,
    ADD COLUMN loyalty_quote_fingerprint VARCHAR(64),
    ADD CONSTRAINT ck_order_redeemed_points CHECK (redeemed_points >= 0),
    ADD CONSTRAINT ck_order_points_discount CHECK (points_discount >= 0),
    ADD CONSTRAINT ck_order_earned_points CHECK (earned_points IS NULL OR earned_points >= 0),
    ADD CONSTRAINT ck_order_policy_snapshot CHECK (
        (loyalty_policy_id IS NULL AND loyalty_policy_version IS NULL AND redeem_currency_per_point_snapshot IS NULL)
        OR (loyalty_policy_id IS NOT NULL AND loyalty_policy_version IS NOT NULL AND redeem_currency_per_point_snapshot > 0)
    ),
    ADD CONSTRAINT fk_order_loyalty_policy_version FOREIGN KEY (loyalty_policy_id, loyalty_policy_version)
        REFERENCES loyalty_policy_version(policy_id, version) ON DELETE RESTRICT;

ALTER TABLE ct_don_hang
    ADD COLUMN points_discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_order_line_points_discount CHECK (points_discount_amount >= 0);

ALTER TABLE hoa_don
    ADD COLUMN payment_method_code VARCHAR(30);

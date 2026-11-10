-- Completion is captured from this migration onwards. Historic completion times are unknown;
-- do not invent a new seven-day window for old orders.
ALTER TABLE don_hang ADD COLUMN completed_at TIMESTAMP;
CREATE FUNCTION capture_order_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trang_thai = 'COMPLETED' AND OLD.trang_thai IS DISTINCT FROM 'COMPLETED' THEN
    NEW.completed_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_order_completion BEFORE UPDATE ON don_hang
FOR EACH ROW EXECUTE FUNCTION capture_order_completion();

CREATE TABLE order_return (
 id BIGSERIAL PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES don_hang(ma_don_hang),
 request_key UUID NOT NULL UNIQUE,
 fingerprint VARCHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','RECEIVED','REFUNDED')),
 reason VARCHAR(30) NOT NULL CHECK (reason IN ('WRONG_SIZE','DEFECTIVE','NOT_AS_DESCRIBED','CHANGE_MIND','OTHER')),
 note VARCHAR(1000), rejection_reason VARCHAR(1000),
 merchandise_amount NUMERIC(15,2) NOT NULL CHECK (merchandise_amount >= 0),
 shipping_amount NUMERIC(15,2) NOT NULL CHECK (shipping_amount >= 0),
 refund_amount NUMERIC(15,2) NOT NULL CHECK (refund_amount >= 0),
 earned_reverse INTEGER NOT NULL DEFAULT 0 CHECK (earned_reverse >= 0),
 redeemed_return INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_return >= 0),
 points_shortfall INTEGER NOT NULL DEFAULT 0 CHECK (points_shortfall >= 0),
 refund_id VARCHAR(255) UNIQUE, refund_actor VARCHAR(100), refund_note VARCHAR(1000),
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, refunded_at TIMESTAMP,
 CHECK (refund_amount = merchandise_amount + shipping_amount)
);
CREATE UNIQUE INDEX uq_return_open_order ON order_return(order_id) WHERE status IN ('PENDING','APPROVED','RECEIVED');
CREATE INDEX idx_return_status_created ON order_return(status,created_at DESC);
CREATE TABLE order_return_line (
 return_id BIGINT NOT NULL REFERENCES order_return(id), sku_id BIGINT NOT NULL REFERENCES bien_the_sp(ma_sku),
 product_name TEXT NOT NULL, variant_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 gross_amount NUMERIC(15,2) NOT NULL, voucher_discount NUMERIC(15,2) NOT NULL,
 points_discount NUMERIC(15,2) NOT NULL, refund_amount NUMERIC(15,2) NOT NULL CHECK (refund_amount >= 0),
 restock_quantity INTEGER CHECK (restock_quantity >= 0 AND restock_quantity <= quantity),
 PRIMARY KEY(return_id,sku_id)
);
CREATE TABLE order_return_photo (
 return_id BIGINT NOT NULL REFERENCES order_return(id), position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
 content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image/png','image/jpeg')), image BYTEA NOT NULL,
 PRIMARY KEY(return_id,position), CHECK (octet_length(image) <= 5242880)
);
CREATE TABLE order_return_history (
 id BIGSERIAL PRIMARY KEY, return_id BIGINT NOT NULL REFERENCES order_return(id),
 status VARCHAR(20) NOT NULL, actor VARCHAR(100) NOT NULL, note VARCHAR(1000),
 occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE loyalty_ledger_entry ALTER COLUMN entry_type TYPE VARCHAR(20);
ALTER TABLE loyalty_ledger_entry DROP CONSTRAINT ck_loyalty_entry_type, DROP CONSTRAINT ck_loyalty_entry_points;
ALTER TABLE loyalty_ledger_entry ADD CONSTRAINT ck_loyalty_entry_type
 CHECK (entry_type IN ('OPENING','HOLD','RELEASE','REDEEM','EARN','ADJUST','RETURN_REVERSE','RETURN_REDEEM')),
 ADD CONSTRAINT ck_loyalty_entry_points CHECK (
 (entry_type='ADJUST' AND points<>0) OR (entry_type IN ('OPENING','RETURN_REVERSE') AND points>=0)
 OR (entry_type NOT IN ('ADJUST','OPENING','RETURN_REVERSE') AND points>0));
-- The append-only trigger is deliberately unchanged. Shortfalls live on order_return.
INSERT INTO quyen_vai_tro(ma_vai_tro,ma_quyen)
 SELECT ma_vai_tro,q.code FROM vai_tro CROSS JOIN (VALUES ('RETURN_VIEW'),('RETURN_PROCESS')) q(code)
 WHERE ten_vai_tro='STAFF' ON CONFLICT DO NOTHING;

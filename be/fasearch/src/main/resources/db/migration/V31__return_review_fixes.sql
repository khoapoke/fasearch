-- V28 is already applied. All R1 review changes are additive here.
ALTER TABLE order_return DROP CONSTRAINT order_return_status_check;
ALTER TABLE order_return ADD CONSTRAINT order_return_status_check
 CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','RECEIVED','REFUNDED'));
ALTER TABLE order_return ADD COLUMN cancel_reason VARCHAR(1000);
CREATE INDEX idx_return_order_status ON order_return(order_id,status);
CREATE INDEX idx_return_created_id ON order_return(created_at DESC,id DESC);
CREATE INDEX idx_return_history_return ON order_return_history(return_id,id);
CREATE INDEX idx_return_line_sku ON order_return_line(sku_id,return_id);
CREATE TABLE order_return_refund_attempt (
 return_id BIGINT NOT NULL REFERENCES order_return(id),
 attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
 refund_id VARCHAR(255), status VARCHAR(30) NOT NULL,
 idempotency_key VARCHAR(255) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(return_id,attempt_number)
);

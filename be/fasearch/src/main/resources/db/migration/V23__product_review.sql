-- V23: danh gia san pham (product_review). Additive: chi tao bang + index moi.
--
-- QUY TAC: moi tai khoan chi co MOT danh gia dang hoat dong cho moi san pham
-- (unique (product_id, account_id) khi da_xoa = false, nen sau khi xoa mem van viet lai duoc).
-- verified_purchase = TRUE khi luc viet tai khoan co don COMPLETED chua san pham do.
-- hidden = TRUE khi ADMIN/Quan ly an danh gia (khong hien o danh sach cong khai).
CREATE TABLE IF NOT EXISTS product_review (
    review_id         BIGSERIAL PRIMARY KEY,
    product_id        BIGINT      NOT NULL REFERENCES san_pham(ma_sp),
    account_id        BIGINT      NOT NULL REFERENCES tai_khoan(ma_tk),
    rating            INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title             VARCHAR(120),
    body              VARCHAR(2000),
    size_fit          VARCHAR(10) CHECK (size_fit IN ('NHO', 'VUA', 'RONG')),
    verified_purchase BOOLEAN     NOT NULL DEFAULT FALSE,
    hidden            BOOLEAN     NOT NULL DEFAULT FALSE,
    hidden_reason     VARCHAR(255),
    hidden_by         BIGINT REFERENCES tai_khoan(ma_tk),
    created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    da_xoa            BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_review_product_account
    ON product_review(product_id, account_id) WHERE da_xoa = FALSE;

CREATE INDEX IF NOT EXISTS ix_product_review_product_visible
    ON product_review(product_id, created_at DESC) WHERE da_xoa = FALSE AND hidden = FALSE;

CREATE INDEX IF NOT EXISTS ix_product_review_account
    ON product_review(account_id);

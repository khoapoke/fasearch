-- V22: one-time email tokens (password reset + email verification) + verified flag.
--
-- QUY TAC (state the rule): moi tai khoan da ton tai truoc V22 duoc coi nhu DA
-- XAC THUC email (backfill ngay_xac_thuc_email = ngay_tao) de khong khoa bat ky
-- ai ra khoi he thong. Chi tai khoan tao MOI sau V22 co ngay_xac_thuc_email NULL
-- (chua xac thuc) cho den khi hoan tat xac thuc qua email.
-- Login KHONG chan tai khoan chua xac thuc (round nay chi hien banner), co the
-- bat chan bang cau hinh EMAIL_VERIFICATION_REQUIRED=true.

ALTER TABLE tai_khoan
    ADD COLUMN IF NOT EXISTS ngay_xac_thuc_email TIMESTAMP NULL;

UPDATE tai_khoan
SET ngay_xac_thuc_email = ngay_tao
WHERE ngay_xac_thuc_email IS NULL;

CREATE TABLE IF NOT EXISTS email_token (
    ma_token BIGSERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    muc_dich VARCHAR(20) NOT NULL,
    ma_tk BIGINT NOT NULL REFERENCES tai_khoan(ma_tk),
    email VARCHAR(100),
    het_han TIMESTAMP NOT NULL,
    da_dung TIMESTAMP NULL,
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_yeu_cau VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS ix_email_token_account
    ON email_token(ma_tk, muc_dich);

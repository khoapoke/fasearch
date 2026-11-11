ALTER TABLE khuyen_mai
    ALTER COLUMN trang_thai SET DEFAULT 'TAM_DUNG',
    ADD COLUMN IF NOT EXISTS phien_ban BIGINT NOT NULL DEFAULT 0;
UPDATE khuyen_mai SET trang_thai = 'HOAT_DONG' WHERE trang_thai = 'ACTIVE';
UPDATE khuyen_mai SET trang_thai = 'TAM_DUNG' WHERE trang_thai IS NULL OR trang_thai NOT IN ('HOAT_DONG', 'TAM_DUNG');
ALTER TABLE khuyen_mai ALTER COLUMN trang_thai SET NOT NULL;

ALTER TABLE ma_giam_gia
    ADD COLUMN IF NOT EXISTS so_luong_giu_cho INT NOT NULL DEFAULT 0;
UPDATE ma_giam_gia SET ma_code = upper(btrim(ma_code));
CREATE UNIQUE INDEX IF NOT EXISTS ux_ma_giam_gia_code_upper ON ma_giam_gia (upper(ma_code));

CREATE TABLE khuyen_mai_san_pham (
    ma_km BIGINT NOT NULL REFERENCES khuyen_mai(ma_km) ON DELETE CASCADE,
    ma_sp BIGINT NOT NULL REFERENCES san_pham(ma_sp),
    PRIMARY KEY (ma_km, ma_sp)
);

ALTER TABLE ct_don_hang
    ADD COLUMN IF NOT EXISTS tien_giam DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE don_hang
    ADD COLUMN IF NOT EXISTS ma_code_voucher VARCHAR(50),
    ADD COLUMN IF NOT EXISTS ten_ctkm_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phien_ban_km BIGINT,
    ADD COLUMN IF NOT EXISTS loai_giam_snapshot VARCHAR(50),
    ADD COLUMN IF NOT EXISTS gia_tri_giam_snapshot DECIMAL(15, 2);

CREATE TABLE su_dung_voucher (
    ma_don_hang BIGINT PRIMARY KEY REFERENCES don_hang(ma_don_hang) ON DELETE RESTRICT,
    ma_voucher BIGINT NOT NULL REFERENCES ma_giam_gia(ma_voucher) ON DELETE RESTRICT,
    tien_giam DECIMAL(15, 2) NOT NULL CHECK (tien_giam >= 0),
    trang_thai VARCHAR(20) NOT NULL CHECK (trang_thai IN ('HELD', 'CONSUMED', 'RELEASED')),
    ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat TIMESTAMP
);
CREATE INDEX ix_su_dung_voucher_code_status ON su_dung_voucher(ma_voucher, trang_thai);

CREATE TABLE checkout_idempotency (
    ma_kh BIGINT NOT NULL REFERENCES khach_hang(ma_kh) ON DELETE RESTRICT,
    checkout_key VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    ma_don_hang BIGINT NOT NULL UNIQUE REFERENCES don_hang(ma_don_hang) ON DELETE RESTRICT,
    ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ma_kh, checkout_key)
);

-- STT6 P1: server-persisted search history and account favorites.
-- Additive only; no changes to existing tables. Reversible: drop the two new tables.

CREATE TABLE lich_su_tim_kiem (
    ma_ls BIGSERIAL PRIMARY KEY,
    ma_tk BIGINT NOT NULL REFERENCES tai_khoan(ma_tk) ON DELETE RESTRICT,
    che_do VARCHAR(20) NOT NULL CHECK (che_do IN ('TEXT', 'IMAGE', 'MULTIMODAL')),
    truy_van VARCHAR(500),
    so_ket_qua INTEGER NOT NULL DEFAULT 0 CHECK (so_ket_qua >= 0),
    refs_ket_qua JSONB,
    trang_thai VARCHAR(20) NOT NULL CHECK (trang_thai IN ('SUCCESS', 'FAILED', 'CANCELLED')),
    thoi_gian TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_lich_su_tim_kiem_tk_thoi_gian
    ON lich_su_tim_kiem (ma_tk, thoi_gian DESC) WHERE da_xoa = FALSE;

CREATE TABLE yeu_thich (
    ma_yt BIGSERIAL PRIMARY KEY,
    ma_tk BIGINT NOT NULL REFERENCES tai_khoan(ma_tk) ON DELETE RESTRICT,
    ma_sp BIGINT NOT NULL REFERENCES san_pham(ma_sp) ON DELETE RESTRICT,
    ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_yeu_thich_tk_sp UNIQUE (ma_tk, ma_sp)
);

CREATE INDEX idx_yeu_thich_tk_ngay_tao
    ON yeu_thich (ma_tk, ngay_tao DESC) WHERE da_xoa = FALSE;
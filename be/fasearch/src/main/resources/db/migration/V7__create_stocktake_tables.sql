-- 1. Bảng phiếu kiểm kê kho
CREATE TABLE IF NOT EXISTS phieu_kiem_ke (
    ma_phieu_kiem_ke BIGSERIAL PRIMARY KEY,
    ma_phieu VARCHAR(50) NOT NULL UNIQUE,
    ghi_chu TEXT,
    tong_so_lech INT NOT NULL DEFAULT 0,
    trang_thai VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL',
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Bảng chi tiết phiếu kiểm kê (ghi nhận số lượng đếm thực tế và chênh lệch)
CREATE TABLE IF NOT EXISTS ct_phieu_kiem_ke (
    ma_ct_kiem_ke BIGSERIAL PRIMARY KEY,
    ma_phieu_kiem_ke BIGINT NOT NULL REFERENCES phieu_kiem_ke(ma_phieu_kiem_ke),
    ma_sku BIGINT NOT NULL REFERENCES bien_the_sp(ma_sku),
    so_luong_he_thong INT NOT NULL DEFAULT 0,
    so_luong_thuc_te INT NOT NULL DEFAULT 0,
    chenh_lech INT NOT NULL DEFAULT 0,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- Chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_phieu_kiem_ke_ma ON phieu_kiem_ke(ma_phieu);
CREATE INDEX IF NOT EXISTS idx_ct_phieu_kiem_ke_phieu ON ct_phieu_kiem_ke(ma_phieu_kiem_ke);
CREATE INDEX IF NOT EXISTS idx_ct_phieu_kiem_ke_sku ON ct_phieu_kiem_ke(ma_sku);

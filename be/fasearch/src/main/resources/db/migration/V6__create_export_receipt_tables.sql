-- 1. Bảng phiếu xuất kho (xuất hủy hàng lỗi, điều chuyển kho, xuất khác)
CREATE TABLE IF NOT EXISTS phieu_xuat_kho (
    ma_phieu_xuat BIGSERIAL PRIMARY KEY,
    ma_phieu VARCHAR(50) NOT NULL UNIQUE,
    loai_xuat VARCHAR(50) NOT NULL,
    ghi_chu TEXT,
    tong_so_luong INT NOT NULL DEFAULT 0,
    trang_thai VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Bảng chi tiết phiếu xuất kho
CREATE TABLE IF NOT EXISTS ct_phieu_xuat (
    ma_ct_xuat BIGSERIAL PRIMARY KEY,
    ma_phieu_xuat BIGINT NOT NULL REFERENCES phieu_xuat_kho(ma_phieu_xuat),
    ma_sku BIGINT NOT NULL REFERENCES bien_the_sp(ma_sku),
    so_luong INT NOT NULL,
    ly_do VARCHAR(255),
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- Chỉ mục hỗ trợ truy vấn hiệu năng cao
CREATE INDEX IF NOT EXISTS idx_phieu_xuat_ma ON phieu_xuat_kho(ma_phieu);
CREATE INDEX IF NOT EXISTS idx_ct_phieu_xuat_phieu ON ct_phieu_xuat(ma_phieu_xuat);
CREATE INDEX IF NOT EXISTS idx_ct_phieu_xuat_sku ON ct_phieu_xuat(ma_sku);

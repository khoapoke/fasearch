-- 1. Bảng tồn kho theo từng biến thể sản phẩm (SKU)
CREATE TABLE IF NOT EXISTS ton_kho (
    ma_ton_kho BIGSERIAL PRIMARY KEY,
    ma_sku BIGINT NOT NULL UNIQUE REFERENCES bien_the_sp(ma_sku),
    so_luong_vat_ly INT NOT NULL DEFAULT 0,
    so_luong_tam_giu INT NOT NULL DEFAULT 0,
    so_luong_kha_dung INT NOT NULL DEFAULT 0,
    nguong_toi_thieu INT NOT NULL DEFAULT 10,
    ngay_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Bảng phiếu nhập kho từ nhà cung cấp
CREATE TABLE IF NOT EXISTS phieu_nhap_kho (
    ma_phieu_nhap BIGSERIAL PRIMARY KEY,
    ma_phieu VARCHAR(50) NOT NULL UNIQUE,
    nha_cung_cap VARCHAR(255),
    ghi_chu TEXT,
    tong_so_luong INT NOT NULL DEFAULT 0,
    tong_tien DECIMAL(15, 2) NOT NULL DEFAULT 0,
    trang_thai VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. Bảng chi tiết phiếu nhập kho
CREATE TABLE IF NOT EXISTS ct_phieu_nhap (
    ma_ct_nhap BIGSERIAL PRIMARY KEY,
    ma_phieu_nhap BIGINT NOT NULL REFERENCES phieu_nhap_kho(ma_phieu_nhap),
    ma_sku BIGINT NOT NULL REFERENCES bien_the_sp(ma_sku),
    so_luong INT NOT NULL,
    gia_nhap DECIMAL(15, 2) NOT NULL,
    thanh_tien DECIMAL(15, 2) NOT NULL,
    da_xoa BOOLEAN NOT NULL DEFAULT FALSE
);

-- Chỉ mục hỗ trợ truy vấn hiệu năng cao
CREATE INDEX IF NOT EXISTS idx_ton_kho_sku ON ton_kho(ma_sku);
CREATE INDEX IF NOT EXISTS idx_phieu_nhap_ma ON phieu_nhap_kho(ma_phieu);
CREATE INDEX IF NOT EXISTS idx_ct_phieu_nhap_phieu ON ct_phieu_nhap(ma_phieu_nhap);

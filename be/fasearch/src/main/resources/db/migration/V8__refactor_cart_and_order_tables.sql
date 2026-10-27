-- 1. Bổ sung giá phụ thu cho biến thể sản phẩm (phục vụ biến thể size ngoại cỡ, màu đặc biệt)
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS gia_phu_thu DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

-- 2. Tái cấu trúc bảng mặt hàng giỏ: liên kết SKU, khóa chính phức hợp (ma_gio_hang, ma_sku)
DROP TABLE IF EXISTS mat_hang_gio;
CREATE TABLE mat_hang_gio (
    ma_gio_hang BIGINT NOT NULL REFERENCES gio_hang(ma_gio_hang) ON DELETE CASCADE,
    ma_sku BIGINT NOT NULL REFERENCES bien_the_sp(ma_sku),
    so_luong INT NOT NULL DEFAULT 1,
    ngay_them_sp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ma_gio_hang, ma_sku)
);
CREATE INDEX IF NOT EXISTS idx_mat_hang_gio_sku ON mat_hang_gio(ma_sku);

-- Khôi phục dữ liệu mẫu giỏ hàng khớp với SKU ID 1
INSERT INTO mat_hang_gio (ma_gio_hang, ma_sku, so_luong) VALUES (1, 1, 2) ON CONFLICT DO NOTHING;

-- 3. Bổ sung các trường tra cứu và lưu vết cho bảng don_hang
ALTER TABLE don_hang ADD COLUMN IF NOT EXISTS ma_don VARCHAR(50) UNIQUE;
ALTER TABLE don_hang ADD COLUMN IF NOT EXISTS ghi_chu TEXT;
ALTER TABLE don_hang ADD COLUMN IF NOT EXISTS tien_giam DECIMAL(15, 2) DEFAULT 0.00;
CREATE INDEX IF NOT EXISTS idx_don_hang_ma_don ON don_hang(ma_don);

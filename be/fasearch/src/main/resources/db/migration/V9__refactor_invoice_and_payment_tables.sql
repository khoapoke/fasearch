-- =============================================================================
-- V9: BỔ SUNG CỘT CHO BẢNG HOA_DON, THANH_TOAN VÀ CHUẨN HÓA DỮ LIỆU PHƯƠNG THỨC THANH TOÁN
-- =============================================================================

-- 1. Bổ sung các cột tra cứu và quản lý cho bảng hoa_don
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS ma_hd VARCHAR(50) UNIQUE;
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS ma_nv BIGINT REFERENCES nhan_vien(ma_nv);
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS tien_khach_dua DECIMAL(15, 2);
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS tien_thua DECIMAL(15, 2) DEFAULT 0.00;
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS ghi_chu TEXT;

-- Mở rộng thue_vat lên DECIMAL(15, 2) để lưu trữ giá trị tiền thuế
ALTER TABLE hoa_don ALTER COLUMN thue_vat TYPE DECIMAL(15, 2);

CREATE INDEX IF NOT EXISTS idx_hoa_don_ma_hd ON hoa_don(ma_hd);
CREATE INDEX IF NOT EXISTS idx_hoa_don_ma_don_hang ON hoa_don(ma_don_hang);

-- 2. Bổ sung các cột quản lý cho bảng thanh_toan
ALTER TABLE thanh_toan ADD COLUMN IF NOT EXISTS ma_giao_dich VARCHAR(100);
ALTER TABLE thanh_toan ADD COLUMN IF NOT EXISTS ghi_chu TEXT;
ALTER TABLE thanh_toan ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_thanh_toan_ma_hoa_don ON thanh_toan(ma_hoa_don);

-- 3. Chuẩn hóa và seed 4 phương thức thanh toán chuẩn
INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu, da_xoa)
SELECT 'Tiền mặt tại quầy', 'CASH', 'ACTIVE', 'Thanh toán tiền mặt trực tiếp tại quầy hoặc COD', FALSE
WHERE NOT EXISTS (SELECT 1 FROM phuong_thuc_thanh_toan WHERE loai_phuong_thuc_tt = 'CASH');

INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu, da_xoa)
SELECT 'Chuyển khoản qua số tài khoản ngân hàng', 'BANK_TRANSFER', 'ACTIVE', 'Chuyển khoản ngân hàng trực tiếp 24/7', FALSE
WHERE NOT EXISTS (SELECT 1 FROM phuong_thuc_thanh_toan WHERE loai_phuong_thuc_tt = 'BANK_TRANSFER');

INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu, da_xoa)
SELECT 'Thanh toán quét mã VNPAY QR', 'VNPAY_QR', 'ACTIVE', 'Cổng thanh toán điện tử VNPay QR', FALSE
WHERE NOT EXISTS (SELECT 1 FROM phuong_thuc_thanh_toan WHERE loai_phuong_thuc_tt = 'VNPAY_QR');

INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu, da_xoa)
SELECT 'Ví điện tử MoMo', 'MOMO', 'ACTIVE', 'Cổng thanh toán qua ví MoMo', FALSE
WHERE NOT EXISTS (SELECT 1 FROM phuong_thuc_thanh_toan WHERE loai_phuong_thuc_tt = 'MOMO');

-- Đảm bảo trạng thái luôn là ACTIVE
UPDATE phuong_thuc_thanh_toan SET trang_thai = 'ACTIVE' WHERE trang_thai = 'HOAT_DONG' OR trang_thai IS NULL;

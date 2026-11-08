-- =============================================================================
-- V24: GHI NHẬN NGƯỜI / THỜI ĐIỂM / LÝ DO XÓA MỀM (THÙNG RÁC + KHÔI PHỤC)
-- =============================================================================
-- Chỉ thêm cột NULL vào bảng hiện có: không đặt NOT NULL cho cột cũ, không ghi
-- lại dữ liệu, không đổi kiểu cột. Bản ghi đã xóa mềm từ trước giữ NULL và được
-- hiển thị là "Không rõ" ở màn hình thùng rác.

ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE san_pham ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

ALTER TABLE danh_muc ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE danh_muc ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE danh_muc ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

ALTER TABLE khach_hang ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE khach_hang ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE khach_hang ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

ALTER TABLE nhan_vien ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE nhan_vien ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE nhan_vien ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

ALTER TABLE tai_khoan ADD COLUMN IF NOT EXISTS ngay_xoa TIMESTAMP NULL;
ALTER TABLE tai_khoan ADD COLUMN IF NOT EXISTS nguoi_xoa BIGINT NULL REFERENCES tai_khoan(ma_tk);
ALTER TABLE tai_khoan ADD COLUMN IF NOT EXISTS ly_do_xoa VARCHAR(255) NULL;

-- Thùng rác chỉ đọc các dòng da_xoa = true và sắp xếp mới nhất trước.
-- Chỉ mục một phần nên rất nhỏ, không ảnh hưởng đường đọc/ghi thường ngày.
CREATE INDEX IF NOT EXISTS idx_san_pham_thung_rac ON san_pham (ngay_xoa DESC)
    WHERE da_xoa = true;
CREATE INDEX IF NOT EXISTS idx_bien_the_sp_thung_rac ON bien_the_sp (ngay_xoa DESC)
    WHERE da_xoa = true;
CREATE INDEX IF NOT EXISTS idx_danh_muc_thung_rac ON danh_muc (ngay_xoa DESC)
    WHERE da_xoa = true;

-- ==========================================
-- 9. ĐỔI TRẢ & NHẬT KÝ HỆ THỐNG
-- ==========================================
-- Khách đổi size áo
INSERT INTO phieu_doi_tra (ma_don_hang, ma_kh, loai_phieu, ly_do_doi_tra, trang_thai) VALUES
(1, 1, 'DOI_HANG', 'Mặc chật, đổi từ size M sang L', 'DA_XU_LY');

-- Đổi từ SKU 1 (M) sang SKU 2 (L)
INSERT INTO ct_doi_tra (ma_phieu_dt, ma_sku_cu, ma_sku_moi, so_luong_tra_cu, so_luong_doi_moi, chenh_lech_gia) VALUES
(1, 1, 2, 1, 1, 0);

INSERT INTO nhat_ky_he_thong (ma_tk, hanh_dong, du_lieu_thay_doi) VALUES
(1, 'TAO_DANH_MUC', 'Admin tạo danh mục Áo thun'),
(2, 'DUYET_DON_HANG', 'Nhân viên 1 duyệt đơn hàng mã #1');
-- ==========================================
-- 7. ĐƠN HÀNG & CHI TIẾT ĐƠN HÀNG
-- ==========================================
-- Khách ID 1 đặt đơn, Nhân viên ID 1 xử lý, áp dụng voucher ID 1
INSERT INTO don_hang (ma_kh, ma_nv, trang_thai, dia_chi_giao, phi_van_chuyen, ma_voucher, tong_tien) VALUES
(1, 1, 'DA_GIAO', '123 Đường ABC, Quận 1, TP.HCM', 30000, 1, 300000);

-- Chi tiết đơn hàng: Đặt 2 Áo thun Đen size M (SKU ID 1)
INSERT INTO ct_don_hang (ma_don_hang, ma_sku, so_luong, don_gia) VALUES
(1, 1, 2, 150000);
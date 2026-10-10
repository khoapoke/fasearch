-- ==========================================
-- 5. GIỎ HÀNG & MẶT HÀNG TRONG GIỎ
-- ==========================================
-- Cấp giỏ hàng cho Khách hàng ID 1
INSERT INTO gio_hang (so_luong_sp, ma_kh) VALUES (2, 1);

-- Khách hàng này bỏ 2 Áo thun (ID 1) vào giỏ
INSERT INTO mat_hang_gio (ma_gio_hang, ma_sp, so_luong) VALUES (1, 1, 2);
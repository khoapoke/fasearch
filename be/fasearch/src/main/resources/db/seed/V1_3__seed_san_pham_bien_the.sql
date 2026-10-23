-- ==========================================
-- 3. DỮ LIỆU SẢN PHẨM & BIẾN THỂ
-- ==========================================
INSERT INTO san_pham (ten_sp, ma_danh_muc, chat_lieu, kieu_dang, mo_ta, gia_ban, trang_thai, da_xoa) VALUES
('Áo Thun Cổ Tròn Basic', 1, 'Cotton 100%', 'Oversize', 'Áo thun mặc mát mẻ mùa hè, thấm hút mồ hôi tốt', 150000, 'DANG_BAN', FALSE), -- ID 1 (Danh mục Áo thun)
('Quần Jean Nam Ống Suông', 2, 'Denim', 'Straight', 'Quần jean phong cách retro Hàn Quốc', 350000, 'DANG_BAN', FALSE);             -- ID 2 (Danh mục Quần Jean)

INSERT INTO bien_the_sp (ma_sp, mau_sac, kich_co, ma_vach) VALUES
-- Biến thể cho Áo thun (ID 1)
(1, 'Đen', 'M', 'SP01-DEN-M'),
(1, 'Đen', 'L', 'SP01-DEN-L'),
(1, 'Trắng', 'M', 'SP01-TRA-M'),
(1, 'Trắng', 'L', 'SP01-TRA-L'),
-- Biến thể cho Quần Jean (ID 2)
(2, 'Xanh đậm', '30', 'SP02-XAN-30'),
(2, 'Xanh đậm', '31', 'SP02-XAN-31'),
(2, 'Xanh nhạt', '30', 'SP02-XNH-30');
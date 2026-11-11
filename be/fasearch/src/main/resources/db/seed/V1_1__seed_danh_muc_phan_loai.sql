-- ==========================================
-- 1. DỮ LIỆU DANH MỤC & PHÂN LOẠI
-- ==========================================
INSERT INTO vai_tro (ten_vai_tro, quyen) VALUES
('ADMIN', 'Toàn quyền quản trị hệ thống'),
('STAFF', 'Quản lý đơn hàng, sản phẩm, khách hàng'),
('CUSTOMER', 'Mua hàng, xem lịch sử đơn hàng');

INSERT INTO hang_thanh_vien (ten_hang, nguong_diem, quyen_loi) VALUES
('Đồng', 0, 'Không có đặc quyền'),
('Bạc', 1000, 'Giảm 5% mọi đơn hàng'),
('Vàng', 5000, 'Giảm 10% mọi đơn hàng'),
('Kim Cương', 10000, 'Giảm 15% và Miễn phí vận chuyển');

INSERT INTO danh_muc (ten_danh_muc) VALUES
('Áo Thun'), 
('Quần Jean'), 
('Áo Khoác'), 
('Phụ Kiện');

INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu) VALUES
('Thanh toán khi nhận hàng (COD)', 'TIEN_MAT', 'HOAT_DONG', 'Thanh toán trực tiếp cho shipper'),
('Chuyển khoản VNPay', 'CHUYEN_KHOAN', 'HOAT_DONG', 'Quét mã QR qua ứng dụng ngân hàng'),
('Ví MoMo', 'VI_DIEN_TU', 'HOAT_DONG', 'Thanh toán qua ví điện tử MoMo');
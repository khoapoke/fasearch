-- ==========================================
-- 2. DỮ LIỆU NGƯỜI DÙNG (Tài khoản, NV, KH)
-- ==========================================
-- Lưu ý: Mật khẩu ở đây đang set cứng là '123456'. 
-- Nếu bạn dùng Spring Security với BCrypt, bạn cần đổi chuỗi này thành chuỗi đã hash (VD: $2a$10$...)
INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, email, trang_thai, ma_vai_tro) VALUES
('admin', '123456', 'admin@fasearch.com', 'HOAT_DONG', 1),       -- ID 1: Vai trò ADMIN
('nhanvien1', '123456', 'nv1@fasearch.com', 'HOAT_DONG', 2),    -- ID 2: Vai trò STAFF
('khachhang1', '123456', 'kh1@gmail.com', 'HOAT_DONG', 3);      -- ID 3: Vai trò CUSTOMER

INSERT INTO nhan_vien (ho_nv, ten_nv, gioi_tinh, ngay_sinh, sdt, cccd, ma_tk) VALUES
('Nguyễn Quản', 'Trị', 'Nam', '1995-01-01', '0900000000', '001095000000', 1),
('Trần Nhân', 'Viên', 'Nữ', '1998-05-05', '0911111111', '001098111111', 2);

INSERT INTO khach_hang (ho_kh, ten_kh, gioi_tinh, ngay_sinh, sdt, dia_chi, diem_tich_luy, ma_hang, ma_tk) VALUES
('Lê Khách', 'Hàng', 'Nam', '2000-10-10', '0922222222', '123 Đường ABC, Quận 1, TP.HCM', 0, 1, 3);
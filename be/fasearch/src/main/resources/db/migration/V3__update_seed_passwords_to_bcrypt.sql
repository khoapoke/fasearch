-- =============================================================================
-- V3: CẬP NHẬT MẬT KHẨU CÁC TÀI KHOẢN MẪU (SEED) TỪ PLAIN TEXT SANG BCRYPT HASH
-- =============================================================================
-- Mật khẩu ban đầu là: 123456
-- BCrypt Hash (strength 10) tương ứng: $2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi

UPDATE tai_khoan 
SET mat_khau = '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi'
WHERE ten_dang_nhap IN ('admin', 'nhanvien1', 'khachhang1');

-- =============================================================================
-- V2: BỔ SUNG CỘT XÓA MỀM (da_xoa) VÀ CHUẨN HÓA ENUM/STATUS SANG TIẾNG ANH IN HOA
-- =============================================================================

-- 1. BỔ SUNG CỘT da_xoa (SOFT DELETE) CHO TOÀN BỘ CÁC BẢNG CỐT LÕI
-- (san_pham đã có sẵn cột da_xoa từ V1)
ALTER TABLE tai_khoan ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE nhan_vien ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE khach_hang ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE hang_thanh_vien ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE danh_muc ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE bien_the_sp ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE khuyen_mai ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE ma_giam_gia ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE phuong_thuc_thanh_toan ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE don_hang ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;
ALTER TABLE phieu_doi_tra ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;

-- 2. BỔ SUNG CỘT trang_thai CHO CÁC BẢNG CHƯA CÓ
ALTER TABLE khuyen_mai ADD COLUMN IF NOT EXISTS trang_thai VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE ma_giam_gia ADD COLUMN IF NOT EXISTS trang_thai VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE thanh_toan ADD COLUMN IF NOT EXISTS trang_thai VARCHAR(50) DEFAULT 'PAID';

-- 3. CHUẨN HÓA DỮ LIỆU SEED SANG TIẾNG ANH IN HOA (UPPER_SNAKE_CASE)

-- 3.1. Bảng tai_khoan: Chuyển HOAT_DONG -> ACTIVE
UPDATE tai_khoan 
SET trang_thai = 'ACTIVE' 
WHERE trang_thai = 'HOAT_DONG' OR trang_thai IS NULL;

-- 3.2. Bảng nhan_vien & khach_hang: Chuyển giới tính sang MALE / FEMALE
UPDATE nhan_vien 
SET gioi_tinh = 'MALE' 
WHERE gioi_tinh = 'Nam';

UPDATE nhan_vien 
SET gioi_tinh = 'FEMALE' 
WHERE gioi_tinh = 'Nữ';

UPDATE khach_hang 
SET gioi_tinh = 'MALE' 
WHERE gioi_tinh = 'Nam';

UPDATE khach_hang 
SET gioi_tinh = 'FEMALE' 
WHERE gioi_tinh = 'Nữ';

-- 3.3. Bảng san_pham: Chuyển DANG_BAN -> ACTIVE
UPDATE san_pham 
SET trang_thai = 'ACTIVE' 
WHERE trang_thai = 'DANG_BAN';

-- 3.4. Bảng phuong_thuc_thanh_toan: Chuẩn hóa trang_thai và loai_phuong_thuc_tt
UPDATE phuong_thuc_thanh_toan 
SET trang_thai = 'ACTIVE' 
WHERE trang_thai = 'HOAT_DONG';

UPDATE phuong_thuc_thanh_toan 
SET loai_phuong_thuc_tt = 'CASH' 
WHERE loai_phuong_thuc_tt = 'TIEN_MAT';

UPDATE phuong_thuc_thanh_toan 
SET loai_phuong_thuc_tt = 'BANK_TRANSFER' 
WHERE loai_phuong_thuc_tt = 'CHUYEN_KHOAN';

UPDATE phuong_thuc_thanh_toan 
SET loai_phuong_thuc_tt = 'E_WALLET' 
WHERE loai_phuong_thuc_tt = 'VI_DIEN_TU';

-- 3.5. Bảng khuyen_mai: Chuyển loai_giam sang PERCENTAGE / FIXED_AMOUNT
UPDATE khuyen_mai 
SET loai_giam = 'PERCENTAGE' 
WHERE loai_giam = 'PHAN_TRAM';

UPDATE khuyen_mai 
SET loai_giam = 'FIXED_AMOUNT' 
WHERE loai_giam = 'SO_TIEN';

-- 3.6. Bảng don_hang: Chuyển DA_GIAO -> COMPLETED
UPDATE don_hang 
SET trang_thai = 'COMPLETED' 
WHERE trang_thai = 'DA_GIAO';

-- 3.7. Bảng hoa_don: Chuyển DA_THANH_TOAN -> PAID
UPDATE hoa_don 
SET trang_thai = 'PAID' 
WHERE trang_thai = 'DA_THANH_TOAN';

-- 3.8. Bảng phieu_doi_tra: Chuẩn hóa loai_phieu và trang_thai
UPDATE phieu_doi_tra 
SET loai_phieu = 'EXCHANGE' 
WHERE loai_phieu = 'DOI_HANG';

UPDATE phieu_doi_tra 
SET loai_phieu = 'RETURN' 
WHERE loai_phieu = 'TRA_HANG';

UPDATE phieu_doi_tra 
SET trang_thai = 'PROCESSED' 
WHERE trang_thai = 'DA_XU_LY';

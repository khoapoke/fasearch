-- 1. BẢNG KHÔNG PHỤ THUỘC (Tạo trước)
CREATE TABLE vai_tro (
    ma_vai_tro BIGSERIAL PRIMARY KEY,
    ten_vai_tro VARCHAR(100) NOT NULL,
    quyen TEXT
);

CREATE TABLE hang_thanh_vien (
    ma_hang BIGSERIAL PRIMARY KEY,
    ten_hang VARCHAR(100) NOT NULL,
    nguong_diem INT DEFAULT 0,
    quyen_loi TEXT
);

CREATE TABLE danh_muc (
    ma_danh_muc BIGSERIAL PRIMARY KEY,
    ten_danh_muc VARCHAR(150) NOT NULL
);

CREATE TABLE khuyen_mai (
    ma_km BIGSERIAL PRIMARY KEY,
    ten_ctkm VARCHAR(255) NOT NULL,
    loai_giam VARCHAR(50),
    gia_tri_giam DECIMAL(15, 2),
    ngay_bat_dau TIMESTAMP,
    ngay_ket_thuc TIMESTAMP,
    dieu_kien_ap_dung TEXT
);

CREATE TABLE phuong_thuc_thanh_toan (
    ma_phuong_thuc_tt BIGSERIAL PRIMARY KEY,
    ten_phuong_thuc_tt VARCHAR(100) NOT NULL,
    loai_phuong_thuc_tt VARCHAR(50),
    trang_thai VARCHAR(50),
    ghi_chu TEXT
);

-- 2. BẢNG PHỤ THUỘC CẤP 1
CREATE TABLE tai_khoan (
    ma_tk BIGSERIAL PRIMARY KEY,
    ten_dang_nhap VARCHAR(50) UNIQUE NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    trang_thai VARCHAR(50),
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ma_vai_tro BIGINT REFERENCES vai_tro(ma_vai_tro)
);

CREATE TABLE san_pham (
    ma_sp BIGSERIAL PRIMARY KEY,
    ten_sp VARCHAR(255) NOT NULL,
    ma_danh_muc BIGINT REFERENCES danh_muc(ma_danh_muc),
    chat_lieu VARCHAR(100),
    kieu_dang VARCHAR(100),
    mo_ta TEXT,
    gia_ban DECIMAL(15, 2) NOT NULL,
    trang_thai VARCHAR(50),
    hinh_anh_sp VARCHAR(255),
    da_xoa BOOLEAN DEFAULT FALSE
);

CREATE TABLE ma_giam_gia (
    ma_voucher BIGSERIAL PRIMARY KEY,
    ma_km BIGINT REFERENCES khuyen_mai(ma_km),
    ma_code VARCHAR(50) UNIQUE NOT NULL,
    so_luong_phat_hanh INT,
    da_su_dung INT DEFAULT 0
);

-- 3. BẢNG PHỤ THUỘC CẤP 2
CREATE TABLE khach_hang (
    ma_kh BIGSERIAL PRIMARY KEY,
    ho_kh VARCHAR(50),
    ten_kh VARCHAR(50) NOT NULL,
    hinh_anh_kh VARCHAR(255),
    gioi_tinh VARCHAR(10),
    ngay_sinh DATE,
    sdt VARCHAR(15) UNIQUE,
    dia_chi TEXT,
    diem_tich_luy INT DEFAULT 0,
    ma_hang BIGINT REFERENCES hang_thanh_vien(ma_hang),
    ma_tk BIGINT REFERENCES tai_khoan(ma_tk)
);

CREATE TABLE nhan_vien (
    ma_nv BIGSERIAL PRIMARY KEY,
    ho_nv VARCHAR(50),
    ten_nv VARCHAR(50) NOT NULL,
    hinh_anh_nv VARCHAR(255),
    gioi_tinh VARCHAR(10),
    ngay_sinh DATE,
    sdt VARCHAR(15) UNIQUE,
    cccd VARCHAR(20) UNIQUE,
    dia_chi TEXT,
    ma_tk BIGINT REFERENCES tai_khoan(ma_tk)
);

CREATE TABLE nhat_ky_he_thong (
    ma_nhat_ky BIGSERIAL PRIMARY KEY,
    ma_tk BIGINT REFERENCES tai_khoan(ma_tk),
    thoi_gian TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hanh_dong VARCHAR(255),
    du_lieu_thay_doi TEXT
);

CREATE TABLE bien_the_sp (
    ma_sku BIGSERIAL PRIMARY KEY,
    ma_sp BIGINT REFERENCES san_pham(ma_sp),
    mau_sac VARCHAR(50),
    kich_co VARCHAR(50),
    ma_vach VARCHAR(100) UNIQUE
);

-- 4. BẢNG GIAO DỊCH (DON_HANG, GIO_HANG) VÀ PHỤ THUỘC CẤP 3
CREATE TABLE don_hang (
    ma_don_hang BIGSERIAL PRIMARY KEY,
    ma_kh BIGINT REFERENCES khach_hang(ma_kh),
    ma_nv BIGINT REFERENCES nhan_vien(ma_nv),
    ngay_dat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(50),
    dia_chi_giao TEXT,
    phi_van_chuyen DECIMAL(15, 2),
    ma_voucher BIGINT REFERENCES ma_giam_gia(ma_voucher),
    tong_tien DECIMAL(15, 2)
);

CREATE TABLE gio_hang (
    ma_gio_hang BIGSERIAL PRIMARY KEY,
    so_luong_sp INT DEFAULT 0,
    ma_kh BIGINT UNIQUE REFERENCES khach_hang(ma_kh)
);

-- 5. BẢNG CHI TIẾT (Liên kết nhiều-nhiều hoặc phụ thuộc sâu nhất)
CREATE TABLE hoa_don (
    ma_hoa_don BIGSERIAL PRIMARY KEY,
    ngay_lap TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    thue_vat DECIMAL(5, 2),
    tong_tien_thuc_tra DECIMAL(15, 2),
    trang_thai VARCHAR(50),
    ma_don_hang BIGINT REFERENCES don_hang(ma_don_hang)
);

CREATE TABLE ct_don_hang (
    ma_don_hang BIGINT REFERENCES don_hang(ma_don_hang),
    ma_sku BIGINT REFERENCES bien_the_sp(ma_sku),
    so_luong INT NOT NULL,
    don_gia DECIMAL(15, 2),
    PRIMARY KEY (ma_don_hang, ma_sku)
);

CREATE TABLE thanh_toan (
    ma_tt BIGSERIAL PRIMARY KEY,
    so_tien DECIMAL(15, 2),
    thoi_gian TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ma_phuong_thuc_tt BIGINT REFERENCES phuong_thuc_thanh_toan(ma_phuong_thuc_tt),
    ma_hoa_don BIGINT REFERENCES hoa_don(ma_hoa_don)
);

CREATE TABLE phieu_doi_tra (
    ma_phieu_dt BIGSERIAL PRIMARY KEY,
    ma_don_hang BIGINT REFERENCES don_hang(ma_don_hang),
    ma_kh BIGINT REFERENCES khach_hang(ma_kh),
    loai_phieu VARCHAR(50),
    ly_do_doi_tra TEXT,
    ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(50)
);

CREATE TABLE ct_doi_tra (
    ma_phieu_dt BIGINT REFERENCES phieu_doi_tra(ma_phieu_dt),
    ma_sku_cu BIGINT REFERENCES bien_the_sp(ma_sku),
    ma_sku_moi BIGINT REFERENCES bien_the_sp(ma_sku),
    so_luong_tra_cu INT,
    so_luong_doi_moi INT,
    chenh_lech_gia DECIMAL(15, 2),
    PRIMARY KEY (ma_phieu_dt, ma_sku_cu)
);

CREATE TABLE mat_hang_gio (
    ma_gio_hang BIGINT REFERENCES gio_hang(ma_gio_hang),
    ma_sp BIGINT REFERENCES san_pham(ma_sp),
    so_luong INT NOT NULL,
    ngay_them_sp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ma_gio_hang, ma_sp)
);
-- =============================================================================
-- V27: PHÂN QUYỀN THEO VAI TRÒ (BẬT/TẮT TỪNG QUYỀN CHO QUẢN LÝ)
-- =============================================================================
-- quyen_vai_tro: các quyền đang BẬT của một vai trò. Chỉ vai trò STAFF (Quản lý) được đọc từ bảng này;
-- ADMIN luôn có mọi quyền trong code (không lưu), CUSTOMER không có quyền nào. Mã quyền lạ bị bỏ qua.
-- Danh mục mã quyền nằm trong code: com.springboot.fasearch.security.Permission.
--
-- Seed: Quản lý giữ ĐÚNG phạm vi trước V27 (mọi quyền), trừ LOYALTY_ADJUST (quyền mới, mặc định tắt).
-- Danh sách dưới đây phải khớp Permission.staffDefaults() (có test kiểm tra).

CREATE TABLE IF NOT EXISTS quyen_vai_tro (
    ma_vai_tro BIGINT NOT NULL REFERENCES vai_tro(ma_vai_tro),
    ma_quyen VARCHAR(64) NOT NULL,
    PRIMARY KEY (ma_vai_tro, ma_quyen)
);

-- Nhật ký mỗi lần ADMIN lưu phân quyền: bộ quyền trước và sau (mã cách nhau bởi dấu phẩy, đã sắp xếp).
CREATE TABLE IF NOT EXISTS nhat_ky_phan_quyen (
    id BIGSERIAL PRIMARY KEY,
    ma_tai_khoan_thuc_hien BIGINT REFERENCES tai_khoan(ma_tk),
    ma_vai_tro BIGINT NOT NULL REFERENCES vai_tro(ma_vai_tro),
    quyen_truoc TEXT NOT NULL,
    quyen_sau TEXT NOT NULL,
    thoi_gian TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nhat_ky_phan_quyen_vai_tro_thoi_gian
    ON nhat_ky_phan_quyen (ma_vai_tro, thoi_gian DESC, id DESC);

INSERT INTO quyen_vai_tro (ma_vai_tro, ma_quyen)
SELECT v.ma_vai_tro, q.ma_quyen
FROM vai_tro v
CROSS JOIN (VALUES
    ('ORDER_VIEW'),
    ('ORDER_UPDATE_STATUS'),
    ('ORDER_CANCEL'),
    ('ORDER_COLLECT_CASH'),
    ('POS_USE'),
    ('CUSTOMER_VIEW'),
    ('CUSTOMER_CREATE'),
    ('CUSTOMER_EDIT'),
    ('CUSTOMER_DELETE'),
    ('EMPLOYEE_VIEW'),
    ('EMPLOYEE_CREATE'),
    ('EMPLOYEE_EDIT'),
    ('EMPLOYEE_DELETE'),
    ('PRODUCT_VIEW'),
    ('PRODUCT_EDIT'),
    ('PRODUCT_DELETE'),
    ('PRODUCT_PUBLISH'),
    ('PRODUCT_IMPORT'),
    ('CATEGORY_MANAGE'),
    ('REVIEW_MODERATE'),
    ('INVENTORY_VIEW'),
    ('INVENTORY_RECEIPT_CREATE'),
    ('STOCKTAKE_CREATE'),
    ('PROMOTION_VIEW'),
    ('PROMOTION_MANAGE'),
    ('LOYALTY_POLICY_VIEW'),
    ('LOYALTY_POLICY_MANAGE'),
    ('REPORT_VIEW'),
    ('DATA_EXPORT'),
    ('TRASH_VIEW'),
    ('TRASH_RESTORE')
) AS q(ma_quyen)
WHERE v.ten_vai_tro = 'STAFF'
ON CONFLICT DO NOTHING;

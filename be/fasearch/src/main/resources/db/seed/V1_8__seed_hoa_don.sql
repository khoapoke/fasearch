-- ==========================================
-- 8. HÓA ĐƠN & THANH TOÁN
-- ==========================================
INSERT INTO hoa_don (thue_vat, tong_tien_thuc_tra, trang_thai, ma_don_hang) VALUES
(8.00, 324000, 'DA_THANH_TOAN', 1); -- (300k tiền hàng + 30k ship - 10% km + 8% VAT)

-- Thanh toán qua COD (ID 1)
INSERT INTO thanh_toan (so_tien, ma_phuong_thuc_tt, ma_hoa_don) VALUES
(324000, 1, 1);
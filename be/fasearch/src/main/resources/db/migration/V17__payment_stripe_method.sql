INSERT INTO phuong_thuc_thanh_toan (ten_phuong_thuc_tt, loai_phuong_thuc_tt, trang_thai, ghi_chu, da_xoa)
SELECT 'Stripe test checkout', 'STRIPE', 'ACTIVE', 'Stripe test-mode only; never live', FALSE
WHERE NOT EXISTS (SELECT 1 FROM phuong_thuc_thanh_toan WHERE loai_phuong_thuc_tt = 'STRIPE' AND da_xoa = FALSE);

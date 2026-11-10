-- Explicit per-table field allowlists. Never persist request bodies, passwords, tokens,
-- email/phone/address/identity documents, free-form notes, or provider payloads.
CREATE TABLE activity_log (
 id BIGSERIAL PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 actor_id BIGINT, actor_username VARCHAR(100) NOT NULL, actor_role VARCHAR(20) NOT NULL,
 action VARCHAR(30) NOT NULL, object_type VARCHAR(40) NOT NULL, object_id TEXT NOT NULL,
 object_label TEXT NOT NULL, changes JSONB NOT NULL
);
CREATE INDEX activity_log_time ON activity_log(occurred_at DESC,id DESC);
CREATE INDEX activity_log_object ON activity_log(object_type,object_id,id DESC);
CREATE INDEX activity_log_actor ON activity_log(actor_id,id DESC);
CREATE FUNCTION capture_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 before_row JSONB := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row JSONB := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 row_data JSONB; delta JSONB := '{}'::jsonb; field TEXT; fields TEXT[] := string_to_array(TG_ARGV[3],',');
 action_name TEXT := TG_OP; actor_name TEXT; actor_key BIGINT; role_name TEXT; label TEXT;
BEGIN
 row_data := CASE WHEN TG_OP='DELETE' THEN before_row ELSE after_row END;
 FOREACH field IN ARRAY fields LOOP
  IF before_row->field IS DISTINCT FROM after_row->field THEN
   delta := delta || jsonb_build_object(field,jsonb_build_object('before',before_row->field,'after',after_row->field));
  END IF;
 END LOOP;
 -- Password values never enter the delta; only the fact of a credential change is recorded.
 IF TG_TABLE_NAME='tai_khoan' AND TG_OP='UPDATE' AND before_row->'mat_khau' IS DISTINCT FROM after_row->'mat_khau' THEN
  delta := delta || '{"credential_changed":{"before":false,"after":true}}'::jsonb;
 END IF;
 -- Private/free-form edits remain visible as facts, with no old/new value persisted.
 IF TG_OP='UPDATE' THEN
  FOREACH field IN ARRAY string_to_array(coalesce(TG_ARGV[4],''),',') LOOP
   IF before_row->field IS DISTINCT FROM after_row->field THEN
    delta:=delta||jsonb_build_object(field||'_changed',jsonb_build_object('before',false,'after',true));
   END IF;
  END LOOP;
 END IF;
 IF delta='{}'::jsonb THEN RETURN NULL; END IF;
 IF TG_OP='INSERT' THEN action_name:='CREATE';
 ELSIF TG_OP='UPDATE' THEN
  action_name:=CASE
   WHEN before_row->>'da_xoa'='false' AND after_row->>'da_xoa'='true' THEN 'DELETE'
   WHEN before_row->>'da_xoa'='true' AND after_row->>'da_xoa'='false' THEN 'RESTORE'
   WHEN TG_ARGV[0]='PERMISSION' THEN 'PERMISSION_CHANGE'
   WHEN TG_ARGV[0]='RETURN' AND before_row->>'status' IS DISTINCT FROM after_row->>'status' AND after_row->>'status'='REFUNDED' THEN 'REFUND'
   WHEN before_row->'trang_thai' IS DISTINCT FROM after_row->'trang_thai' OR before_row->'status' IS DISTINCT FROM after_row->'status' THEN 'STATUS_CHANGE'
   ELSE 'UPDATE' END;
 END IF;
 IF TG_ARGV[0]='PERMISSION' THEN action_name:='PERMISSION_CHANGE'; END IF;
 IF TG_ARGV[0]='LOYALTY_ENTRY' AND row_data->>'entry_type'='ADJUST' THEN action_name:='POINT_ADJUST'; END IF;
 actor_name:=nullif(current_setting('fasearch.actor',true),'');
 actor_key:=nullif(current_setting('fasearch.actor_id',true),'')::BIGINT;
 role_name:=nullif(current_setting('fasearch.actor_role',true),'');
 label:=coalesce(nullif(row_data->>TG_ARGV[2],''),TG_ARGV[0]||' #'||(row_data->>TG_ARGV[1]));
 INSERT INTO activity_log(actor_id,actor_username,actor_role,action,object_type,object_id,object_label,changes)
 VALUES(actor_key,coalesce(actor_name,'SYSTEM'),coalesce(role_name,'SYSTEM'),action_name,TG_ARGV[0],row_data->>TG_ARGV[1],left(label,255),delta);
 RETURN NULL;
END $$;

CREATE TRIGGER activity_product AFTER INSERT OR UPDATE OR DELETE ON san_pham FOR EACH ROW EXECUTE FUNCTION capture_activity('PRODUCT','ma_sp','ten_sp','ten_sp,ma_danh_muc,gia_ban,trang_thai,publication_status,publication_version,da_xoa,chat_lieu,kieu_dang','mo_ta,hinh_anh_sp');
CREATE TRIGGER activity_sku AFTER INSERT OR UPDATE OR DELETE ON bien_the_sp FOR EACH ROW EXECUTE FUNCTION capture_activity('SKU','ma_sku','ma_vach','ma_sp,mau_sac,kich_co,ma_vach,da_xoa');
CREATE TRIGGER activity_category AFTER INSERT OR UPDATE OR DELETE ON danh_muc FOR EACH ROW EXECUTE FUNCTION capture_activity('CATEGORY','ma_danh_muc','ten_danh_muc','ten_danh_muc,da_xoa');
CREATE TRIGGER activity_order AFTER INSERT OR UPDATE OR DELETE ON don_hang FOR EACH ROW EXECUTE FUNCTION capture_activity('ORDER','ma_don_hang','ma_don','ma_don,trang_thai,ma_nv,tong_tien,phi_van_chuyen,tien_giam,redeemed_points,points_discount,da_xoa','cancellation_reason');
CREATE TRIGGER activity_invoice AFTER INSERT OR UPDATE OR DELETE ON hoa_don FOR EACH ROW EXECUTE FUNCTION capture_activity('INVOICE','ma_hoa_don','ma_hoa_don','ma_don_hang,tong_tien_thuc_tra,trang_thai');
CREATE TRIGGER activity_payment AFTER INSERT OR UPDATE OR DELETE ON thanh_toan FOR EACH ROW EXECUTE FUNCTION capture_activity('PAYMENT','ma_tt','ma_tt','ma_hoa_don,ma_phuong_thuc_tt,so_tien');
CREATE TRIGGER activity_return AFTER INSERT OR UPDATE OR DELETE ON order_return FOR EACH ROW EXECUTE FUNCTION capture_activity('RETURN','id','order_id','order_id,status,reason,merchandise_amount,shipping_amount,refund_amount,earned_reverse,redeemed_return,points_shortfall');
CREATE TRIGGER activity_return_line AFTER INSERT OR UPDATE OR DELETE ON order_return_line FOR EACH ROW EXECUTE FUNCTION capture_activity('RETURN_LINE','return_id','product_name','sku_id,quantity,restock_quantity,refund_amount');
CREATE TRIGGER activity_import AFTER INSERT OR UPDATE OR DELETE ON phieu_nhap_kho FOR EACH ROW EXECUTE FUNCTION capture_activity('IMPORT_RECEIPT','ma_phieu_nhap','ma_phieu','ma_phieu,tong_so_luong,tong_tien,trang_thai,da_xoa');
CREATE TRIGGER activity_export AFTER INSERT OR UPDATE OR DELETE ON phieu_xuat_kho FOR EACH ROW EXECUTE FUNCTION capture_activity('EXPORT_RECEIPT','ma_phieu_xuat','ma_phieu','ma_phieu,loai_xuat,tong_so_luong,trang_thai,da_xoa');
CREATE TRIGGER activity_stocktake AFTER INSERT OR UPDATE OR DELETE ON phieu_kiem_ke FOR EACH ROW EXECUTE FUNCTION capture_activity('STOCKTAKE','ma_phieu_kiem_ke','ma_phieu','ma_phieu,tong_so_lech,trang_thai,da_xoa');
CREATE TRIGGER activity_stock AFTER INSERT OR UPDATE OR DELETE ON ton_kho FOR EACH ROW EXECUTE FUNCTION capture_activity('STOCK','ma_sku','ma_sku','so_luong_vat_ly,so_luong_tam_giu,so_luong_kha_dung,nguong_toi_thieu,da_xoa');
CREATE TRIGGER activity_import_line AFTER INSERT OR UPDATE OR DELETE ON ct_phieu_nhap FOR EACH ROW EXECUTE FUNCTION capture_activity('IMPORT_LINE','ma_phieu_nhap','ma_sku','ma_sku,so_luong,gia_nhap,thanh_tien,da_xoa');
CREATE TRIGGER activity_export_line AFTER INSERT OR UPDATE OR DELETE ON ct_phieu_xuat FOR EACH ROW EXECUTE FUNCTION capture_activity('EXPORT_LINE','ma_phieu_xuat','ma_sku','ma_sku,so_luong,da_xoa');
CREATE TRIGGER activity_stocktake_line AFTER INSERT OR UPDATE OR DELETE ON ct_phieu_kiem_ke FOR EACH ROW EXECUTE FUNCTION capture_activity('STOCKTAKE_LINE','ma_phieu_kiem_ke','ma_sku','ma_sku,so_luong_he_thong,so_luong_thuc_te,chenh_lech,da_xoa');
CREATE TRIGGER activity_promotion AFTER INSERT OR UPDATE OR DELETE ON khuyen_mai FOR EACH ROW EXECUTE FUNCTION capture_activity('PROMOTION','ma_km','ten_ctkm','ten_ctkm,loai_giam,gia_tri_giam,ngay_bat_dau,ngay_ket_thuc,trang_thai,phien_ban,da_xoa','dieu_kien_ap_dung');
CREATE TRIGGER activity_voucher AFTER INSERT OR UPDATE OR DELETE ON ma_giam_gia FOR EACH ROW EXECUTE FUNCTION capture_activity('VOUCHER','ma_voucher','ma_code','ma_km,ma_code,so_luong_phat_hanh,da_su_dung,so_luong_giu_cho,trang_thai,da_xoa');
CREATE TRIGGER activity_policy AFTER INSERT OR UPDATE OR DELETE ON loyalty_policy FOR EACH ROW EXECUTE FUNCTION capture_activity('LOYALTY_POLICY','policy_id','policy_id','current_version,status');
CREATE TRIGGER activity_policy_version AFTER INSERT OR UPDATE OR DELETE ON loyalty_policy_version FOR EACH ROW EXECUTE FUNCTION capture_activity('LOYALTY_POLICY_VERSION','policy_id','version','version,earn_currency_per_point,redeem_currency_per_point');
CREATE TRIGGER activity_points AFTER INSERT ON loyalty_ledger_entry FOR EACH ROW EXECUTE FUNCTION capture_activity('LOYALTY_ENTRY','entry_id','entry_type','customer_id,entry_type,points,order_id');
CREATE TRIGGER activity_customer AFTER INSERT OR UPDATE OR DELETE ON khach_hang FOR EACH ROW EXECUTE FUNCTION capture_activity('CUSTOMER','ma_kh','ten_kh','ho_kh,ten_kh,ma_hang,diem_tich_luy,diem_giu_cho,da_xoa','sdt,dia_chi,ngay_sinh,gioi_tinh,hinh_anh_kh,delivery_latitude,delivery_longitude');
CREATE TRIGGER activity_employee AFTER INSERT OR UPDATE OR DELETE ON nhan_vien FOR EACH ROW EXECUTE FUNCTION capture_activity('EMPLOYEE','ma_nv','ten_nv','ho_nv,ten_nv,ma_tk,da_xoa','sdt,dia_chi,cccd,ngay_sinh,gioi_tinh,hinh_anh_nv');
CREATE TRIGGER activity_account AFTER INSERT OR UPDATE OR DELETE ON tai_khoan FOR EACH ROW EXECUTE FUNCTION capture_activity('ACCOUNT','ma_tk','ten_dang_nhap','ten_dang_nhap,trang_thai,ma_vai_tro,da_xoa','email');
CREATE TRIGGER activity_permission AFTER INSERT OR UPDATE OR DELETE ON quyen_vai_tro FOR EACH ROW EXECUTE FUNCTION capture_activity('PERMISSION','ma_vai_tro','ma_quyen','ma_quyen');
CREATE FUNCTION activity_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'activity log is append-only'; END $$;
CREATE TRIGGER activity_log_immutable BEFORE UPDATE OR DELETE ON activity_log FOR EACH ROW EXECUTE FUNCTION activity_log_immutable();
-- AUDIT_VIEW deliberately has no STAFF seed; grant explicitly through the existing permissions UI.
CREATE TRIGGER activity_tier AFTER INSERT OR UPDATE OR DELETE ON hang_thanh_vien FOR EACH ROW EXECUTE FUNCTION capture_activity('LOYALTY_TIER','ma_hang','ten_hang','ten_hang,nguong_diem,nguong_doanh_so,phien_ban_doanh_so,da_xoa','quyen_loi');
CREATE TRIGGER activity_promotion_product AFTER INSERT OR DELETE ON khuyen_mai_san_pham FOR EACH ROW EXECUTE FUNCTION capture_activity('PROMOTION_PRODUCT','ma_km','ma_sp','ma_sp');

-- Durable transactional outbox: triggers roll back with the business mutation.
CREATE TABLE notification_preference (
 account_id BIGINT PRIMARY KEY REFERENCES tai_khoan(ma_tk),
 order_updates BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE favorite_alert (
 account_id BIGINT NOT NULL REFERENCES tai_khoan(ma_tk),
 product_id BIGINT NOT NULL REFERENCES san_pham(ma_sp),
 stock_alert BOOLEAN NOT NULL DEFAULT FALSE,
 price_alert BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,product_id)
);
CREATE TABLE notification_signal (
 id BIGSERIAL PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
 kind VARCHAR(30) NOT NULL, object_id BIGINT NOT NULL,
 payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_error VARCHAR(100)
);
CREATE INDEX notification_signal_pending ON notification_signal(next_attempt_at,id) WHERE processed_at IS NULL;
CREATE TABLE notification_mail (
 id BIGSERIAL PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
 account_id BIGINT NOT NULL REFERENCES tai_khoan(ma_tk),
 product_id BIGINT REFERENCES san_pham(ma_sp), subscription VARCHAR(20) NOT NULL,
 subject TEXT NOT NULL, html_body TEXT NOT NULL, text_body TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','DRY_RUN','SKIPPED','FAILED')),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), first_attempt_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, last_error VARCHAR(100)
);
CREATE INDEX notification_mail_pending ON notification_mail(next_attempt_at,id) WHERE status='PENDING';
CREATE TABLE favorite_alert_rate (
 account_id BIGINT NOT NULL REFERENCES tai_khoan(ma_tk),
 product_id BIGINT NOT NULL REFERENCES san_pham(ma_sp),
 last_queued_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(account_id,product_id)
);
CREATE TABLE admin_notification (
 id BIGSERIAL PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
 permission_code VARCHAR(30) NOT NULL CHECK(permission_code IN ('ORDER_VIEW','RETURN_VIEW','INVENTORY_VIEW')),
 title TEXT NOT NULL, href TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE admin_notification_read (
 notification_id BIGINT NOT NULL REFERENCES admin_notification(id),
 account_id BIGINT NOT NULL REFERENCES tai_khoan(ma_tk), read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(notification_id,account_id)
);

CREATE FUNCTION notification_order_snapshot(order_id BIGINT) RETURNS JSONB LANGUAGE SQL VOLATILE AS $$
 SELECT jsonb_build_object('orderId',o.ma_don_hang,'orderCode',o.ma_don,'total',o.tong_tien,
 'accountId',k.ma_tk,'note',o.ghi_chu,'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'name',p.ten_sp,'quantity',d.so_luong)) FROM ct_don_hang d JOIN bien_the_sp v ON v.ma_sku=d.ma_sku
 JOIN san_pham p ON p.ma_sp=v.ma_sp WHERE d.ma_don_hang=o.ma_don_hang),'[]'::jsonb))
 FROM don_hang o LEFT JOIN khach_hang k ON k.ma_kh=o.ma_kh WHERE o.ma_don_hang=order_id
$$;
CREATE FUNCTION notification_capture_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot JSONB;
BEGIN
 IF NEW.da_xoa THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.trang_thai IS NOT DISTINCT FROM NEW.trang_thai THEN RETURN NEW; END IF;
 snapshot := notification_order_snapshot(NEW.ma_don_hang) || jsonb_build_object('status',NEW.trang_thai);
 IF NEW.trang_thai='PENDING' THEN
  INSERT INTO notification_signal(event_key,kind,object_id,payload)
  VALUES('new-order:'||NEW.ma_don_hang,'NEW_ORDER',NEW.ma_don_hang,snapshot) ON CONFLICT DO NOTHING;
 ELSIF TG_OP='UPDATE' AND NEW.trang_thai IN ('CONFIRMED','SHIPPING','COMPLETED','CANCELLED') THEN
  INSERT INTO notification_signal(event_key,kind,object_id,payload)
  VALUES('order:'||NEW.ma_don_hang||':'||NEW.trang_thai,'ORDER_STATUS',NEW.ma_don_hang,snapshot) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_order AFTER INSERT OR UPDATE ON don_hang FOR EACH ROW EXECUTE FUNCTION notification_capture_order();
CREATE FUNCTION notification_capture_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 IF NEW.status IN ('PENDING','APPROVED','REJECTED','REFUNDED') THEN
  INSERT INTO notification_signal(event_key,kind,object_id,payload)
  VALUES('return:'||NEW.id||':'||NEW.status,'RETURN_STATUS',NEW.id,
   notification_order_snapshot(NEW.order_id)||jsonb_build_object('status',NEW.status,'returnId',NEW.id,
    'rejectionReason',NEW.rejection_reason,'refundAmount',NEW.refund_amount)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_return AFTER INSERT OR UPDATE ON order_return FOR EACH ROW EXECUTE FUNCTION notification_capture_return();
CREATE FUNCTION notification_capture_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous INTEGER; product_id BIGINT; signal_id BIGINT;
BEGIN
 IF NEW.da_xoa THEN RETURN NEW; END IF;
 previous := CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.so_luong_kha_dung END;
 SELECT ma_sp INTO product_id FROM bien_the_sp WHERE ma_sku=NEW.ma_sku AND NOT da_xoa;
 IF product_id IS NULL THEN RETURN NEW; END IF;
 IF previous<=0 AND NEW.so_luong_kha_dung>0 THEN
  signal_id:=nextval(pg_get_serial_sequence('notification_signal','id'));
  INSERT INTO notification_signal(id,event_key,kind,object_id,payload)
  VALUES(signal_id,'stock:'||signal_id,'STOCK_AVAILABLE',product_id,jsonb_build_object('skuId',NEW.ma_sku,'available',NEW.so_luong_kha_dung));
 END IF;
 IF TG_OP='UPDATE' AND previous>OLD.nguong_toi_thieu AND NEW.so_luong_kha_dung<=NEW.nguong_toi_thieu THEN
  signal_id:=nextval(pg_get_serial_sequence('notification_signal','id'));
  INSERT INTO notification_signal(id,event_key,kind,object_id,payload)
  VALUES(signal_id,'low-stock:'||signal_id,'LOW_STOCK',NEW.ma_sku,jsonb_build_object('available',NEW.so_luong_kha_dung,'threshold',NEW.nguong_toi_thieu));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_stock AFTER INSERT OR UPDATE ON ton_kho FOR EACH ROW EXECUTE FUNCTION notification_capture_stock();
CREATE FUNCTION notification_capture_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT NEW.da_xoa AND NEW.publication_status='PUBLISHED' AND NEW.publication_version IS DISTINCT FROM OLD.publication_version AND NEW.gia_ban<OLD.gia_ban THEN
  INSERT INTO notification_signal(event_key,kind,object_id,payload)
  VALUES('price:'||NEW.ma_sp||':'||NEW.publication_version,'PRICE_DROP',NEW.ma_sp,
   jsonb_build_object('name',NEW.ten_sp,'oldPrice',OLD.gia_ban,'price',NEW.gia_ban)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_price AFTER UPDATE ON san_pham FOR EACH ROW EXECUTE FUNCTION notification_capture_price();

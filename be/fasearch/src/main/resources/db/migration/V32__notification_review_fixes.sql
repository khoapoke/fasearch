-- Forward-only: preserve independent subscription activation times.
ALTER TABLE favorite_alert ADD COLUMN stock_enabled_at TIMESTAMPTZ, ADD COLUMN price_enabled_at TIMESTAMPTZ;
UPDATE favorite_alert SET stock_enabled_at=CASE WHEN stock_alert THEN updated_at END,
 price_enabled_at=CASE WHEN price_alert THEN updated_at END;
ALTER TABLE don_hang ADD COLUMN cancellation_reason TEXT;
ALTER TABLE notification_signal ALTER COLUMN created_at SET DEFAULT clock_timestamp();
CREATE OR REPLACE FUNCTION notification_order_snapshot(order_id BIGINT) RETURNS JSONB LANGUAGE SQL VOLATILE AS $$
 SELECT jsonb_build_object('orderId',o.ma_don_hang,'orderCode',o.ma_don,'total',o.tong_tien,
 'accountId',k.ma_tk,'cancellationReason',o.cancellation_reason,'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'name',p.ten_sp,'quantity',d.so_luong)) FROM ct_don_hang d JOIN bien_the_sp v ON v.ma_sku=d.ma_sku
 JOIN san_pham p ON p.ma_sp=v.ma_sp WHERE d.ma_don_hang=o.ma_don_hang),'[]'::jsonb))
 FROM don_hang o LEFT JOIN khach_hang k ON k.ma_kh=o.ma_kh WHERE o.ma_don_hang=order_id
$$;
-- Historic pending snapshots have no trusted separate reason: omit it rather than expose internal notes.
UPDATE notification_signal SET payload=payload-'note' WHERE kind IN ('ORDER_STATUS','RETURN_STATUS','NEW_ORDER') AND payload ? 'note';
-- Discard previously rendered, unsent cancellation emails containing accumulated notes. The worker
-- rebuilds them from the sanitized signal; sent mail cannot be recalled.
DELETE FROM notification_mail m USING notification_signal s
 WHERE m.event_key=s.event_key AND s.kind='ORDER_STATUS' AND s.payload->>'status'='CANCELLED'
 AND m.status='PENDING' AND m.first_attempt_at IS NULL;
-- A previously attempted send has an ambiguous provider outcome; suppress further sends and
-- redact the pending content rather than creating a second delivery.
UPDATE notification_mail m SET status='SKIPPED',html_body='<p>Đơn hàng đã được hủy.</p>',text_body='Đơn hàng đã được hủy.',last_error='LEGACY_CANCELLATION_REDACTED'
 FROM notification_signal s WHERE m.event_key=s.event_key AND s.kind='ORDER_STATUS'
 AND s.payload->>'status'='CANCELLED' AND m.status='PENDING';
UPDATE notification_signal s SET processed_at=NULL
 WHERE s.kind='ORDER_STATUS' AND s.payload->>'status'='CANCELLED'
 AND NOT EXISTS(SELECT 1 FROM notification_mail m WHERE m.event_key=s.event_key);

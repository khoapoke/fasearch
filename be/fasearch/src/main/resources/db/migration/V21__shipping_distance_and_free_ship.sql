ALTER TABLE khach_hang
 ADD COLUMN delivery_latitude DOUBLE PRECISION,
 ADD COLUMN delivery_longitude DOUBLE PRECISION,
 ADD CONSTRAINT customer_delivery_coordinates CHECK (
  (delivery_latitude IS NULL AND delivery_longitude IS NULL) OR
  (delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL AND delivery_latitude BETWEEN -90 AND 90 AND delivery_longitude BETWEEN -180 AND 180));
ALTER TABLE don_hang
 ADD COLUMN delivery_latitude DOUBLE PRECISION,
 ADD COLUMN delivery_longitude DOUBLE PRECISION,
 ADD COLUMN distance_km DOUBLE PRECISION,
 ADD COLUMN shipping_method VARCHAR(20),
 ADD CONSTRAINT order_delivery_coordinates CHECK (
  (delivery_latitude IS NULL AND delivery_longitude IS NULL) OR
  (delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL AND delivery_latitude BETWEEN -90 AND 90 AND delivery_longitude BETWEEN -180 AND 180));
-- Existing Vietnamese promotion values remain backward compatible; FREE_SHIP has no merchandise discount.
ALTER TABLE khuyen_mai ADD CONSTRAINT shipping_promotion_type CHECK (loai_giam IN ('PHAN_TRAM', 'SO_TIEN', 'FREE_SHIP')) NOT VALID;

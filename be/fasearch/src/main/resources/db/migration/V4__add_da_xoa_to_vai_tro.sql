-- =============================================================================
-- V4: BỔ SUNG CỘT da_xoa CHO BẢNG vai_tro ĐỂ ĐỒNG BỘ VỚI Role ENTITY
-- =============================================================================

ALTER TABLE vai_tro ADD COLUMN IF NOT EXISTS da_xoa BOOLEAN DEFAULT FALSE;

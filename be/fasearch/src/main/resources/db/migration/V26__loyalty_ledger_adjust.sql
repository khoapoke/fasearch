-- Manual point adjustments (ADJUST) and who/why metadata on ledger rows.
-- The ledger stays append-only: only ALTER TABLE here; trg_loyalty_ledger_append_only is untouched.
-- ADJUST carries a signed, non-zero points value. Every other type keeps its old rule
-- (OPENING >= 0, HOLD/RELEASE/REDEEM/EARN > 0), so existing rows all remain valid.
ALTER TABLE loyalty_ledger_entry
    DROP CONSTRAINT loyalty_ledger_entry_check,
    DROP CONSTRAINT loyalty_ledger_entry_entry_type_check;

ALTER TABLE loyalty_ledger_entry
    ADD COLUMN ly_do VARCHAR(30),
    ADD COLUMN ghi_chu VARCHAR(500),
    ADD COLUMN nguoi_thuc_hien VARCHAR(100);

ALTER TABLE loyalty_ledger_entry
    ADD CONSTRAINT ck_loyalty_entry_type
        CHECK (entry_type IN ('OPENING', 'HOLD', 'RELEASE', 'REDEEM', 'EARN', 'ADJUST')),
    ADD CONSTRAINT ck_loyalty_entry_points
        CHECK ((entry_type = 'ADJUST' AND points <> 0)
            OR (entry_type = 'OPENING' AND points >= 0)
            OR (entry_type NOT IN ('ADJUST', 'OPENING') AND points > 0)),
    ADD CONSTRAINT ck_loyalty_adjust_meta
        CHECK (entry_type <> 'ADJUST' OR (ly_do IS NOT NULL AND nguoi_thuc_hien IS NOT NULL)),
    ADD CONSTRAINT ck_loyalty_adjust_reason
        CHECK (ly_do IS NULL OR ly_do IN
            ('BOI_THUONG', 'DIEU_CHINH_SAI_SOT', 'TANG_THEM', 'HOAN_DON', 'KHAC', 'TINH_LAI_DON'));

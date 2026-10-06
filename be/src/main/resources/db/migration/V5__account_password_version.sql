-- Narrow additive migration: monotonic credential version used to invalidate
-- sessions minted from stale passwords. Existing rows default to 0; sessions
-- created before this column existed carry no stamp and pass through (no mass
-- logout on deploy).
ALTER TABLE user_accounts ADD COLUMN password_version BIGINT NOT NULL DEFAULT 0;

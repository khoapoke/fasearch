ALTER TABLE payment_attempt ADD COLUMN IF NOT EXISTS provider_checkout_url VARCHAR(1000);

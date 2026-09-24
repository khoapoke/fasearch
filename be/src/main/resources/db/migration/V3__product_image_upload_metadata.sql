ALTER TABLE product_images
    ADD COLUMN media_type VARCHAR(20)
        CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
    ADD COLUMN byte_size BIGINT CHECK (byte_size > 0),
    ADD COLUMN quality_state VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (quality_state IN ('PENDING', 'VERIFIED', 'REJECTED'));

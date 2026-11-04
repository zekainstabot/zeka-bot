ALTER TABLE pro_purchase_requests
    ADD COLUMN IF NOT EXISTS extra_discount_percent INTEGER
        NOT NULL DEFAULT 0
        CHECK (extra_discount_percent BETWEEN 0 AND 90),

    ADD COLUMN IF NOT EXISTS applied_discount_percent INTEGER
        NOT NULL DEFAULT 0
        CHECK (applied_discount_percent BETWEEN 0 AND 90);

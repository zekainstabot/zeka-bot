ALTER TABLE pro_purchase_requests
    ADD COLUMN IF NOT EXISTS base_price_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS plan_discount_percent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS coupon_discount_percent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_amount BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pro_discount_coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL
        CHECK (discount_percent BETWEEN 1 AND 90),
    max_uses INTEGER
        CHECK (max_uses IS NULL OR max_uses > 0),
    usage_count INTEGER NOT NULL DEFAULT 0
        CHECK (usage_count >= 0),
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        starts_at IS NULL
        OR expires_at IS NULL
        OR expires_at > starts_at
    )
);

CREATE INDEX IF NOT EXISTS idx_pro_discount_coupons_active
    ON pro_discount_coupons(is_active, expires_at);

CREATE TABLE IF NOT EXISTS pro_discount_redemptions (
    id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT NOT NULL
        REFERENCES pro_discount_coupons(id),
    purchase_request_id BIGINT NOT NULL
        REFERENCES pro_purchase_requests(id),
    telegram_user_id BIGINT NOT NULL,
    discount_percent INTEGER NOT NULL
        CHECK (discount_percent BETWEEN 1 AND 90),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pro_coupon_user
        UNIQUE (coupon_id, telegram_user_id),

    CONSTRAINT uq_pro_coupon_purchase
        UNIQUE (purchase_request_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_discount_redemptions_user
    ON pro_discount_redemptions(telegram_user_id);

INSERT INTO system_settings (
    setting_key,
    setting_value,
    value_type,
    category,
    description
)
VALUES (
    'pro.extra_discount_percent',
    '0',
    'number',
    'pro',
    'درصد تخفیف عمومی اضافه برای اشتراک Pro'
)
ON CONFLICT (setting_key) DO NOTHING;

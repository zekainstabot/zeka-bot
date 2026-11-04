CREATE TABLE IF NOT EXISTS pro_discount_redemption_history (
    id BIGSERIAL PRIMARY KEY,

    coupon_id BIGINT NOT NULL
        REFERENCES pro_discount_coupons(id),

    purchase_request_id BIGINT NOT NULL UNIQUE
        REFERENCES pro_purchase_requests(id),

    telegram_user_id BIGINT NOT NULL,

    discount_percent INTEGER NOT NULL
        CHECK (discount_percent BETWEEN 1 AND 90),

    purchase_status VARCHAR(20) NOT NULL
        CHECK (
            purchase_status IN ('REJECTED', 'CANCELLED')
        ),

    redemption_created_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_coupon_history_coupon
    ON pro_discount_redemption_history(
        coupon_id,
        released_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_pro_coupon_history_user
    ON pro_discount_redemption_history(telegram_user_id);

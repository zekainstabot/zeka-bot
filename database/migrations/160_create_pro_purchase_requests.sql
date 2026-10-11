
CREATE TABLE IF NOT EXISTS pro_purchase_requests (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    username TEXT,
    display_name TEXT,
    duration_months INTEGER NOT NULL
        CHECK (duration_months IN (1, 2, 3, 6, 12)),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by BIGINT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_purchase_requests_status
    ON pro_purchase_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_purchase_requests_user
    ON pro_purchase_requests(telegram_user_id, created_at DESC);

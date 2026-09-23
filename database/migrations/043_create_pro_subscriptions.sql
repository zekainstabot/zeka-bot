CREATE TABLE IF NOT EXISTS pro_subscriptions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    subscription_id VARCHAR(50) NOT NULL UNIQUE,

    plan_type VARCHAR(30) NOT NULL,

    duration_months INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    starts_at TIMESTAMPTZ NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    cancelled_at TIMESTAMPTZ,

    source_type VARCHAR(30),

    source_id BIGINT,

    price NUMERIC(14,2) NOT NULL DEFAULT 0,

    currency VARCHAR(10),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_user_id
    ON pro_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_subscription_id
    ON pro_subscriptions(subscription_id);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_plan_type
    ON pro_subscriptions(plan_type);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_status
    ON pro_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_starts_at
    ON pro_subscriptions(starts_at);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_expires_at
    ON pro_subscriptions(expires_at);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_source
    ON pro_subscriptions(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_user_status
    ON pro_subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS credit_packages (
    id BIGSERIAL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    payment_id VARCHAR(64) NOT NULL UNIQUE,

    payment_type VARCHAR(30) NOT NULL DEFAULT 'CREDIT_PURCHASE',

    provider VARCHAR(50),

    provider_payment_id VARCHAR(150),

    package_id BIGINT
        REFERENCES credit_packages(id)
        ON DELETE SET NULL,

    pro_plan_id BIGINT
        REFERENCES pro_plans(id)
        ON DELETE SET NULL,

    amount NUMERIC(18,2) NOT NULL DEFAULT 0,

    currency VARCHAR(10) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    payment_url TEXT,

    paid_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    failure_reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id
    ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_id
    ON payments(payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_provider
    ON payments(provider);

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id
    ON payments(provider, provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_package_id
    ON payments(package_id);

CREATE INDEX IF NOT EXISTS idx_payments_pro_plan_id
    ON payments(pro_plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_currency
    ON payments(currency);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at
    ON payments(paid_at);

CREATE INDEX IF NOT EXISTS idx_payments_expires_at
    ON payments(expires_at);

CREATE INDEX IF NOT EXISTS idx_payments_user_status
    ON payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_created_at
    ON payments(created_at);

CREATE TABLE IF NOT EXISTS pro_plans (
    id BIGSERIAL PRIMARY KEY,

    plan_key VARCHAR(50) NOT NULL UNIQUE,

    title_key VARCHAR(150) NOT NULL,

    description_key VARCHAR(200),

    duration_months INTEGER NOT NULL,

    price NUMERIC(14,2) NOT NULL DEFAULT 0,

    currency VARCHAR(10) NOT NULL DEFAULT 'IRT',

    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    features JSONB,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_plans_key
    ON pro_plans(plan_key);

CREATE INDEX IF NOT EXISTS idx_pro_plans_duration
    ON pro_plans(duration_months);

CREATE INDEX IF NOT EXISTS idx_pro_plans_status
    ON pro_plans(status);

CREATE INDEX IF NOT EXISTS idx_pro_plans_price
    ON pro_plans(price);

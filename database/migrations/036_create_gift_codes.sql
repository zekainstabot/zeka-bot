CREATE TABLE IF NOT EXISTS gift_codes (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_amount INTEGER NOT NULL DEFAULT 0,

    pro_days INTEGER NOT NULL DEFAULT 0,

    max_uses INTEGER,

    used_count INTEGER NOT NULL DEFAULT 0,

    per_user_limit INTEGER NOT NULL DEFAULT 1,

    starts_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT REFERENCES users(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_codes_code
    ON gift_codes(code);

CREATE INDEX IF NOT EXISTS idx_gift_codes_status
    ON gift_codes(status);

CREATE INDEX IF NOT EXISTS idx_gift_codes_starts_at
    ON gift_codes(starts_at);

CREATE INDEX IF NOT EXISTS idx_gift_codes_expires_at
    ON gift_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_gift_codes_created_by
    ON gift_codes(created_by);

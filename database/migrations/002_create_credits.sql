CREATE TABLE IF NOT EXISTS credit_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    credit_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    source VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT credit_accounts_amount_check
        CHECK (amount >= 0),

    CONSTRAINT credit_accounts_remaining_check
        CHECK (remaining_amount >= 0),

    CONSTRAINT credit_accounts_remaining_limit_check
        CHECK (remaining_amount <= amount)
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_user_id
    ON credit_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_expiration
    ON credit_accounts(expires_at);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_consumption
    ON credit_accounts(user_id, expires_at, remaining_amount);

CREATE TABLE IF NOT EXISTS xp_transactions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    amount INTEGER NOT NULL,

    source_type VARCHAR(50) NOT NULL,

    source_id BIGINT,

    balance_before INTEGER NOT NULL DEFAULT 0,

    balance_after INTEGER NOT NULL DEFAULT 0,

    description TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id
    ON xp_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_source
    ON xp_transactions(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at
    ON xp_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_created
    ON xp_transactions(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_source
    ON xp_transactions(user_id, source_type);

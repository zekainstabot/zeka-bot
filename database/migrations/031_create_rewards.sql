CREATE TABLE IF NOT EXISTS rewards (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reward_id VARCHAR(32) NOT NULL UNIQUE,

    reward_type VARCHAR(30) NOT NULL,

    source_type VARCHAR(30),

    source_id BIGINT,

    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_amount INTEGER NOT NULL DEFAULT 0,

    pro_days INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'GRANTED',

    expires_at TIMESTAMPTZ,

    claimed_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_id
    ON rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_rewards_reward_id
    ON rewards(reward_id);

CREATE INDEX IF NOT EXISTS idx_rewards_type
    ON rewards(reward_type);

CREATE INDEX IF NOT EXISTS idx_rewards_source
    ON rewards(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_rewards_status
    ON rewards(status);

CREATE INDEX IF NOT EXISTS idx_rewards_expires_at
    ON rewards(expires_at);

CREATE INDEX IF NOT EXISTS idx_rewards_created_at
    ON rewards(created_at);

CREATE INDEX IF NOT EXISTS idx_rewards_user_created
    ON rewards(user_id, created_at);

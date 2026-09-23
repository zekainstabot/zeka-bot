CREATE TABLE IF NOT EXISTS luck_attempts (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reward_id BIGINT REFERENCES rewards(id)
        ON DELETE SET NULL,

    result_type VARCHAR(30) NOT NULL,

    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_amount INTEGER NOT NULL DEFAULT 0,

    pro_reward BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luck_attempts_user_id
    ON luck_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_luck_attempts_reward_id
    ON luck_attempts(reward_id);

CREATE INDEX IF NOT EXISTS idx_luck_attempts_result_type
    ON luck_attempts(result_type);

CREATE INDEX IF NOT EXISTS idx_luck_attempts_created_at
    ON luck_attempts(created_at);

CREATE INDEX IF NOT EXISTS idx_luck_attempts_user_created
    ON luck_attempts(user_id, created_at);

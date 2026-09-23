CREATE TABLE IF NOT EXISTS daily_rewards (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reward_id BIGINT REFERENCES rewards(id)
        ON DELETE SET NULL,

    reward_date DATE NOT NULL,

    streak_days INTEGER NOT NULL DEFAULT 0,

    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_amount INTEGER NOT NULL DEFAULT 0,

    pro_reward BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id
    ON daily_rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_reward_id
    ON daily_rewards(reward_id);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_reward_date
    ON daily_rewards(reward_date);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_date
    ON daily_rewards(user_id, reward_date);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_streak
    ON daily_rewards(user_id, streak_days);

CREATE TABLE IF NOT EXISTS achievements (
    id BIGSERIAL PRIMARY KEY,

    achievement_key VARCHAR(100) NOT NULL UNIQUE,

    title_key VARCHAR(150) NOT NULL,

    description_key VARCHAR(200),

    achievement_type VARCHAR(30) NOT NULL DEFAULT 'GENERAL',

    condition_type VARCHAR(50) NOT NULL,

    condition_value NUMERIC(12,2) NOT NULL DEFAULT 1,

    credit_reward NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_reward INTEGER NOT NULL DEFAULT 0,

    pro_days INTEGER NOT NULL DEFAULT 0,

    gift_code_id BIGINT REFERENCES gift_codes(id)
        ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,

    config JSONB,

    created_by BIGINT REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_key
    ON achievements(achievement_key);

CREATE INDEX IF NOT EXISTS idx_achievements_type
    ON achievements(achievement_type);

CREATE INDEX IF NOT EXISTS idx_achievements_condition_type
    ON achievements(condition_type);

CREATE INDEX IF NOT EXISTS idx_achievements_status
    ON achievements(status);

CREATE INDEX IF NOT EXISTS idx_achievements_hidden
    ON achievements(is_hidden);

CREATE INDEX IF NOT EXISTS idx_achievements_created_by
    ON achievements(created_by);

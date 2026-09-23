CREATE TABLE IF NOT EXISTS user_achievements (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    achievement_id BIGINT NOT NULL
        REFERENCES achievements(id)
        ON DELETE CASCADE,

    progress NUMERIC(12,2) NOT NULL DEFAULT 0,

    target_value NUMERIC(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    unlocked_at TIMESTAMPTZ,

    claimed_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
    ON user_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id
    ON user_achievements(achievement_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_status
    ON user_achievements(status);

CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at
    ON user_achievements(unlocked_at);

CREATE INDEX IF NOT EXISTS idx_user_achievements_claimed_at
    ON user_achievements(claimed_at);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_status
    ON user_achievements(user_id, status);

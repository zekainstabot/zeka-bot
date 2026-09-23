CREATE TABLE IF NOT EXISTS user_missions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    mission_id BIGINT NOT NULL
        REFERENCES missions(id)
        ON DELETE CASCADE,

    progress NUMERIC(12,2) NOT NULL DEFAULT 0,

    target_value NUMERIC(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    claimed_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, mission_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user_id
    ON user_missions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_missions_mission_id
    ON user_missions(mission_id);

CREATE INDEX IF NOT EXISTS idx_user_missions_status
    ON user_missions(status);

CREATE INDEX IF NOT EXISTS idx_user_missions_expires_at
    ON user_missions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_missions_user_status
    ON user_missions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_missions_mission_status
    ON user_missions(mission_id, status);

CREATE TABLE IF NOT EXISTS missions (
    id BIGSERIAL PRIMARY KEY,

    mission_key VARCHAR(100) NOT NULL UNIQUE,

    title_key VARCHAR(150) NOT NULL,
    description_key VARCHAR(200),

    mission_type VARCHAR(30) NOT NULL DEFAULT 'DAILY',

    target_type VARCHAR(50) NOT NULL,

    target_value NUMERIC(12,2) NOT NULL DEFAULT 1,

    credit_reward NUMERIC(12,2) NOT NULL DEFAULT 0,

    xp_reward INTEGER NOT NULL DEFAULT 0,

    pro_multiplier NUMERIC(6,2) NOT NULL DEFAULT 2.0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,

    config JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_key
    ON missions(mission_key);

CREATE INDEX IF NOT EXISTS idx_missions_type
    ON missions(mission_type);

CREATE INDEX IF NOT EXISTS idx_missions_target_type
    ON missions(target_type);

CREATE INDEX IF NOT EXISTS idx_missions_status
    ON missions(status);

CREATE INDEX IF NOT EXISTS idx_missions_starts_at
    ON missions(starts_at);

CREATE INDEX IF NOT EXISTS idx_missions_ends_at
    ON missions(ends_at);

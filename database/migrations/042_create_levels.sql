CREATE TABLE IF NOT EXISTS levels (
    id BIGSERIAL PRIMARY KEY,

    level_number INTEGER NOT NULL UNIQUE,

    required_xp INTEGER NOT NULL,

    title_key VARCHAR(150),

    description_key VARCHAR(200),

    credit_reward NUMERIC(12,2) NOT NULL DEFAULT 0,

    pro_days INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_levels_level_number
    ON levels(level_number);

CREATE INDEX IF NOT EXISTS idx_levels_required_xp
    ON levels(required_xp);

CREATE INDEX IF NOT EXISTS idx_levels_status
    ON levels(status);

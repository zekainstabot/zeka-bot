CREATE TABLE IF NOT EXISTS user_restrictions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    restriction_type VARCHAR(50) NOT NULL,

    level VARCHAR(30) NOT NULL DEFAULT 'NONE',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    reason VARCHAR(255),

    score INTEGER NOT NULL DEFAULT 0,

    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ,

    recovery_day INTEGER NOT NULL DEFAULT 1,

    recovery_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,

    last_event_at TIMESTAMPTZ,

    lifted_at TIMESTAMPTZ,

    lifted_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_id
    ON user_restrictions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_type
    ON user_restrictions(restriction_type);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_level
    ON user_restrictions(level);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_status
    ON user_restrictions(status);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_expires_at
    ON user_restrictions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_last_event
    ON user_restrictions(last_event_at);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_status
    ON user_restrictions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_status_expires
    ON user_restrictions(status, expires_at);

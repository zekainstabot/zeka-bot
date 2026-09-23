CREATE TABLE IF NOT EXISTS feature_flags (
    id BIGSERIAL PRIMARY KEY,

    flag_key VARCHAR(100) NOT NULL UNIQUE,

    display_name VARCHAR(150),

    description TEXT,

    flag_type VARCHAR(30) NOT NULL DEFAULT 'FEATURE',

    enabled BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    config JSONB,

    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key
    ON feature_flags(flag_key);

CREATE INDEX IF NOT EXISTS idx_feature_flags_type
    ON feature_flags(flag_type);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled
    ON feature_flags(enabled);

CREATE INDEX IF NOT EXISTS idx_feature_flags_status
    ON feature_flags(status);

CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_by
    ON feature_flags(updated_by);

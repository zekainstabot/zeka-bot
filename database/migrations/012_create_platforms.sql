CREATE TABLE IF NOT EXISTS platforms (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DEVELOPMENT',

    enabled BOOLEAN NOT NULL DEFAULT FALSE,

    priority INTEGER NOT NULL DEFAULT 0,

    max_concurrent_jobs INTEGER,
    max_jobs_per_hour INTEGER,

    supports_video BOOLEAN NOT NULL DEFAULT FALSE,
    supports_image BOOLEAN NOT NULL DEFAULT FALSE,
    supports_audio BOOLEAN NOT NULL DEFAULT FALSE,
    supports_story BOOLEAN NOT NULL DEFAULT FALSE,
    supports_profile BOOLEAN NOT NULL DEFAULT FALSE,

    adapter_version VARCHAR(30),

    settings JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platforms_status
    ON platforms(status);

CREATE INDEX IF NOT EXISTS idx_platforms_enabled
    ON platforms(enabled);

CREATE INDEX IF NOT EXISTS idx_platforms_priority
    ON platforms(priority);

CREATE TABLE IF NOT EXISTS platform_url_patterns (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    pattern_key VARCHAR(100) NOT NULL,

    path_pattern TEXT NOT NULL,

    content_type VARCHAR(50),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    supports_query_parameters BOOLEAN NOT NULL DEFAULT TRUE,

    supports_fragment BOOLEAN NOT NULL DEFAULT FALSE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        pattern_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_platform
    ON platform_url_patterns(platform);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_key
    ON platform_url_patterns(pattern_key);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_content_type
    ON platform_url_patterns(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_status
    ON platform_url_patterns(status);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_enabled
    ON platform_url_patterns(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_priority
    ON platform_url_patterns(priority);

CREATE INDEX IF NOT EXISTS idx_platform_url_patterns_platform_status
    ON platform_url_patterns(platform, status);

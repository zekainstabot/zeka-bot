CREATE TABLE IF NOT EXISTS platform_rate_limits (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100),

    limit_type VARCHAR(50) NOT NULL,

    scope VARCHAR(30) NOT NULL DEFAULT 'GLOBAL',

    max_requests INTEGER NOT NULL,

    window_seconds INTEGER NOT NULL,

    current_count INTEGER NOT NULL DEFAULT 0,

    reset_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    last_triggered_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        provider,
        limit_type,
        scope
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_platform
    ON platform_rate_limits(platform);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_provider
    ON platform_rate_limits(provider);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_type
    ON platform_rate_limits(limit_type);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_scope
    ON platform_rate_limits(scope);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_status
    ON platform_rate_limits(status);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_reset_at
    ON platform_rate_limits(reset_at);

CREATE INDEX IF NOT EXISTS idx_platform_rate_limits_platform_status
    ON platform_rate_limits(platform, status);

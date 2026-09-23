CREATE TABLE IF NOT EXISTS provider_health (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

    health_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,

    consecutive_failures INTEGER NOT NULL DEFAULT 0,

    consecutive_successes INTEGER NOT NULL DEFAULT 0,

    total_requests BIGINT NOT NULL DEFAULT 0,

    successful_requests BIGINT NOT NULL DEFAULT 0,

    failed_requests BIGINT NOT NULL DEFAULT 0,

    average_response_ms NUMERIC(12,2),

    last_success_at TIMESTAMPTZ,

    last_failure_at TIMESTAMPTZ,

    last_checked_at TIMESTAMPTZ,

    disabled_until TIMESTAMPTZ,

    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        provider
    )
);

CREATE INDEX IF NOT EXISTS idx_provider_health_platform
    ON provider_health(platform);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider
    ON provider_health(provider);

CREATE INDEX IF NOT EXISTS idx_provider_health_status
    ON provider_health(status);

CREATE INDEX IF NOT EXISTS idx_provider_health_score
    ON provider_health(health_score);

CREATE INDEX IF NOT EXISTS idx_provider_health_last_checked
    ON provider_health(last_checked_at);

CREATE INDEX IF NOT EXISTS idx_provider_health_disabled_until
    ON provider_health(disabled_until);

CREATE INDEX IF NOT EXISTS idx_provider_health_platform_status
    ON provider_health(platform, status);

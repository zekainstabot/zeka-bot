CREATE TABLE IF NOT EXISTS platform_health_checks (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100),

    check_type VARCHAR(50) NOT NULL DEFAULT 'CONNECTIVITY',

    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

    response_time_ms INTEGER,

    status_code INTEGER,

    error_type VARCHAR(100),

    error_message TEXT,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    next_check_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_platform
    ON platform_health_checks(platform);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_provider
    ON platform_health_checks(provider);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_type
    ON platform_health_checks(check_type);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_status
    ON platform_health_checks(status);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_checked_at
    ON platform_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_next_check
    ON platform_health_checks(next_check_at);

CREATE INDEX IF NOT EXISTS idx_platform_health_checks_platform_checked
    ON platform_health_checks(platform, checked_at);

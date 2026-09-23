CREATE TABLE IF NOT EXISTS platform_download_strategies (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    content_type VARCHAR(50),

    strategy_key VARCHAR(100) NOT NULL,

    provider VARCHAR(100),

    method VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    timeout_seconds INTEGER NOT NULL DEFAULT 120,

    max_attempts INTEGER NOT NULL DEFAULT 3,

    supports_resume BOOLEAN NOT NULL DEFAULT FALSE,

    supports_quality_selection BOOLEAN NOT NULL DEFAULT FALSE,

    configuration JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        content_type,
        strategy_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_platform
    ON platform_download_strategies(platform);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_content_type
    ON platform_download_strategies(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_key
    ON platform_download_strategies(strategy_key);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_provider
    ON platform_download_strategies(provider);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_method
    ON platform_download_strategies(method);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_status
    ON platform_download_strategies(status);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_enabled
    ON platform_download_strategies(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_priority
    ON platform_download_strategies(priority);

CREATE INDEX IF NOT EXISTS idx_platform_download_strategies_platform_status
    ON platform_download_strategies(platform, status);

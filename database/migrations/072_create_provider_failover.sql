CREATE TABLE IF NOT EXISTS provider_failover (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100) NOT NULL,

    fallback_provider VARCHAR(100) NOT NULL,

    priority INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    trigger_type VARCHAR(50) NOT NULL DEFAULT 'HEALTH',

    failure_threshold INTEGER NOT NULL DEFAULT 3,

    recovery_threshold INTEGER NOT NULL DEFAULT 2,

    cooldown_seconds INTEGER NOT NULL DEFAULT 300,

    last_failover_at TIMESTAMPTZ,

    last_recovery_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        provider,
        fallback_provider
    )
);

CREATE INDEX IF NOT EXISTS idx_provider_failover_platform
    ON provider_failover(platform);

CREATE INDEX IF NOT EXISTS idx_provider_failover_provider
    ON provider_failover(provider);

CREATE INDEX IF NOT EXISTS idx_provider_failover_fallback
    ON provider_failover(fallback_provider);

CREATE INDEX IF NOT EXISTS idx_provider_failover_priority
    ON provider_failover(priority);

CREATE INDEX IF NOT EXISTS idx_provider_failover_status
    ON provider_failover(status);

CREATE INDEX IF NOT EXISTS idx_provider_failover_trigger
    ON provider_failover(trigger_type);

CREATE INDEX IF NOT EXISTS idx_provider_failover_last_failover
    ON provider_failover(last_failover_at);

CREATE INDEX IF NOT EXISTS idx_provider_failover_platform_status
    ON provider_failover(platform, status);

CREATE TABLE IF NOT EXISTS download_strategy_overrides (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    content_type VARCHAR(50),

    strategy_key VARCHAR(100),

    provider VARCHAR(100),

    method VARCHAR(50),

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    conditions JSONB,

    configuration JSONB,

    expires_at TIMESTAMPTZ,

    reason TEXT,

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_platform
    ON download_strategy_overrides(platform);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_content
    ON download_strategy_overrides(content_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_strategy
    ON download_strategy_overrides(strategy_key);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_provider
    ON download_strategy_overrides(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_method
    ON download_strategy_overrides(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_enabled
    ON download_strategy_overrides(enabled);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_priority
    ON download_strategy_overrides(priority);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_expires
    ON download_strategy_overrides(expires_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_overrides_created
    ON download_strategy_overrides(created_at);

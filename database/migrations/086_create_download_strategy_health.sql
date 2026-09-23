CREATE TABLE IF NOT EXISTS download_strategy_health (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    provider VARCHAR(100),

    method VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',

    score NUMERIC(6,3),

    consecutive_failures INTEGER NOT NULL DEFAULT 0,

    consecutive_successes INTEGER NOT NULL DEFAULT 0,

    last_success_at TIMESTAMPTZ,

    last_failure_at TIMESTAMPTZ,

    last_checked_at TIMESTAMPTZ,

    disabled_until TIMESTAMPTZ,

    reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        strategy_id,
        provider,
        method
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_strategy
    ON download_strategy_health(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_provider
    ON download_strategy_health(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_method
    ON download_strategy_health(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_status
    ON download_strategy_health(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_score
    ON download_strategy_health(score);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checked
    ON download_strategy_health(last_checked_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_disabled
    ON download_strategy_health(disabled_until);

CREATE TABLE IF NOT EXISTS download_strategy_health_checks (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    provider VARCHAR(100),

    method VARCHAR(50),

    check_type VARCHAR(50) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    response_status INTEGER,

    duration_ms INTEGER,

    error_type VARCHAR(100),

    error_code VARCHAR(100),

    error_message TEXT,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_strategy
    ON download_strategy_health_checks(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_provider
    ON download_strategy_health_checks(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_method
    ON download_strategy_health_checks(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_type
    ON download_strategy_health_checks(check_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_status
    ON download_strategy_health_checks(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_checked
    ON download_strategy_health_checks(checked_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_health_checks_created
    ON download_strategy_health_checks(created_at);

CREATE TABLE IF NOT EXISTS download_strategy_metrics (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    provider VARCHAR(100),

    method VARCHAR(50),

    period_start TIMESTAMPTZ NOT NULL,

    period_end TIMESTAMPTZ NOT NULL,

    total_attempts INTEGER NOT NULL DEFAULT 0,

    successful_attempts INTEGER NOT NULL DEFAULT 0,

    failed_attempts INTEGER NOT NULL DEFAULT 0,

    retryable_failures INTEGER NOT NULL DEFAULT 0,

    average_duration_ms INTEGER,

    min_duration_ms INTEGER,

    max_duration_ms INTEGER,

    total_output_bytes BIGINT NOT NULL DEFAULT 0,

    success_rate NUMERIC(6,3),

    failure_rate NUMERIC(6,3),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        strategy_id,
        provider,
        method,
        period_start,
        period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_strategy
    ON download_strategy_metrics(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_provider
    ON download_strategy_metrics(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_method
    ON download_strategy_metrics(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_period
    ON download_strategy_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_success_rate
    ON download_strategy_metrics(success_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_failure_rate
    ON download_strategy_metrics(failure_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_metrics_created
    ON download_strategy_metrics(created_at);

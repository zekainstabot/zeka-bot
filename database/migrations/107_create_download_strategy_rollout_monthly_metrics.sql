CREATE TABLE IF NOT EXISTS download_strategy_rollout_monthly_metrics (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    period_start DATE NOT NULL,

    period_end DATE NOT NULL,

    total_assignments INTEGER NOT NULL DEFAULT 0,

    total_events INTEGER NOT NULL DEFAULT 0,

    successful_events INTEGER NOT NULL DEFAULT 0,

    failed_events INTEGER NOT NULL DEFAULT 0,

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
        rollout_id,
        period_start,
        period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_monthly_metrics_rollout
    ON download_strategy_rollout_monthly_metrics(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_monthly_metrics_period
    ON download_strategy_rollout_monthly_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_monthly_metrics_success_rate
    ON download_strategy_rollout_monthly_metrics(success_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_monthly_metrics_failure_rate
    ON download_strategy_rollout_monthly_metrics(failure_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_monthly_metrics_created
    ON download_strategy_rollout_monthly_metrics(created_at);

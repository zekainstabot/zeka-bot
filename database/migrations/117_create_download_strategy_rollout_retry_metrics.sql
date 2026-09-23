CREATE TABLE IF NOT EXISTS download_strategy_rollout_retry_metrics (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    total_events INTEGER NOT NULL DEFAULT 0,

    retried_events INTEGER NOT NULL DEFAULT 0,

    successful_after_retry INTEGER NOT NULL DEFAULT 0,

    failed_after_retry INTEGER NOT NULL DEFAULT 0,

    average_retry_count NUMERIC(8,3),

    max_retry_count INTEGER NOT NULL DEFAULT 0,

    retry_success_rate NUMERIC(6,3),

    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_retry_metrics_rollout
    ON download_strategy_rollout_retry_metrics(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_retry_metrics_measured
    ON download_strategy_rollout_retry_metrics(measured_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_retry_metrics_success_rate
    ON download_strategy_rollout_retry_metrics(retry_success_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_retry_metrics_created
    ON download_strategy_rollout_retry_metrics(created_at);

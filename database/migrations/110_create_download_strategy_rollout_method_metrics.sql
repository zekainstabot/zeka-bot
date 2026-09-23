CREATE TABLE IF NOT EXISTS download_strategy_rollout_method_metrics (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    method VARCHAR(50) NOT NULL,

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

    last_success_at TIMESTAMPTZ,

    last_failure_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        rollout_id,
        method
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_rollout
    ON download_strategy_rollout_method_metrics(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_method
    ON download_strategy_rollout_method_metrics(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_success_rate
    ON download_strategy_rollout_method_metrics(success_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_failure_rate
    ON download_strategy_rollout_method_metrics(failure_rate);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_last_success
    ON download_strategy_rollout_method_metrics(last_success_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_last_failure
    ON download_strategy_rollout_method_metrics(last_failure_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_method_metrics_created
    ON download_strategy_rollout_method_metrics(created_at);

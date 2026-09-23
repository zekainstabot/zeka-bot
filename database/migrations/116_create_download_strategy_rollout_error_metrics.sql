CREATE TABLE IF NOT EXISTS download_strategy_rollout_error_metrics (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    error_type VARCHAR(100) NOT NULL,

    error_code VARCHAR(100),

    total_events INTEGER NOT NULL DEFAULT 0,

    retryable_events INTEGER NOT NULL DEFAULT 0,

    non_retryable_events INTEGER NOT NULL DEFAULT 0,

    first_occurred_at TIMESTAMPTZ,

    last_occurred_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        rollout_id,
        error_type,
        error_code
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_rollout
    ON download_strategy_rollout_error_metrics(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_type
    ON download_strategy_rollout_error_metrics(error_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_code
    ON download_strategy_rollout_error_metrics(error_code);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_retryable
    ON download_strategy_rollout_error_metrics(retryable_events);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_last
    ON download_strategy_rollout_error_metrics(last_occurred_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_error_metrics_created
    ON download_strategy_rollout_error_metrics(created_at);

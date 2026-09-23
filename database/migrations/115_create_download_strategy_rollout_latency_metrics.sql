CREATE TABLE IF NOT EXISTS download_strategy_rollout_latency_metrics (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    total_events INTEGER NOT NULL DEFAULT 0,

    successful_events INTEGER NOT NULL DEFAULT 0,

    failed_events INTEGER NOT NULL DEFAULT 0,

    p50_duration_ms INTEGER,

    p75_duration_ms INTEGER,

    p90_duration_ms INTEGER,

    p95_duration_ms INTEGER,

    p99_duration_ms INTEGER,

    average_duration_ms INTEGER,

    min_duration_ms INTEGER,

    max_duration_ms INTEGER,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_latency_metrics_rollout
    ON download_strategy_rollout_latency_metrics(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_latency_metrics_measured
    ON download_strategy_rollout_latency_metrics(measured_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_latency_metrics_created
    ON download_strategy_rollout_latency_metrics(created_at);

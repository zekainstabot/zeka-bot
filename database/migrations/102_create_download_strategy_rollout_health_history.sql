CREATE TABLE IF NOT EXISTS download_strategy_rollout_health_history (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL,

    score NUMERIC(6,3),

    total_events INTEGER NOT NULL DEFAULT 0,

    successful_events INTEGER NOT NULL DEFAULT 0,

    failed_events INTEGER NOT NULL DEFAULT 0,

    consecutive_failures INTEGER NOT NULL DEFAULT 0,

    consecutive_successes INTEGER NOT NULL DEFAULT 0,

    last_success_at TIMESTAMPTZ,

    last_failure_at TIMESTAMPTZ,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_history_rollout
    ON download_strategy_rollout_health_history(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_history_status
    ON download_strategy_rollout_health_history(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_history_score
    ON download_strategy_rollout_health_history(score);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_history_checked
    ON download_strategy_rollout_health_history(checked_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_history_created
    ON download_strategy_rollout_health_history(created_at);

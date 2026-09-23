CREATE TABLE IF NOT EXISTS download_strategy_rollout_health (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',

    score NUMERIC(6,3),

    total_events INTEGER NOT NULL DEFAULT 0,

    successful_events INTEGER NOT NULL DEFAULT 0,

    failed_events INTEGER NOT NULL DEFAULT 0,

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

    UNIQUE (rollout_id)
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_rollout
    ON download_strategy_rollout_health(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_status
    ON download_strategy_rollout_health(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_score
    ON download_strategy_rollout_health(score);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_checked
    ON download_strategy_rollout_health(last_checked_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_health_disabled
    ON download_strategy_rollout_health(disabled_until);

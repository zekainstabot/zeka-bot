CREATE TABLE IF NOT EXISTS download_strategy_rollout_circuit_history (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    state VARCHAR(20) NOT NULL,

    failure_count INTEGER NOT NULL DEFAULT 0,

    success_count INTEGER NOT NULL DEFAULT 0,

    failure_threshold INTEGER NOT NULL DEFAULT 5,

    success_threshold INTEGER NOT NULL DEFAULT 2,

    opened_at TIMESTAMPTZ,

    half_opened_at TIMESTAMPTZ,

    closed_at TIMESTAMPTZ,

    next_retry_at TIMESTAMPTZ,

    cooldown_seconds INTEGER NOT NULL DEFAULT 300,

    reason TEXT,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_history_rollout
    ON download_strategy_rollout_circuit_history(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_history_state
    ON download_strategy_rollout_circuit_history(state);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_history_recorded
    ON download_strategy_rollout_circuit_history(recorded_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_history_next_retry
    ON download_strategy_rollout_circuit_history(next_retry_at);

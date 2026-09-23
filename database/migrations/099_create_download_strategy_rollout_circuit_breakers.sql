CREATE TABLE IF NOT EXISTS download_strategy_rollout_circuit_breakers (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',

    failure_threshold INTEGER NOT NULL DEFAULT 5,

    success_threshold INTEGER NOT NULL DEFAULT 2,

    failure_count INTEGER NOT NULL DEFAULT 0,

    success_count INTEGER NOT NULL DEFAULT 0,

    opened_at TIMESTAMPTZ,

    half_opened_at TIMESTAMPTZ,

    closed_at TIMESTAMPTZ,

    next_retry_at TIMESTAMPTZ,

    cooldown_seconds INTEGER NOT NULL DEFAULT 300,

    reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (rollout_id)
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_rollout
    ON download_strategy_rollout_circuit_breakers(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_state
    ON download_strategy_rollout_circuit_breakers(state);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_next_retry
    ON download_strategy_rollout_circuit_breakers(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_circuit_opened
    ON download_strategy_rollout_circuit_breakers(opened_at);

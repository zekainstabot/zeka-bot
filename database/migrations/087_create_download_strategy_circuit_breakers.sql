CREATE TABLE IF NOT EXISTS download_strategy_circuit_breakers (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    provider VARCHAR(100),

    method VARCHAR(50),

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

    UNIQUE (
        strategy_id,
        provider,
        method
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_strategy
    ON download_strategy_circuit_breakers(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_provider
    ON download_strategy_circuit_breakers(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_method
    ON download_strategy_circuit_breakers(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_state
    ON download_strategy_circuit_breakers(state);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_next_retry
    ON download_strategy_circuit_breakers(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_circuit_opened
    ON download_strategy_circuit_breakers(opened_at);

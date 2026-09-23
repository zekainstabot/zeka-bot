CREATE TABLE IF NOT EXISTS download_strategy_fallbacks (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    fallback_strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    priority INTEGER NOT NULL DEFAULT 0,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    trigger_type VARCHAR(50) NOT NULL DEFAULT 'FAILURE',

    max_attempts INTEGER NOT NULL DEFAULT 1,

    cooldown_seconds INTEGER NOT NULL DEFAULT 0,

    conditions JSONB,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        strategy_id,
        fallback_strategy_id
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_fallbacks_strategy
    ON download_strategy_fallbacks(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_fallbacks_fallback
    ON download_strategy_fallbacks(fallback_strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_fallbacks_priority
    ON download_strategy_fallbacks(strategy_id, priority);

CREATE INDEX IF NOT EXISTS idx_download_strategy_fallbacks_enabled
    ON download_strategy_fallbacks(enabled);

CREATE INDEX IF NOT EXISTS idx_download_strategy_fallbacks_trigger
    ON download_strategy_fallbacks(trigger_type);

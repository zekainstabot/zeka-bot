CREATE TABLE IF NOT EXISTS download_strategy_rollouts (
    id BIGSERIAL PRIMARY KEY,

    strategy_id BIGINT NOT NULL
        REFERENCES platform_download_strategies(id)
        ON DELETE CASCADE,

    platform VARCHAR(30),

    content_type VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    rollout_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    target_conditions JSONB,

    starts_at TIMESTAMPTZ,

    ends_at TIMESTAMPTZ,

    reason TEXT,

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_strategy
    ON download_strategy_rollouts(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_platform
    ON download_strategy_rollouts(platform);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_content
    ON download_strategy_rollouts(content_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_status
    ON download_strategy_rollouts(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_starts
    ON download_strategy_rollouts(starts_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollouts_ends
    ON download_strategy_rollouts(ends_at);

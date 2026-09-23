CREATE TABLE IF NOT EXISTS download_strategy_experiments (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    description TEXT,

    platform VARCHAR(30),

    content_type VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    traffic_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    control_strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    variant_strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    starts_at TIMESTAMPTZ,

    ends_at TIMESTAMPTZ,

    configuration JSONB,

    created_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_platform
    ON download_strategy_experiments(platform);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_content
    ON download_strategy_experiments(content_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_status
    ON download_strategy_experiments(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_control
    ON download_strategy_experiments(control_strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_variant
    ON download_strategy_experiments(variant_strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_starts
    ON download_strategy_experiments(starts_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiments_ends
    ON download_strategy_experiments(ends_at);

CREATE TABLE IF NOT EXISTS download_strategy_selection_logs (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    selected_strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    platform VARCHAR(30),

    content_type VARCHAR(50),

    provider VARCHAR(100),

    method VARCHAR(50),

    selection_reason VARCHAR(100),

    selection_score NUMERIC(10,3),

    priority INTEGER,

    was_fallback BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_job
    ON download_strategy_selection_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_strategy
    ON download_strategy_selection_logs(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_selected
    ON download_strategy_selection_logs(selected_strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_platform
    ON download_strategy_selection_logs(platform);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_content
    ON download_strategy_selection_logs(content_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_provider
    ON download_strategy_selection_logs(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_fallback
    ON download_strategy_selection_logs(was_fallback);

CREATE INDEX IF NOT EXISTS idx_download_strategy_selection_logs_created
    ON download_strategy_selection_logs(created_at);

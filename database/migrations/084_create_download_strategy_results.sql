CREATE TABLE IF NOT EXISTS download_strategy_results (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    attempt_id BIGINT
        REFERENCES download_strategy_attempts(id)
        ON DELETE SET NULL,

    strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    provider VARCHAR(100),

    method VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',

    output_path TEXT,

    output_url TEXT,

    output_size_bytes BIGINT,

    content_type VARCHAR(100),

    mime_type VARCHAR(100),

    duration_ms INTEGER,

    quality VARCHAR(50),

    resolution VARCHAR(50),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_job
    ON download_strategy_results(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_attempt
    ON download_strategy_results(attempt_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_strategy
    ON download_strategy_results(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_provider
    ON download_strategy_results(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_method
    ON download_strategy_results(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_status
    ON download_strategy_results(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_content_type
    ON download_strategy_results(content_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_quality
    ON download_strategy_results(quality);

CREATE INDEX IF NOT EXISTS idx_download_strategy_results_created
    ON download_strategy_results(created_at);

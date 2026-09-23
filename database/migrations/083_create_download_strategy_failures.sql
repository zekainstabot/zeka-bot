CREATE TABLE IF NOT EXISTS download_strategy_failures (
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

    error_type VARCHAR(100) NOT NULL,

    error_code VARCHAR(100),

    error_message TEXT,

    retryable BOOLEAN NOT NULL DEFAULT FALSE,

    response_status INTEGER,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_job
    ON download_strategy_failures(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_attempt
    ON download_strategy_failures(attempt_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_strategy
    ON download_strategy_failures(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_provider
    ON download_strategy_failures(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_method
    ON download_strategy_failures(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_type
    ON download_strategy_failures(error_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_code
    ON download_strategy_failures(error_code);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_retryable
    ON download_strategy_failures(retryable);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_occurred
    ON download_strategy_failures(occurred_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_failures_created
    ON download_strategy_failures(created_at);

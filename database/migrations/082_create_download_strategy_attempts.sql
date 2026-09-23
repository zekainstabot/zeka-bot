CREATE TABLE IF NOT EXISTS download_strategy_attempts (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    attempt_number INTEGER NOT NULL DEFAULT 1,

    provider VARCHAR(100),

    method VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    duration_ms INTEGER,

    retryable BOOLEAN NOT NULL DEFAULT FALSE,

    error_type VARCHAR(100),

    error_code VARCHAR(100),

    error_message TEXT,

    response_status INTEGER,

    output_size_bytes BIGINT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_job
    ON download_strategy_attempts(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_strategy
    ON download_strategy_attempts(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_attempt
    ON download_strategy_attempts(job_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_provider
    ON download_strategy_attempts(provider);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_method
    ON download_strategy_attempts(method);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_status
    ON download_strategy_attempts(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_retryable
    ON download_strategy_attempts(retryable);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_started
    ON download_strategy_attempts(started_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_attempts_created
    ON download_strategy_attempts(created_at);

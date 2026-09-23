CREATE TABLE IF NOT EXISTS platform_errors (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100),

    error_type VARCHAR(100) NOT NULL,

    error_code VARCHAR(100),

    severity VARCHAR(30) NOT NULL DEFAULT 'ERROR',

    retryable BOOLEAN NOT NULL DEFAULT FALSE,

    http_status INTEGER,

    message TEXT,

    normalized_message TEXT,

    request_id VARCHAR(64),

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_errors_platform
    ON platform_errors(platform);

CREATE INDEX IF NOT EXISTS idx_platform_errors_provider
    ON platform_errors(provider);

CREATE INDEX IF NOT EXISTS idx_platform_errors_type
    ON platform_errors(error_type);

CREATE INDEX IF NOT EXISTS idx_platform_errors_code
    ON platform_errors(error_code);

CREATE INDEX IF NOT EXISTS idx_platform_errors_severity
    ON platform_errors(severity);

CREATE INDEX IF NOT EXISTS idx_platform_errors_retryable
    ON platform_errors(retryable);

CREATE INDEX IF NOT EXISTS idx_platform_errors_request_id
    ON platform_errors(request_id);

CREATE INDEX IF NOT EXISTS idx_platform_errors_job_id
    ON platform_errors(job_id);

CREATE INDEX IF NOT EXISTS idx_platform_errors_user_id
    ON platform_errors(user_id);

CREATE INDEX IF NOT EXISTS idx_platform_errors_occurred_at
    ON platform_errors(occurred_at);

CREATE INDEX IF NOT EXISTS idx_platform_errors_platform_occurred
    ON platform_errors(platform, occurred_at);

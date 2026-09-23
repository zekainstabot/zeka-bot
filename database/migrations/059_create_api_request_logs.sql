CREATE TABLE IF NOT EXISTS api_request_logs (
    id BIGSERIAL PRIMARY KEY,

    request_id VARCHAR(64) NOT NULL,

    service_name VARCHAR(100) NOT NULL,

    provider VARCHAR(100),

    endpoint TEXT,

    method VARCHAR(20),

    status_code INTEGER,

    success BOOLEAN NOT NULL DEFAULT FALSE,

    duration_ms INTEGER,

    retry_count INTEGER NOT NULL DEFAULT 0,

    error_type VARCHAR(100),

    error_message TEXT,

    response_size_bytes BIGINT,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_request_id
    ON api_request_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_service
    ON api_request_logs(service_name);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_provider
    ON api_request_logs(provider);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_endpoint
    ON api_request_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_status
    ON api_request_logs(status_code);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_success
    ON api_request_logs(success);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_id
    ON api_request_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_job_id
    ON api_request_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at
    ON api_request_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_service_created
    ON api_request_logs(service_name, created_at);

CREATE TABLE IF NOT EXISTS request_logs (
    id BIGSERIAL PRIMARY KEY,

    request_id BIGINT REFERENCES requests(id) ON DELETE CASCADE,
    job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,

    request_log_id VARCHAR(32),

    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(30),

    message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_request_id
    ON request_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_request_logs_job_id
    ON request_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_request_logs_user_id
    ON request_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_request_logs_event_type
    ON request_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
    ON request_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_request_logs_metadata
    ON request_logs USING GIN(metadata);

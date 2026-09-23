CREATE TABLE IF NOT EXISTS usage_records (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    platform VARCHAR(30),
    content_type VARCHAR(30),

    action_type VARCHAR(30) NOT NULL,

    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    file_size_bytes BIGINT,
    processing_time_ms BIGINT,

    success BOOLEAN NOT NULL DEFAULT FALSE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_user_id
    ON usage_records(user_id);

CREATE INDEX IF NOT EXISTS idx_usage_records_request_id
    ON usage_records(request_id);

CREATE INDEX IF NOT EXISTS idx_usage_records_job_id
    ON usage_records(job_id);

CREATE INDEX IF NOT EXISTS idx_usage_records_platform
    ON usage_records(platform);

CREATE INDEX IF NOT EXISTS idx_usage_records_action_type
    ON usage_records(action_type);

CREATE INDEX IF NOT EXISTS idx_usage_records_created_at
    ON usage_records(created_at);

CREATE INDEX IF NOT EXISTS idx_usage_records_user_created
    ON usage_records(user_id, created_at);

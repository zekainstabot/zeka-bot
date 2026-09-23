CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,

    request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    job_id VARCHAR(32) NOT NULL UNIQUE,

    platform VARCHAR(30),
    content_type VARCHAR(30),

    status VARCHAR(30) NOT NULL DEFAULT 'WAITING',

    original_url TEXT NOT NULL,
    normalized_url TEXT,

    content_id TEXT,

    estimated_cost NUMERIC(12,2),
    reserved_cost NUMERIC(12,2),
    final_cost NUMERIC(12,2),

    retry_count INTEGER NOT NULL DEFAULT 0,

    priority INTEGER NOT NULL DEFAULT 0,

    is_heavy BOOLEAN NOT NULL DEFAULT FALSE,

    started_at TIMESTAMPTZ,
    processing_at TIMESTAMPTZ,
    sending_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    error_code VARCHAR(50),
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_request_id
    ON jobs(request_id);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id
    ON jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
    ON jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_jobs_content_id
    ON jobs(content_id);

CREATE INDEX IF NOT EXISTS idx_jobs_normalized_url
    ON jobs(normalized_url);

CREATE INDEX IF NOT EXISTS idx_jobs_queue
    ON jobs(status, priority, created_at);

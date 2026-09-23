CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,

    error_code VARCHAR(50),
    error_message TEXT,

    retry_count INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    retry_after TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,

    resolved_at TIMESTAMPTZ,

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_dlq_job_id
    ON dead_letter_queue(job_id);

CREATE INDEX IF NOT EXISTS idx_dlq_request_id
    ON dead_letter_queue(request_id);

CREATE INDEX IF NOT EXISTS idx_dlq_user_id
    ON dead_letter_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_dlq_status
    ON dead_letter_queue(status);

CREATE INDEX IF NOT EXISTS idx_dlq_retry_after
    ON dead_letter_queue(retry_after);

CREATE INDEX IF NOT EXISTS idx_dlq_expires_at
    ON dead_letter_queue(expires_at);

CREATE INDEX IF NOT EXISTS idx_dlq_status_retry
    ON dead_letter_queue(status, retry_after);

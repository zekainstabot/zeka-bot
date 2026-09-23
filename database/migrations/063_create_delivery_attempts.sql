CREATE TABLE IF NOT EXISTS delivery_attempts (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL DEFAULT 1,

    delivery_type VARCHAR(30) NOT NULL DEFAULT 'TELEGRAM',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    telegram_chat_id VARCHAR(100),

    telegram_message_id VARCHAR(100),

    file_path TEXT,

    file_size_bytes BIGINT,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    duration_ms INTEGER,

    retryable BOOLEAN NOT NULL DEFAULT TRUE,

    error_type VARCHAR(100),

    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_job_id
    ON delivery_attempts(job_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_attempt_number
    ON delivery_attempts(job_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_type
    ON delivery_attempts(delivery_type);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_status
    ON delivery_attempts(status);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_chat_id
    ON delivery_attempts(telegram_chat_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_message_id
    ON delivery_attempts(telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_started_at
    ON delivery_attempts(started_at);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_created_at
    ON delivery_attempts(created_at);

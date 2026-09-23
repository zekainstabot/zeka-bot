CREATE TABLE IF NOT EXISTS history (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    platform VARCHAR(30) NOT NULL,
    content_type VARCHAR(30),

    content_id TEXT,

    original_url TEXT NOT NULL,
    normalized_url TEXT,

    title TEXT,
    description TEXT,

    quality VARCHAR(30),
    file_size_bytes BIGINT,
    duration_seconds INTEGER,

    delivered BOOLEAN NOT NULL DEFAULT FALSE,

    delivered_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_user_id
    ON history(user_id);

CREATE INDEX IF NOT EXISTS idx_history_request_id
    ON history(request_id);

CREATE INDEX IF NOT EXISTS idx_history_job_id
    ON history(job_id);

CREATE INDEX IF NOT EXISTS idx_history_content_id
    ON history(content_id);

CREATE INDEX IF NOT EXISTS idx_history_normalized_url
    ON history(normalized_url);

CREATE INDEX IF NOT EXISTS idx_history_created_at
    ON history(created_at);

CREATE INDEX IF NOT EXISTS idx_history_user_created
    ON history(user_id, created_at);

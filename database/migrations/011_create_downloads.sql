CREATE TABLE IF NOT EXISTS downloads (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    platform VARCHAR(30) NOT NULL,
    content_type VARCHAR(30),

    file_name TEXT,
    mime_type VARCHAR(100),

    file_size_bytes BIGINT,

    storage_provider VARCHAR(30) NOT NULL DEFAULT 'local',
    storage_path TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'DOWNLOADING',

    telegram_message_id BIGINT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    downloaded_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    error_code VARCHAR(50),
    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downloads_job_id
    ON downloads(job_id);

CREATE INDEX IF NOT EXISTS idx_downloads_user_id
    ON downloads(user_id);

CREATE INDEX IF NOT EXISTS idx_downloads_status
    ON downloads(status);

CREATE INDEX IF NOT EXISTS idx_downloads_storage_provider
    ON downloads(storage_provider);

CREATE INDEX IF NOT EXISTS idx_downloads_created_at
    ON downloads(created_at);

CREATE INDEX IF NOT EXISTS idx_downloads_storage_path
    ON downloads(storage_path);

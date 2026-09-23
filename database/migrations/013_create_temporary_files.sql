CREATE TABLE IF NOT EXISTS temporary_files (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    file_name TEXT NOT NULL,
    storage_provider VARCHAR(30) NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL,

    file_size_bytes BIGINT NOT NULL DEFAULT 0,

    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    is_processing BOOLEAN NOT NULL DEFAULT FALSE,
    is_sending BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    metadata JSONB,

    CONSTRAINT temporary_files_size_check
        CHECK (file_size_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_temporary_files_job_id
    ON temporary_files(job_id);

CREATE INDEX IF NOT EXISTS idx_temporary_files_user_id
    ON temporary_files(user_id);

CREATE INDEX IF NOT EXISTS idx_temporary_files_status
    ON temporary_files(status);

CREATE INDEX IF NOT EXISTS idx_temporary_files_expires_at
    ON temporary_files(expires_at);

CREATE INDEX IF NOT EXISTS idx_temporary_files_last_accessed
    ON temporary_files(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_temporary_files_cleanup
    ON temporary_files(status, is_processing, is_sending, last_accessed_at);

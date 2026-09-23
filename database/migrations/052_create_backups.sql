CREATE TABLE IF NOT EXISTS backups (
    id BIGSERIAL PRIMARY KEY,

    backup_id VARCHAR(64) NOT NULL UNIQUE,

    backup_type VARCHAR(30) NOT NULL DEFAULT 'DATABASE',

    provider VARCHAR(50),

    storage_path TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    size_bytes BIGINT,

    checksum VARCHAR(128),

    encrypted BOOLEAN NOT NULL DEFAULT TRUE,

    encryption_key_reference VARCHAR(200),

    initiated_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_backup_id
    ON backups(backup_id);

CREATE INDEX IF NOT EXISTS idx_backups_type
    ON backups(backup_type);

CREATE INDEX IF NOT EXISTS idx_backups_provider
    ON backups(provider);

CREATE INDEX IF NOT EXISTS idx_backups_status
    ON backups(status);

CREATE INDEX IF NOT EXISTS idx_backups_started_at
    ON backups(started_at);

CREATE INDEX IF NOT EXISTS idx_backups_completed_at
    ON backups(completed_at);

CREATE INDEX IF NOT EXISTS idx_backups_initiated_by
    ON backups(initiated_by);

CREATE INDEX IF NOT EXISTS idx_backups_created_at
    ON backups(created_at);

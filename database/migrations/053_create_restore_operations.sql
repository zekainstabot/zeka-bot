CREATE TABLE IF NOT EXISTS restore_operations (
    id BIGSERIAL PRIMARY KEY,

    restore_id VARCHAR(64) NOT NULL UNIQUE,

    backup_id BIGINT
        REFERENCES backups(id)
        ON DELETE SET NULL,

    restore_type VARCHAR(30) NOT NULL DEFAULT 'DATABASE',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    requested_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    approved_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    approved_at TIMESTAMPTZ,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    confirmation_required BOOLEAN NOT NULL DEFAULT TRUE,

    confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    checksum_verified BOOLEAN NOT NULL DEFAULT FALSE,

    consistency_verified BOOLEAN NOT NULL DEFAULT FALSE,

    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restore_operations_restore_id
    ON restore_operations(restore_id);

CREATE INDEX IF NOT EXISTS idx_restore_operations_backup_id
    ON restore_operations(backup_id);

CREATE INDEX IF NOT EXISTS idx_restore_operations_type
    ON restore_operations(restore_type);

CREATE INDEX IF NOT EXISTS idx_restore_operations_status
    ON restore_operations(status);

CREATE INDEX IF NOT EXISTS idx_restore_operations_requested_by
    ON restore_operations(requested_by);

CREATE INDEX IF NOT EXISTS idx_restore_operations_approved_by
    ON restore_operations(approved_by);

CREATE INDEX IF NOT EXISTS idx_restore_operations_requested_at
    ON restore_operations(requested_at);

CREATE INDEX IF NOT EXISTS idx_restore_operations_status_requested
    ON restore_operations(status, requested_at);

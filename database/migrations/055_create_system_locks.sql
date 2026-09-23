CREATE TABLE IF NOT EXISTS system_locks (
    id BIGSERIAL PRIMARY KEY,

    lock_key VARCHAR(100) NOT NULL UNIQUE,

    owner_id VARCHAR(100),

    lock_type VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ,

    released_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_locks_key
    ON system_locks(lock_key);

CREATE INDEX IF NOT EXISTS idx_system_locks_owner_id
    ON system_locks(owner_id);

CREATE INDEX IF NOT EXISTS idx_system_locks_type
    ON system_locks(lock_type);

CREATE INDEX IF NOT EXISTS idx_system_locks_status
    ON system_locks(status);

CREATE INDEX IF NOT EXISTS idx_system_locks_expires_at
    ON system_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_system_locks_status_expires
    ON system_locks(status, expires_at);

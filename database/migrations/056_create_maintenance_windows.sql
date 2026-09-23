CREATE TABLE IF NOT EXISTS maintenance_windows (
    id BIGSERIAL PRIMARY KEY,

    maintenance_id VARCHAR(64) NOT NULL UNIQUE,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

    maintenance_type VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ,

    announced_at TIMESTAMPTZ,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    restrictions JSONB,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_id
    ON maintenance_windows(maintenance_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status
    ON maintenance_windows(status);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_type
    ON maintenance_windows(maintenance_type);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_starts_at
    ON maintenance_windows(starts_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_ends_at
    ON maintenance_windows(ends_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_created_by
    ON maintenance_windows(created_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status_starts
    ON maintenance_windows(status, starts_at);

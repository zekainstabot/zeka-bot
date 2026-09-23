CREATE TABLE IF NOT EXISTS platform_status (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'DEVELOPMENT',

    reason TEXT,

    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,

    emergency_mode BOOLEAN NOT NULL DEFAULT FALSE,

    accepts_new_requests BOOLEAN NOT NULL DEFAULT FALSE,

    allows_existing_jobs BOOLEAN NOT NULL DEFAULT TRUE,

    last_health_status VARCHAR(20),

    last_health_check_at TIMESTAMPTZ,

    changed_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    changed_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_status_status
    ON platform_status(status);

CREATE INDEX IF NOT EXISTS idx_platform_status_maintenance
    ON platform_status(maintenance_mode);

CREATE INDEX IF NOT EXISTS idx_platform_status_emergency
    ON platform_status(emergency_mode);

CREATE INDEX IF NOT EXISTS idx_platform_status_accepts_requests
    ON platform_status(accepts_new_requests);

CREATE INDEX IF NOT EXISTS idx_platform_status_health
    ON platform_status(last_health_status);

CREATE INDEX IF NOT EXISTS idx_platform_status_changed_by
    ON platform_status(changed_by);

CREATE INDEX IF NOT EXISTS idx_platform_status_changed_at
    ON platform_status(changed_at);

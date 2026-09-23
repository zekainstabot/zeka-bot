CREATE TABLE IF NOT EXISTS emergency_modes (
    id BIGSERIAL PRIMARY KEY,

    mode_key VARCHAR(100) NOT NULL UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'INACTIVE',

    reason TEXT,

    restrictions JSONB,

    activated_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    activated_at TIMESTAMPTZ,

    deactivated_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    deactivated_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_key
    ON emergency_modes(mode_key);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_status
    ON emergency_modes(status);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_activated_by
    ON emergency_modes(activated_by);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_activated_at
    ON emergency_modes(activated_at);

CREATE INDEX IF NOT EXISTS idx_emergency_modes_expires_at
    ON emergency_modes(expires_at);

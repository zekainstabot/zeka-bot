CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    session_id VARCHAR(64) NOT NULL UNIQUE,

    device_type VARCHAR(30),
    device_name VARCHAR(100),

    ip_address INET,
    user_agent TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id
    ON sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status
    ON sessions(status);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_last_active
    ON sessions(last_active_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_status
    ON sessions(user_id, status);

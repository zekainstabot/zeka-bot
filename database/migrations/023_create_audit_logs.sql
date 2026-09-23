CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    admin_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,

    target_type VARCHAR(50),
    target_id BIGINT,

    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',

    ip_address INET,
    user_agent TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id
    ON audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
    ON audit_logs(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_status
    ON audit_logs(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON audit_logs(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata
    ON audit_logs USING GIN(metadata);

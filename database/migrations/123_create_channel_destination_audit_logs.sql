CREATE TABLE IF NOT EXISTS channel_destination_audit_logs (
    id BIGSERIAL PRIMARY KEY,

    destination_id BIGINT
        REFERENCES user_channel_destinations(id)
        ON DELETE SET NULL,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    action VARCHAR(50) NOT NULL,

    old_value JSONB,

    new_value JSONB,

    success BOOLEAN NOT NULL DEFAULT TRUE,

    error_type VARCHAR(100),

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_channel_destination_audit_logs_destination
    ON channel_destination_audit_logs(destination_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_audit_logs_user
    ON channel_destination_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_audit_logs_action
    ON channel_destination_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_channel_destination_audit_logs_success
    ON channel_destination_audit_logs(success);

CREATE INDEX IF NOT EXISTS idx_channel_destination_audit_logs_created
    ON channel_destination_audit_logs(created_at);

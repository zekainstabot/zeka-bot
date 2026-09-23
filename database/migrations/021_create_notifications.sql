CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    notification_id VARCHAR(32) NOT NULL UNIQUE,

    type VARCHAR(50) NOT NULL,

    title_key VARCHAR(150),
    message_key VARCHAR(200),

    data JSONB,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    is_sent BOOLEAN NOT NULL DEFAULT FALSE,

    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,

    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_notification_id
    ON notifications(notification_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
    ON notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_is_sent
    ON notifications(is_sent);

CREATE INDEX IF NOT EXISTS idx_notifications_priority
    ON notifications(priority);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_expiration
    ON notifications(expires_at);

CREATE TABLE IF NOT EXISTS required_channel_verification_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    channel_id VARCHAR(100) NOT NULL,

    status VARCHAR(30) NOT NULL,

    telegram_status VARCHAR(50),

    is_pro BOOLEAN NOT NULL DEFAULT FALSE,

    is_admin BOOLEAN NOT NULL DEFAULT FALSE,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_user
    ON required_channel_verification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_channel
    ON required_channel_verification_logs(channel_id);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_status
    ON required_channel_verification_logs(status);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_checked
    ON required_channel_verification_logs(checked_at);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_pro
    ON required_channel_verification_logs(is_pro);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_admin
    ON required_channel_verification_logs(is_admin);

CREATE INDEX IF NOT EXISTS idx_required_channel_verification_logs_created
    ON required_channel_verification_logs(created_at);

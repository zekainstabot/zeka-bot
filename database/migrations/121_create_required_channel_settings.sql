CREATE TABLE IF NOT EXISTS required_channel_settings (
    id BIGSERIAL PRIMARY KEY,

    channel_id VARCHAR(100) NOT NULL,

    channel_username VARCHAR(255),

    channel_title VARCHAR(255),

    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    invite_link TEXT,

    verification_mode VARCHAR(30) NOT NULL DEFAULT 'MEMBERSHIP',

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (channel_id)
);

CREATE INDEX IF NOT EXISTS idx_required_channel_settings_enabled
    ON required_channel_settings(is_enabled);

CREATE INDEX IF NOT EXISTS idx_required_channel_settings_active
    ON required_channel_settings(is_active);

CREATE INDEX IF NOT EXISTS idx_required_channel_settings_username
    ON required_channel_settings(channel_username);

CREATE INDEX IF NOT EXISTS idx_required_channel_settings_created_by
    ON required_channel_settings(created_by);

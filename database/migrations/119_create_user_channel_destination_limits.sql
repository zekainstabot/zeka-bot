CREATE TABLE IF NOT EXISTS user_channel_destination_limits (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    max_active_channels INTEGER NOT NULL DEFAULT 1,

    limit_source VARCHAR(30) NOT NULL DEFAULT 'PRO',

    is_override BOOLEAN NOT NULL DEFAULT FALSE,

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_channel_destination_limits_user
    ON user_channel_destination_limits(user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_destination_limits_source
    ON user_channel_destination_limits(limit_source);

CREATE INDEX IF NOT EXISTS idx_user_channel_destination_limits_override
    ON user_channel_destination_limits(is_override);

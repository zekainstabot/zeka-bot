CREATE TABLE IF NOT EXISTS user_channel_destinations (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    channel_id VARCHAR(100) NOT NULL,

    channel_username VARCHAR(255),

    channel_title VARCHAR(255),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    bot_is_admin BOOLEAN NOT NULL DEFAULT FALSE,

    can_post_messages BOOLEAN NOT NULL DEFAULT FALSE,

    caption_template TEXT,

    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    disconnected_at TIMESTAMPTZ,

    last_verified_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        user_id,
        channel_id
    )
);

CREATE INDEX IF NOT EXISTS idx_user_channel_destinations_user
    ON user_channel_destinations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_destinations_channel
    ON user_channel_destinations(channel_id);

CREATE INDEX IF NOT EXISTS idx_user_channel_destinations_active
    ON user_channel_destinations(is_active);

CREATE INDEX IF NOT EXISTS idx_user_channel_destinations_verified
    ON user_channel_destinations(last_verified_at);

CREATE INDEX IF NOT EXISTS idx_user_channel_destinations_created
    ON user_channel_destinations(created_at);

CREATE TABLE IF NOT EXISTS user_channels (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    telegram_chat_id BIGINT NOT NULL,
    channel_title TEXT,
    channel_username TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, telegram_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_user_channels_user_active
    ON user_channels (user_id, is_active);

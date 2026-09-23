CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    language VARCHAR(5) NOT NULL DEFAULT 'fa',

    default_quality VARCHAR(20) NOT NULL DEFAULT '720p',

    delivery_mode VARCHAR(30) NOT NULL DEFAULT 'TELEGRAM',

    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    download_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    reward_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    watcher_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    system_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    quiet_hours_start TIME,
    quiet_hours_end TIME,

    auto_download_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
    ON user_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_language
    ON user_settings(language);

CREATE INDEX IF NOT EXISTS idx_user_settings_auto_download
    ON user_settings(auto_download_enabled);

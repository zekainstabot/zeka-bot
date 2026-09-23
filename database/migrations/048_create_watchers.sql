CREATE TABLE IF NOT EXISTS watchers (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    watcher_id VARCHAR(64) NOT NULL UNIQUE,

    platform VARCHAR(30) NOT NULL,

    username VARCHAR(150),

    page_id TEXT,

    page_url TEXT NOT NULL,

    normalized_url TEXT,

    display_name VARCHAR(200),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    auto_download_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    last_scan_at TIMESTAMPTZ,

    next_scan_at TIMESTAMPTZ,

    last_content_id TEXT,

    error_count INTEGER NOT NULL DEFAULT 0,

    last_error TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, platform, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_watchers_user_id
    ON watchers(user_id);

CREATE INDEX IF NOT EXISTS idx_watchers_watcher_id
    ON watchers(watcher_id);

CREATE INDEX IF NOT EXISTS idx_watchers_platform
    ON watchers(platform);

CREATE INDEX IF NOT EXISTS idx_watchers_page_id
    ON watchers(page_id);

CREATE INDEX IF NOT EXISTS idx_watchers_normalized_url
    ON watchers(normalized_url);

CREATE INDEX IF NOT EXISTS idx_watchers_status
    ON watchers(status);

CREATE INDEX IF NOT EXISTS idx_watchers_auto_download
    ON watchers(auto_download_enabled);

CREATE INDEX IF NOT EXISTS idx_watchers_next_scan
    ON watchers(next_scan_at);

CREATE INDEX IF NOT EXISTS idx_watchers_last_scan
    ON watchers(last_scan_at);

CREATE INDEX IF NOT EXISTS idx_watchers_user_status
    ON watchers(user_id, status);

CREATE INDEX IF NOT EXISTS idx_watchers_scan_schedule
    ON watchers(status, next_scan_at);

CREATE TABLE IF NOT EXISTS watched_pages (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    platform VARCHAR(30) NOT NULL,

    page_id TEXT,
    page_url TEXT NOT NULL,
    normalized_url TEXT,

    page_name TEXT,
    username TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    notify_new_posts BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_reels BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_stories BOOLEAN NOT NULL DEFAULT TRUE,

    auto_download BOOLEAN NOT NULL DEFAULT FALSE,

    last_scan_at TIMESTAMPTZ,
    next_scan_at TIMESTAMPTZ,

    last_manual_scan_at TIMESTAMPTZ,

    scan_interval_minutes INTEGER NOT NULL DEFAULT 240,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watched_pages_user_id
    ON watched_pages(user_id);

CREATE INDEX IF NOT EXISTS idx_watched_pages_platform
    ON watched_pages(platform);

CREATE INDEX IF NOT EXISTS idx_watched_pages_status
    ON watched_pages(status);

CREATE INDEX IF NOT EXISTS idx_watched_pages_page_id
    ON watched_pages(page_id);

CREATE INDEX IF NOT EXISTS idx_watched_pages_normalized_url
    ON watched_pages(normalized_url);

CREATE INDEX IF NOT EXISTS idx_watched_pages_next_scan
    ON watched_pages(next_scan_at);

CREATE INDEX IF NOT EXISTS idx_watched_pages_user_status
    ON watched_pages(user_id, status);

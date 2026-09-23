CREATE TABLE IF NOT EXISTS watcher_items (
    id BIGSERIAL PRIMARY KEY,

    watcher_id BIGINT NOT NULL
        REFERENCES watchers(id)
        ON DELETE CASCADE,

    platform VARCHAR(30) NOT NULL,

    content_id TEXT,

    content_type VARCHAR(30),

    original_url TEXT NOT NULL,

    normalized_url TEXT,

    title TEXT,

    thumbnail_url TEXT,

    published_at TIMESTAMPTZ,

    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    status VARCHAR(20) NOT NULL DEFAULT 'NEW',

    download_requested BOOLEAN NOT NULL DEFAULT FALSE,

    downloaded_at TIMESTAMPTZ,

    history_id BIGINT
        REFERENCES history(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (watcher_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_watcher_items_watcher_id
    ON watcher_items(watcher_id);

CREATE INDEX IF NOT EXISTS idx_watcher_items_platform
    ON watcher_items(platform);

CREATE INDEX IF NOT EXISTS idx_watcher_items_content_id
    ON watcher_items(content_id);

CREATE INDEX IF NOT EXISTS idx_watcher_items_normalized_url
    ON watcher_items(normalized_url);

CREATE INDEX IF NOT EXISTS idx_watcher_items_status
    ON watcher_items(status);

CREATE INDEX IF NOT EXISTS idx_watcher_items_published_at
    ON watcher_items(published_at);

CREATE INDEX IF NOT EXISTS idx_watcher_items_discovered_at
    ON watcher_items(discovered_at);

CREATE INDEX IF NOT EXISTS idx_watcher_items_history_id
    ON watcher_items(history_id);

CREATE INDEX IF NOT EXISTS idx_watcher_items_watcher_status
    ON watcher_items(watcher_id, status);

CREATE INDEX IF NOT EXISTS idx_watcher_items_watcher_discovered
    ON watcher_items(watcher_id, discovered_at);

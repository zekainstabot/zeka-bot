CREATE TABLE IF NOT EXISTS watcher_scans (
    id BIGSERIAL PRIMARY KEY,

    watcher_id BIGINT NOT NULL
        REFERENCES watchers(id)
        ON DELETE CASCADE,

    scan_id VARCHAR(64) NOT NULL UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    items_found INTEGER NOT NULL DEFAULT 0,

    new_items INTEGER NOT NULL DEFAULT 0,

    download_candidates INTEGER NOT NULL DEFAULT 0,

    error_count INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_watcher_id
    ON watcher_scans(watcher_id);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_scan_id
    ON watcher_scans(scan_id);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_status
    ON watcher_scans(status);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_started_at
    ON watcher_scans(started_at);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_completed_at
    ON watcher_scans(completed_at);

CREATE INDEX IF NOT EXISTS idx_watcher_scans_watcher_started
    ON watcher_scans(watcher_id, started_at);

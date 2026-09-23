CREATE TABLE IF NOT EXISTS collection_items (
    id BIGSERIAL PRIMARY KEY,

    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    history_id BIGINT REFERENCES history(id) ON DELETE SET NULL,

    platform VARCHAR(30) NOT NULL,
    content_type VARCHAR(30),

    content_id TEXT,

    original_url TEXT NOT NULL,
    normalized_url TEXT,

    title TEXT,
    thumbnail_url TEXT,

    position INTEGER NOT NULL DEFAULT 0,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id
    ON collection_items(collection_id);

CREATE INDEX IF NOT EXISTS idx_collection_items_user_id
    ON collection_items(user_id);

CREATE INDEX IF NOT EXISTS idx_collection_items_history_id
    ON collection_items(history_id);

CREATE INDEX IF NOT EXISTS idx_collection_items_content_id
    ON collection_items(content_id);

CREATE INDEX IF NOT EXISTS idx_collection_items_normalized_url
    ON collection_items(normalized_url);

CREATE INDEX IF NOT EXISTS idx_collection_items_position
    ON collection_items(collection_id, position);

CREATE INDEX IF NOT EXISTS idx_collection_items_created_at
    ON collection_items(created_at);

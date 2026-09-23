CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    history_id BIGINT REFERENCES history(id) ON DELETE SET NULL,

    platform VARCHAR(30) NOT NULL,
    content_type VARCHAR(30),

    content_id TEXT,

    original_url TEXT NOT NULL,
    normalized_url TEXT,

    title TEXT,
    thumbnail_url TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id
    ON favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_history_id
    ON favorites(history_id);

CREATE INDEX IF NOT EXISTS idx_favorites_content_id
    ON favorites(content_id);

CREATE INDEX IF NOT EXISTS idx_favorites_normalized_url
    ON favorites(normalized_url);

CREATE INDEX IF NOT EXISTS idx_favorites_created_at
    ON favorites(created_at);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created
    ON favorites(user_id, created_at);

CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    platform VARCHAR(30) NOT NULL,

    content_type VARCHAR(30),

    content_id VARCHAR(255),

    original_url TEXT NOT NULL,

    normalized_url TEXT,

    title TEXT,

    thumbnail_url TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favorites_user_url_unique
        UNIQUE (user_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id
    ON favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_platform
    ON favorites(platform);

CREATE INDEX IF NOT EXISTS idx_favorites_content_id
    ON favorites(content_id);

CREATE INDEX IF NOT EXISTS idx_favorites_created_at
    ON favorites(created_at DESC);

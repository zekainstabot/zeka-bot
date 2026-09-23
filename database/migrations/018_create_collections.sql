CREATE TABLE IF NOT EXISTS collections (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,

    share_token VARCHAR(100) UNIQUE,

    item_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id
    ON collections(user_id);

CREATE INDEX IF NOT EXISTS idx_collections_status
    ON collections(status);

CREATE INDEX IF NOT EXISTS idx_collections_user_status
    ON collections(user_id, status);

CREATE INDEX IF NOT EXISTS idx_collections_share_token
    ON collections(share_token);

CREATE INDEX IF NOT EXISTS idx_collections_created_at
    ON collections(created_at);

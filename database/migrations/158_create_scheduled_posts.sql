
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    telegram_chat_id BIGINT NOT NULL,
    channel_title TEXT,

    source_url TEXT NOT NULL,
    media_type VARCHAR(30),
    media_file_id TEXT,
    media_file_path TEXT,

    original_caption TEXT,
    custom_caption TEXT,

    caption_mode VARCHAR(20) NOT NULL DEFAULT 'original'
        CHECK (
            caption_mode IN (
                'original',
                'custom',
                'both',
                'none'
            )
        ),

    caption_order VARCHAR(20) NOT NULL DEFAULT 'original_first'
        CHECK (
            caption_order IN (
                'original_first',
                'custom_first'
            )
        ),

    scheduled_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'published',
                'failed',
                'cancelled'
            )
        ),

    telegram_message_id BIGINT,
    error_message TEXT,

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
    ON scheduled_posts (scheduled_at, id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status
    ON scheduled_posts (user_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_processing
    ON scheduled_posts (updated_at)
    WHERE status = 'processing';

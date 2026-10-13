CREATE TABLE IF NOT EXISTS zeka_media_queue (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL UNIQUE
        REFERENCES jobs(id) ON DELETE CASCADE,

    file_path TEXT NOT NULL,
    content_type VARCHAR(30) NOT NULL,
    original_url TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'PUBLISHED',
                'EXPIRED',
                'FAILED'
            )
        ),

    reviewed_by BIGINT,
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    published_message_id BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
        DEFAULT (NOW() + INTERVAL '14 days'),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zeka_media_queue_pending
    ON zeka_media_queue (created_at ASC)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_zeka_media_queue_expiration
    ON zeka_media_queue (expires_at ASC)
    WHERE status = 'PENDING';

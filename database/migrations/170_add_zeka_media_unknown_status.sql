ALTER TABLE zeka_media_queue
DROP CONSTRAINT IF EXISTS zeka_media_queue_status_check;

ALTER TABLE zeka_media_queue
ADD CONSTRAINT zeka_media_queue_status_check
CHECK (
    status IN (
        'PENDING',
        'PUBLISHING',
        'APPROVED',
        'REJECTED',
        'PUBLISHED',
        'EXPIRED',
        'FAILED',
        'PUBLISH_UNKNOWN'
    )
);

CREATE INDEX IF NOT EXISTS idx_zeka_media_queue_unknown
ON zeka_media_queue (updated_at DESC)
WHERE status = 'PUBLISH_UNKNOWN';

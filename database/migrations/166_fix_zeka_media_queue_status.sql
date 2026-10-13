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
        'FAILED'
    )
);

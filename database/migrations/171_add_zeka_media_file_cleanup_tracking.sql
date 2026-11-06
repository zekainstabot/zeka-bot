ALTER TABLE zeka_media_queue
ADD COLUMN IF NOT EXISTS file_deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_zeka_media_expired_cleanup
ON zeka_media_queue (expires_at ASC)
WHERE status = 'EXPIRED'
  AND file_deleted_at IS NULL;

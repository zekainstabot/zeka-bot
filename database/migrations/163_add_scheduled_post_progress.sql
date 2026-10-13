ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(30) NOT NULL DEFAULT 'queued';

ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS download_completed_at TIMESTAMPTZ;

ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS send_started_at TIMESTAMPTZ;

ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS last_stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE scheduled_posts
SET progress_stage = CASE
  WHEN status = 'published' THEN 'sent'
  WHEN status = 'failed' THEN 'failed'
  WHEN status = 'cancelled' THEN 'cancelled'
  WHEN status = 'processing' THEN 'downloading'
  ELSE 'queued'
END;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_message TEXT,
  ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMPTZ;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_progress_percent_range
  CHECK (progress_percent >= 0 AND progress_percent <= 100);

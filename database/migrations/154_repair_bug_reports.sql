CREATE TABLE IF NOT EXISTS bug_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL,
  telegram_user_id BIGINT NOT NULL,
  username TEXT NULL,
  display_name TEXT NULL,
  report TEXT NOT NULL,
  original_url TEXT NULL,
  job_id TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status
  ON bug_reports(status);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at
  ON bug_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_telegram_user_id
  ON bug_reports(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_bug_reports_job_id
  ON bug_reports(job_id);

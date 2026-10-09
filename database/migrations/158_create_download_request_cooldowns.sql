CREATE TABLE IF NOT EXISTS download_request_cooldowns (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_request_cooldowns_last_request
  ON download_request_cooldowns(last_request_at);

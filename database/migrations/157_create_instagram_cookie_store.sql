
CREATE TABLE IF NOT EXISTS instagram_cookie_store (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  encrypted_data TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

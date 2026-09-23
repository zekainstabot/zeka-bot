CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    request_id VARCHAR(32) NOT NULL UNIQUE,

    platform VARCHAR(30),
    request_type VARCHAR(30) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'WAITING',

    original_url TEXT,
    normalized_url TEXT,

    estimated_cost NUMERIC(12,2),
    final_cost NUMERIC(12,2),

    is_heavy BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    error_code VARCHAR(50),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_user_id
    ON requests(user_id);

CREATE INDEX IF NOT EXISTS idx_requests_status
    ON requests(status);

CREATE INDEX IF NOT EXISTS idx_requests_created_at
    ON requests(created_at);

CREATE INDEX IF NOT EXISTS idx_requests_normalized_url
    ON requests(normalized_url);

CREATE INDEX IF NOT EXISTS idx_requests_request_id
    ON requests(request_id);

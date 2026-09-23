CREATE TABLE IF NOT EXISTS idempotency_keys (
    id BIGSERIAL PRIMARY KEY,

    key VARCHAR(255) NOT NULL UNIQUE,

    scope VARCHAR(50) NOT NULL,

    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE CASCADE,
    job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',

    response_data JSONB,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idempotency_scope
    ON idempotency_keys(scope);

CREATE INDEX IF NOT EXISTS idx_idempotency_user_id
    ON idempotency_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_request_id
    ON idempotency_keys(request_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_job_id
    ON idempotency_keys(job_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_status
    ON idempotency_keys(status);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
    ON idempotency_keys(expires_at);

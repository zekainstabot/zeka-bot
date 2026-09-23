CREATE TABLE IF NOT EXISTS credit_requests (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    request_id VARCHAR(64) NOT NULL UNIQUE,

    requested_amount NUMERIC(12,2) NOT NULL,

    reason TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    reviewed_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    approved_amount NUMERIC(12,2),

    rejection_reason TEXT,

    credit_transaction_id BIGINT
        REFERENCES credit_ledger(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_user_id
    ON credit_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_requests_request_id
    ON credit_requests(request_id);

CREATE INDEX IF NOT EXISTS idx_credit_requests_status
    ON credit_requests(status);

CREATE INDEX IF NOT EXISTS idx_credit_requests_reviewed_by
    ON credit_requests(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_credit_requests_created_at
    ON credit_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_credit_requests_user_status
    ON credit_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_requests_status_created
    ON credit_requests(status, created_at);

CREATE TABLE IF NOT EXISTS debts (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    original_amount NUMERIC(12,2) NOT NULL,
    multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
    amount_due NUMERIC(12,2) NOT NULL,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    due_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,

    CONSTRAINT debts_original_amount_check
        CHECK (original_amount > 0),

    CONSTRAINT debts_multiplier_check
        CHECK (multiplier >= 1),

    CONSTRAINT debts_amount_due_check
        CHECK (amount_due > 0),

    CONSTRAINT debts_amount_paid_check
        CHECK (amount_paid >= 0),

    CONSTRAINT debts_paid_limit_check
        CHECK (amount_paid <= amount_due)
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id
    ON debts(user_id);

CREATE INDEX IF NOT EXISTS idx_debts_request_id
    ON debts(request_id);

CREATE INDEX IF NOT EXISTS idx_debts_job_id
    ON debts(job_id);

CREATE INDEX IF NOT EXISTS idx_debts_status
    ON debts(status);

CREATE INDEX IF NOT EXISTS idx_debts_created_at
    ON debts(created_at);

CREATE INDEX IF NOT EXISTS idx_debts_user_status
    ON debts(user_id, status);

CREATE TABLE IF NOT EXISTS credit_reservations (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credit_account_id BIGINT NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    amount NUMERIC(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',

    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT credit_reservations_amount_check
        CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id
    ON credit_reservations(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_account_id
    ON credit_reservations(credit_account_id);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_request_id
    ON credit_reservations(request_id);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_job_id
    ON credit_reservations(job_id);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_status
    ON credit_reservations(status);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_active
    ON credit_reservations(user_id, status);

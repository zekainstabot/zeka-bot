CREATE TABLE IF NOT EXISTS credit_ledger (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credit_account_id BIGINT REFERENCES credit_accounts(id) ON DELETE SET NULL,

    entry_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,

    balance_before NUMERIC(12,2),
    balance_after NUMERIC(12,2),

    reference_type VARCHAR(30),
    reference_id BIGINT,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id
    ON credit_ledger(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_account_id
    ON credit_ledger(credit_account_id);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at
    ON credit_ledger(created_at);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference
    ON credit_ledger(reference_type, reference_id);

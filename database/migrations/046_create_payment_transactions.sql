CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,

    payment_id BIGINT NOT NULL
        REFERENCES payments(id)
        ON DELETE CASCADE,

    transaction_id VARCHAR(100) NOT NULL UNIQUE,

    provider VARCHAR(50),

    provider_transaction_id VARCHAR(150),

    transaction_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    amount NUMERIC(18,2) NOT NULL DEFAULT 0,

    currency VARCHAR(10) NOT NULL,

    reference_number VARCHAR(150),

    callback_received_at TIMESTAMPTZ,

    verified_at TIMESTAMPTZ,

    failure_reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id
    ON payment_transactions(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id
    ON payment_transactions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider
    ON payment_transactions(provider);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id
    ON payment_transactions(provider, provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_type
    ON payment_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference
    ON payment_transactions(reference_number);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_callback
    ON payment_transactions(callback_received_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at
    ON payment_transactions(created_at);

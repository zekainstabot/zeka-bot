CREATE TABLE IF NOT EXISTS finance_expenses (
    id BIGSERIAL PRIMARY KEY,

    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,

    amount NUMERIC(18, 2) NOT NULL
        CHECK (amount > 0),

    currency VARCHAR(10) NOT NULL DEFAULT 'IRT',

    created_by_telegram_id BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_created_at
    ON finance_expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_category
    ON finance_expenses(category);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_creator
    ON finance_expenses(created_by_telegram_id);

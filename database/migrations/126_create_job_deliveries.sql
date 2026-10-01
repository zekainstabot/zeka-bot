CREATE TABLE IF NOT EXISTS job_deliveries (
    id BIGSERIAL PRIMARY KEY,

    job_id BIGINT NOT NULL UNIQUE
        REFERENCES jobs(id) ON DELETE CASCADE,

    telegram_chat_id BIGINT NOT NULL,

    telegram_message_id BIGINT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT job_deliveries_status_check
        CHECK (
            status IN (
                'PENDING',
                'SENT',
                'UNKNOWN',
                'FAILED'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_job_deliveries_status
    ON job_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_job_deliveries_chat_message
    ON job_deliveries(
        telegram_chat_id,
        telegram_message_id
    );


CREATE TABLE IF NOT EXISTS pro_purchase_notification_outbox (
    id BIGSERIAL PRIMARY KEY,

    purchase_request_id BIGINT NOT NULL
        REFERENCES pro_purchase_requests(id)
        ON DELETE CASCADE,

    notification_type VARCHAR(20) NOT NULL
        CHECK (notification_type IN ('APPROVED', 'REJECTED')),

    telegram_user_id BIGINT NOT NULL,

    message TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT')),

    attempts INTEGER NOT NULL DEFAULT 0,

    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    locked_at TIMESTAMPTZ,

    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    sent_at TIMESTAMPTZ,

    CONSTRAINT uq_pro_purchase_notification
        UNIQUE (purchase_request_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_pro_purchase_notification_pending
ON pro_purchase_notification_outbox (
    status,
    next_attempt_at,
    id
);

CREATE INDEX IF NOT EXISTS idx_pro_purchase_notification_request
ON pro_purchase_notification_outbox (
    purchase_request_id
);

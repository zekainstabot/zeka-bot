CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,

    event_id VARCHAR(150) NOT NULL UNIQUE,

    provider VARCHAR(100) NOT NULL,

    event_type VARCHAR(100) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',

    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,

    processing_attempts INTEGER NOT NULL DEFAULT 0,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ,

    failed_at TIMESTAMPTZ,

    next_retry_at TIMESTAMPTZ,

    error_message TEXT,

    payload JSONB,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id
    ON webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
    ON webhook_events(provider);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type
    ON webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
    ON webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
    ON webhook_events(received_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
    ON webhook_events(processed_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry
    ON webhook_events(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status
    ON webhook_events(provider, status);

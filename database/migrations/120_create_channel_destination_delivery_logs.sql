CREATE TABLE IF NOT EXISTS channel_destination_delivery_logs (
    id BIGSERIAL PRIMARY KEY,

    destination_id BIGINT NOT NULL
        REFERENCES user_channel_destinations(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    telegram_message_id BIGINT,

    file_type VARCHAR(50),

    file_size_bytes BIGINT,

    caption TEXT,

    error_type VARCHAR(100),

    error_code VARCHAR(100),

    error_message TEXT,

    attempts INTEGER NOT NULL DEFAULT 0,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_destination
    ON channel_destination_delivery_logs(destination_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_user
    ON channel_destination_delivery_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_job
    ON channel_destination_delivery_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_status
    ON channel_destination_delivery_logs(status);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_message
    ON channel_destination_delivery_logs(telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_channel_destination_delivery_logs_created
    ON channel_destination_delivery_logs(created_at);

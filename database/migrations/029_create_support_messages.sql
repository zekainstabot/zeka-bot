CREATE TABLE IF NOT EXISTS support_messages (
    id BIGSERIAL PRIMARY KEY,

    ticket_id BIGINT NOT NULL
        REFERENCES support_tickets(id)
        ON DELETE CASCADE,

    sender_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    sender_type VARCHAR(20) NOT NULL DEFAULT 'USER',

    message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',

    message TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id
    ON support_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_sender_user_id
    ON support_messages(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_sender_type
    ON support_messages(sender_type);

CREATE INDEX IF NOT EXISTS idx_support_messages_message_type
    ON support_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_support_messages_created_at
    ON support_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
    ON support_messages(ticket_id, created_at);

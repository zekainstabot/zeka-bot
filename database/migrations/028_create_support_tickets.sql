CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    ticket_id VARCHAR(32) NOT NULL UNIQUE,

    category VARCHAR(30) NOT NULL DEFAULT 'OTHER',

    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',

    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',

    subject VARCHAR(200),

    request_id BIGINT REFERENCES requests(id) ON DELETE SET NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,

    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,

    last_message_at TIMESTAMPTZ,

    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
    ON support_tickets(user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id
    ON support_tickets(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_category
    ON support_tickets(category);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority
    ON support_tickets(priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
    ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_request_id
    ON support_tickets(request_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_job_id
    ON support_tickets(job_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to
    ON support_tickets(assigned_to);

CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message
    ON support_tickets(last_message_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at
    ON support_tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
    ON support_tickets(user_id, status);

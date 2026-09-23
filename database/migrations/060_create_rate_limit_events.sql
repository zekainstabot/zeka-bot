CREATE TABLE IF NOT EXISTS rate_limit_events (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    request_id BIGINT
        REFERENCES requests(id)
        ON DELETE SET NULL,

    event_type VARCHAR(50) NOT NULL,

    action_type VARCHAR(50) NOT NULL,

    severity VARCHAR(30) NOT NULL DEFAULT 'NORMAL',

    score INTEGER NOT NULL DEFAULT 0,

    window_key VARCHAR(150),

    ip_hash VARCHAR(255),

    user_agent_hash VARCHAR(255),

    cooldown_until TIMESTAMPTZ,

    restriction_until TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user_id
    ON rate_limit_events(user_id);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_request_id
    ON rate_limit_events(request_id);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_event_type
    ON rate_limit_events(event_type);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_action_type
    ON rate_limit_events(action_type);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_severity
    ON rate_limit_events(severity);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_window_key
    ON rate_limit_events(window_key);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_cooldown
    ON rate_limit_events(cooldown_until);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_restriction
    ON rate_limit_events(restriction_until);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at
    ON rate_limit_events(created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user_created
    ON rate_limit_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user_type_created
    ON rate_limit_events(user_id, event_type, created_at);

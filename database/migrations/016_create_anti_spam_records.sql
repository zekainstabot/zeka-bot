CREATE TABLE IF NOT EXISTS anti_spam_records (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    event_type VARCHAR(30) NOT NULL,

    request_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    cancellation_count INTEGER NOT NULL DEFAULT 0,

    restriction_level VARCHAR(30) NOT NULL DEFAULT 'NONE',

    restricted_until TIMESTAMPTZ,

    cooldown_until TIMESTAMPTZ,

    recovery_day INTEGER NOT NULL DEFAULT 0,
    recovery_started_at TIMESTAMPTZ,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anti_spam_user_id
    ON anti_spam_records(user_id);

CREATE INDEX IF NOT EXISTS idx_anti_spam_event_type
    ON anti_spam_records(event_type);

CREATE INDEX IF NOT EXISTS idx_anti_spam_restriction
    ON anti_spam_records(restriction_level);

CREATE INDEX IF NOT EXISTS idx_anti_spam_restricted_until
    ON anti_spam_records(restricted_until);

CREATE INDEX IF NOT EXISTS idx_anti_spam_cooldown_until
    ON anti_spam_records(cooldown_until);

CREATE INDEX IF NOT EXISTS idx_anti_spam_user_updated
    ON anti_spam_records(user_id, updated_at);

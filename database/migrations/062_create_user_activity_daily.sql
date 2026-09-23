CREATE TABLE IF NOT EXISTS user_activity_daily (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    activity_date DATE NOT NULL,

    request_count INTEGER NOT NULL DEFAULT 0,

    successful_downloads INTEGER NOT NULL DEFAULT 0,

    failed_requests INTEGER NOT NULL DEFAULT 0,

    duplicate_requests INTEGER NOT NULL DEFAULT 0,

    cancelled_requests INTEGER NOT NULL DEFAULT 0,

    abnormal_events INTEGER NOT NULL DEFAULT 0,

    restriction_events INTEGER NOT NULL DEFAULT 0,

    active_minutes INTEGER NOT NULL DEFAULT 0,

    recovery_percent NUMERIC(5,2) NOT NULL DEFAULT 100.00,

    last_activity_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_id
    ON user_activity_daily(user_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date
    ON user_activity_daily(activity_date);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_user_date
    ON user_activity_daily(user_id, activity_date);

CREATE INDEX IF NOT EXISTS idx_user_activity_daily_last_activity
    ON user_activity_daily(last_activity_at);

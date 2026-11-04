CREATE TABLE IF NOT EXISTS admin_action_logs (
    id BIGSERIAL PRIMARY KEY,

    admin_user_id BIGINT,
    admin_telegram_user_id VARCHAR(32),

    target_user_id BIGINT,
    target_telegram_user_id VARCHAR(32),

    action VARCHAR(100) NOT NULL,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at
ON admin_action_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin
ON admin_action_logs (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target
ON admin_action_logs (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action
ON admin_action_logs (action, created_at DESC);

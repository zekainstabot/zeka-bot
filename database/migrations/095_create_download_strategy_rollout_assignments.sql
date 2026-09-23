CREATE TABLE IF NOT EXISTS download_strategy_rollout_assignments (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    session_id BIGINT
        REFERENCES sessions(id)
        ON DELETE SET NULL,

    assignment_key VARCHAR(150) NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ,

    metadata JSONB,

    UNIQUE (
        rollout_id,
        assignment_key
    )
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_rollout
    ON download_strategy_rollout_assignments(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_user
    ON download_strategy_rollout_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_session
    ON download_strategy_rollout_assignments(session_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_key
    ON download_strategy_rollout_assignments(assignment_key);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_assigned
    ON download_strategy_rollout_assignments(assigned_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_assignments_expires
    ON download_strategy_rollout_assignments(expires_at);

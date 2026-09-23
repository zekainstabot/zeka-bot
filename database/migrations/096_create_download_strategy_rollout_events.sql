CREATE TABLE IF NOT EXISTS download_strategy_rollout_events (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    assignment_id BIGINT
        REFERENCES download_strategy_rollout_assignments(id)
        ON DELETE SET NULL,

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    event_type VARCHAR(50) NOT NULL,

    success BOOLEAN,

    duration_ms INTEGER,

    output_size_bytes BIGINT,

    error_type VARCHAR(100),

    error_code VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_rollout
    ON download_strategy_rollout_events(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_assignment
    ON download_strategy_rollout_events(assignment_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_job
    ON download_strategy_rollout_events(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_strategy
    ON download_strategy_rollout_events(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_type
    ON download_strategy_rollout_events(event_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_success
    ON download_strategy_rollout_events(success);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_created
    ON download_strategy_rollout_events(created_at);

CREATE TABLE IF NOT EXISTS download_strategy_rollout_events_archive (
    id BIGSERIAL PRIMARY KEY,

    original_event_id BIGINT,

    rollout_id BIGINT
        REFERENCES download_strategy_rollouts(id)
        ON DELETE SET NULL,

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

    original_created_at TIMESTAMPTZ,

    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_original
    ON download_strategy_rollout_events_archive(original_event_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_rollout
    ON download_strategy_rollout_events_archive(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_assignment
    ON download_strategy_rollout_events_archive(assignment_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_job
    ON download_strategy_rollout_events_archive(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_strategy
    ON download_strategy_rollout_events_archive(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_type
    ON download_strategy_rollout_events_archive(event_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_success
    ON download_strategy_rollout_events_archive(success);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_created
    ON download_strategy_rollout_events_archive(original_created_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_events_archive_archived
    ON download_strategy_rollout_events_archive(archived_at);

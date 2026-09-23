CREATE TABLE IF NOT EXISTS download_strategy_rollout_alert_history (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT
        REFERENCES download_strategy_rollouts(id)
        ON DELETE SET NULL,

    alert_type VARCHAR(50) NOT NULL,

    severity VARCHAR(20) NOT NULL,

    status VARCHAR(20) NOT NULL,

    threshold NUMERIC(10,3),

    current_value NUMERIC(10,3),

    message TEXT,

    triggered_at TIMESTAMPTZ,

    acknowledged_at TIMESTAMPTZ,

    resolved_at TIMESTAMPTZ,

    acknowledged_by BIGINT,

    resolved_by BIGINT,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_rollout
    ON download_strategy_rollout_alert_history(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_type
    ON download_strategy_rollout_alert_history(alert_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_severity
    ON download_strategy_rollout_alert_history(severity);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_status
    ON download_strategy_rollout_alert_history(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_triggered
    ON download_strategy_rollout_alert_history(triggered_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alert_history_recorded
    ON download_strategy_rollout_alert_history(recorded_at);

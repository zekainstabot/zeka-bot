CREATE TABLE IF NOT EXISTS download_strategy_rollout_alerts (
    id BIGSERIAL PRIMARY KEY,

    rollout_id BIGINT NOT NULL
        REFERENCES download_strategy_rollouts(id)
        ON DELETE CASCADE,

    alert_type VARCHAR(50) NOT NULL,

    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    threshold NUMERIC(10,3),

    current_value NUMERIC(10,3),

    message TEXT,

    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    acknowledged_at TIMESTAMPTZ,

    resolved_at TIMESTAMPTZ,

    acknowledged_by BIGINT,

    resolved_by BIGINT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_rollout
    ON download_strategy_rollout_alerts(rollout_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_type
    ON download_strategy_rollout_alerts(alert_type);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_severity
    ON download_strategy_rollout_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_status
    ON download_strategy_rollout_alerts(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_triggered
    ON download_strategy_rollout_alerts(triggered_at);

CREATE INDEX IF NOT EXISTS idx_download_strategy_rollout_alerts_resolved
    ON download_strategy_rollout_alerts(resolved_at);

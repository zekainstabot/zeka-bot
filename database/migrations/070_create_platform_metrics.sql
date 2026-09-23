CREATE TABLE IF NOT EXISTS platform_metrics (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100),

    metric_type VARCHAR(50) NOT NULL,

    metric_value NUMERIC(18,6) NOT NULL DEFAULT 0,

    metric_unit VARCHAR(30),

    window_start TIMESTAMPTZ,

    window_end TIMESTAMPTZ,

    sample_count INTEGER NOT NULL DEFAULT 1,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform
    ON platform_metrics(platform);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_provider
    ON platform_metrics(provider);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_type
    ON platform_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_unit
    ON platform_metrics(metric_unit);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_window_start
    ON platform_metrics(window_start);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_window_end
    ON platform_metrics(window_end);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_created_at
    ON platform_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform_type
    ON platform_metrics(platform, metric_type);

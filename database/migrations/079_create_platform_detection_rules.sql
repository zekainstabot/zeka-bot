CREATE TABLE IF NOT EXISTS platform_detection_rules (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    rule_key VARCHAR(100) NOT NULL,

    rule_type VARCHAR(50) NOT NULL DEFAULT 'HOST',

    pattern TEXT NOT NULL,

    content_type VARCHAR(50),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    confidence NUMERIC(5,2) NOT NULL DEFAULT 100.00,

    case_sensitive BOOLEAN NOT NULL DEFAULT FALSE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        rule_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_platform
    ON platform_detection_rules(platform);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_key
    ON platform_detection_rules(rule_key);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_type
    ON platform_detection_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_content_type
    ON platform_detection_rules(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_status
    ON platform_detection_rules(status);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_enabled
    ON platform_detection_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_priority
    ON platform_detection_rules(priority);

CREATE INDEX IF NOT EXISTS idx_platform_detection_rules_platform_status
    ON platform_detection_rules(platform, status);

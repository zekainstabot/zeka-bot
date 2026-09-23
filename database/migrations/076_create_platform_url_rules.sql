CREATE TABLE IF NOT EXISTS platform_url_rules (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    rule_key VARCHAR(100) NOT NULL,

    rule_type VARCHAR(50) NOT NULL DEFAULT 'PATTERN',

    pattern TEXT NOT NULL,

    content_type VARCHAR(50),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    allow_redirect BOOLEAN NOT NULL DEFAULT FALSE,

    max_redirects INTEGER NOT NULL DEFAULT 3,

    reject_private_networks BOOLEAN NOT NULL DEFAULT TRUE,

    reject_local_hosts BOOLEAN NOT NULL DEFAULT TRUE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        rule_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_platform
    ON platform_url_rules(platform);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_key
    ON platform_url_rules(rule_key);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_type
    ON platform_url_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_content_type
    ON platform_url_rules(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_status
    ON platform_url_rules(status);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_enabled
    ON platform_url_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_priority
    ON platform_url_rules(priority);

CREATE INDEX IF NOT EXISTS idx_platform_url_rules_platform_status
    ON platform_url_rules(platform, status);

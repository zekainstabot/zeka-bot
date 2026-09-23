CREATE TABLE IF NOT EXISTS platform_url_normalization_rules (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    rule_key VARCHAR(100) NOT NULL,

    rule_type VARCHAR(50) NOT NULL DEFAULT 'NORMALIZE',

    target VARCHAR(50) NOT NULL DEFAULT 'URL',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    priority INTEGER NOT NULL DEFAULT 0,

    remove_query_parameters BOOLEAN NOT NULL DEFAULT FALSE,

    allowed_query_parameters JSONB,

    remove_fragment BOOLEAN NOT NULL DEFAULT TRUE,

    lowercase_host BOOLEAN NOT NULL DEFAULT TRUE,

    lowercase_path BOOLEAN NOT NULL DEFAULT FALSE,

    remove_trailing_slash BOOLEAN NOT NULL DEFAULT TRUE,

    preserve_path_parameters BOOLEAN NOT NULL DEFAULT FALSE,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        rule_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_platform
    ON platform_url_normalization_rules(platform);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_key
    ON platform_url_normalization_rules(rule_key);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_type
    ON platform_url_normalization_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_status
    ON platform_url_normalization_rules(status);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_enabled
    ON platform_url_normalization_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_priority
    ON platform_url_normalization_rules(priority);

CREATE INDEX IF NOT EXISTS idx_platform_url_normalization_platform_status
    ON platform_url_normalization_rules(platform, status);

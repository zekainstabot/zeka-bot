CREATE TABLE IF NOT EXISTS platform_access_policies (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    policy_key VARCHAR(100) NOT NULL,

    access_type VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    requires_authentication BOOLEAN NOT NULL DEFAULT FALSE,

    requires_pro BOOLEAN NOT NULL DEFAULT FALSE,

    allow_private_content BOOLEAN NOT NULL DEFAULT FALSE,

    allow_region_restricted BOOLEAN NOT NULL DEFAULT FALSE,

    allow_age_restricted BOOLEAN NOT NULL DEFAULT FALSE,

    priority INTEGER NOT NULL DEFAULT 0,

    configuration JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        policy_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_platform
    ON platform_access_policies(platform);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_key
    ON platform_access_policies(policy_key);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_access_type
    ON platform_access_policies(access_type);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_status
    ON platform_access_policies(status);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_enabled
    ON platform_access_policies(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_auth
    ON platform_access_policies(requires_authentication);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_pro
    ON platform_access_policies(requires_pro);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_priority
    ON platform_access_policies(priority);

CREATE INDEX IF NOT EXISTS idx_platform_access_policies_platform_status
    ON platform_access_policies(platform, status);

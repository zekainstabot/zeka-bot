CREATE TABLE IF NOT EXISTS platform_capabilities (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    capability_key VARCHAR(100) NOT NULL,

    capability_type VARCHAR(50) NOT NULL DEFAULT 'CONTENT',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    requires_pro BOOLEAN NOT NULL DEFAULT FALSE,

    max_items INTEGER,

    max_file_size_bytes BIGINT,

    configuration JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        capability_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_platform
    ON platform_capabilities(platform);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_key
    ON platform_capabilities(capability_key);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_type
    ON platform_capabilities(capability_type);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_status
    ON platform_capabilities(status);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_enabled
    ON platform_capabilities(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_pro
    ON platform_capabilities(requires_pro);

CREATE INDEX IF NOT EXISTS idx_platform_capabilities_platform_status
    ON platform_capabilities(platform, status);

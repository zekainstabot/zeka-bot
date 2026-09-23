CREATE TABLE IF NOT EXISTS platform_content_types (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    content_type VARCHAR(50) NOT NULL,

    display_name VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    default_cost NUMERIC(10,2) NOT NULL DEFAULT 0.70,

    min_cost NUMERIC(10,2),

    max_cost NUMERIC(10,2),

    supports_multiple BOOLEAN NOT NULL DEFAULT FALSE,

    supports_quality_selection BOOLEAN NOT NULL DEFAULT FALSE,

    requires_pro BOOLEAN NOT NULL DEFAULT FALSE,

    max_items INTEGER,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        content_type
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_platform
    ON platform_content_types(platform);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_type
    ON platform_content_types(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_status
    ON platform_content_types(status);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_enabled
    ON platform_content_types(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_pro
    ON platform_content_types(requires_pro);

CREATE INDEX IF NOT EXISTS idx_platform_content_types_platform_status
    ON platform_content_types(platform, status);

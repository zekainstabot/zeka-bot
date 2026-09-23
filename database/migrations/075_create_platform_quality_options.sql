CREATE TABLE IF NOT EXISTS platform_quality_options (
    id BIGSERIAL PRIMARY KEY,

    platform VARCHAR(30) NOT NULL,

    content_type VARCHAR(50) NOT NULL,

    quality_key VARCHAR(50) NOT NULL,

    display_name VARCHAR(100) NOT NULL,

    width INTEGER,

    height INTEGER,

    bitrate INTEGER,

    format VARCHAR(30),

    codec VARCHAR(50),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    requires_pro BOOLEAN NOT NULL DEFAULT FALSE,

    priority INTEGER NOT NULL DEFAULT 0,

    max_file_size_bytes BIGINT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        platform,
        content_type,
        quality_key
    )
);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_platform
    ON platform_quality_options(platform);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_content_type
    ON platform_quality_options(content_type);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_quality
    ON platform_quality_options(quality_key);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_status
    ON platform_quality_options(status);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_enabled
    ON platform_quality_options(enabled);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_pro
    ON platform_quality_options(requires_pro);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_priority
    ON platform_quality_options(priority);

CREATE INDEX IF NOT EXISTS idx_platform_quality_options_platform_type
    ON platform_quality_options(platform, content_type);

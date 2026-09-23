CREATE TABLE IF NOT EXISTS quality_profiles (
    id BIGSERIAL PRIMARY KEY,

    profile_key VARCHAR(100) NOT NULL UNIQUE,

    platform VARCHAR(30),

    content_type VARCHAR(30),

    quality_label VARCHAR(50) NOT NULL,

    resolution_width INTEGER,

    resolution_height INTEGER,

    video_format VARCHAR(30),

    audio_format VARCHAR(30),

    max_file_size_bytes BIGINT,

    pro_only BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    priority INTEGER NOT NULL DEFAULT 0,

    config JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_key
    ON quality_profiles(profile_key);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_platform
    ON quality_profiles(platform);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_content_type
    ON quality_profiles(content_type);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_resolution
    ON quality_profiles(resolution_width, resolution_height);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_pro_only
    ON quality_profiles(pro_only);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_status
    ON quality_profiles(status);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_priority
    ON quality_profiles(priority);

CREATE INDEX IF NOT EXISTS idx_quality_profiles_platform_type
    ON quality_profiles(platform, content_type, status);

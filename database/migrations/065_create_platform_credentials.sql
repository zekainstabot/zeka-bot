CREATE TABLE IF NOT EXISTS platform_credentials (
    id BIGSERIAL PRIMARY KEY,

    credential_id VARCHAR(64) NOT NULL UNIQUE,

    platform VARCHAR(30) NOT NULL,

    provider VARCHAR(100),

    credential_type VARCHAR(30) NOT NULL DEFAULT 'SESSION',

    secret_reference VARCHAR(255),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    expires_at TIMESTAMPTZ,

    last_validated_at TIMESTAMPTZ,

    last_used_at TIMESTAMPTZ,

    validation_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',

    error_count INTEGER NOT NULL DEFAULT 0,

    last_error TEXT,

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_id
    ON platform_credentials(credential_id);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_platform
    ON platform_credentials(platform);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_provider
    ON platform_credentials(provider);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_type
    ON platform_credentials(credential_type);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_status
    ON platform_credentials(status);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_expires_at
    ON platform_credentials(expires_at);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_validation
    ON platform_credentials(validation_status);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_last_used
    ON platform_credentials(last_used_at);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_platform_status
    ON platform_credentials(platform, status);

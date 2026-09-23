CREATE TABLE IF NOT EXISTS api_credentials (
    id BIGSERIAL PRIMARY KEY,

    credential_id VARCHAR(64) NOT NULL UNIQUE,

    name VARCHAR(150) NOT NULL,

    service_name VARCHAR(100) NOT NULL,

    credential_type VARCHAR(30) NOT NULL DEFAULT 'API_KEY',

    key_hash VARCHAR(255),

    secret_reference VARCHAR(255),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    scopes JSONB,

    expires_at TIMESTAMPTZ,

    last_used_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    revoked_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_id
    ON api_credentials(credential_id);

CREATE INDEX IF NOT EXISTS idx_api_credentials_service
    ON api_credentials(service_name);

CREATE INDEX IF NOT EXISTS idx_api_credentials_type
    ON api_credentials(credential_type);

CREATE INDEX IF NOT EXISTS idx_api_credentials_status
    ON api_credentials(status);

CREATE INDEX IF NOT EXISTS idx_api_credentials_expires_at
    ON api_credentials(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_credentials_last_used
    ON api_credentials(last_used_at);

CREATE INDEX IF NOT EXISTS idx_api_credentials_created_by
    ON api_credentials(created_by);

CREATE INDEX IF NOT EXISTS idx_api_credentials_status_expires
    ON api_credentials(status, expires_at);

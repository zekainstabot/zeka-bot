CREATE TABLE IF NOT EXISTS retention_policies (
    id BIGSERIAL PRIMARY KEY,

    policy_key VARCHAR(100) NOT NULL UNIQUE,

    resource_type VARCHAR(50) NOT NULL,

    retention_days INTEGER,

    max_items INTEGER,

    cleanup_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    config JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_key
    ON retention_policies(policy_key);

CREATE INDEX IF NOT EXISTS idx_retention_policies_resource
    ON retention_policies(resource_type);

CREATE INDEX IF NOT EXISTS idx_retention_policies_status
    ON retention_policies(status);

CREATE INDEX IF NOT EXISTS idx_retention_policies_cleanup
    ON retention_policies(cleanup_enabled);

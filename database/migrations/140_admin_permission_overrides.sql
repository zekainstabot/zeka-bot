CREATE TABLE IF NOT EXISTS admin_user_permission_overrides (
    id BIGSERIAL PRIMARY KEY,

    admin_id BIGINT NOT NULL
        REFERENCES admins(id)
        ON DELETE CASCADE,

    permission_id BIGINT NOT NULL
        REFERENCES admin_permissions(id)
        ON DELETE CASCADE,

    is_enabled BOOLEAN NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (admin_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_permission_overrides_admin_id
    ON admin_user_permission_overrides(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_permission_overrides_permission_id
    ON admin_user_permission_overrides(permission_id);

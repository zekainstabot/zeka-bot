CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    role_key VARCHAR(100) NOT NULL UNIQUE,
    role_name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_key VARCHAR(150) NOT NULL UNIQUE,
    permission_name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    role_id BIGINT NOT NULL REFERENCES admin_roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_admins_role_id
    ON admins(role_id);

CREATE INDEX IF NOT EXISTS idx_admins_active
    ON admins(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission_id
    ON admin_role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS admin_user_permissions (
  id BIGSERIAL PRIMARY KEY,

  admin_id BIGINT NOT NULL
    REFERENCES admins(id)
    ON DELETE CASCADE,

  permission_id BIGINT NOT NULL
    REFERENCES admin_permissions(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (admin_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_admin_id
  ON admin_user_permissions(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_permission_id
  ON admin_user_permissions(permission_id);

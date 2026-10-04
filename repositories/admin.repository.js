const db = require("../database");

const adminRepository = {
  async getAdminByTelegramUserId(telegramUserId) {
    const result = await db.query(
      `
      SELECT
        a.*,
        u.id AS user_id,
        u.telegram_user_id,
        u.username,
        u.first_name,
        u.last_name,
        ar.name AS role_name,
        ar.display_name AS role_display_name
      FROM admins a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN admin_roles ar ON ar.id = a.role_id
      WHERE u.telegram_user_id = $1
      LIMIT 1
      `,
      [telegramUserId]
    );

    return result.rows[0] || null;
  },

  async getAdminByUserId(userId) {
    const result = await db.query(
      `
      SELECT
        a.*,
        ar.name AS role_name,
        ar.display_name AS role_display_name
      FROM admins a
      LEFT JOIN admin_roles ar ON ar.id = a.role_id
      WHERE a.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  },

  async getAdminById(adminId) {
    const result = await db.query(
      `
      SELECT
        a.*,
        u.telegram_user_id,
        u.username,
        u.first_name,
        u.last_name,
        ar.name AS role_name,
        ar.display_name AS role_display_name
      FROM admins a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN admin_roles ar ON ar.id = a.role_id
      WHERE a.id = $1
      LIMIT 1
      `,
      [adminId]
    );

    return result.rows[0] || null;
  },

  async getAdmins() {
    const result = await db.query(
      `
      SELECT
        a.*,
        u.telegram_user_id,
        u.username,
        u.first_name,
        u.last_name,
        ar.name AS role_name,
        ar.display_name AS role_display_name
      FROM admins a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN admin_roles ar ON ar.id = a.role_id
      ORDER BY a.created_at ASC, a.id ASC
      `
    );

    return result.rows;
  },

  async createAdmin(userId, roleId = null) {
    const result = await db.query(
      `
      INSERT INTO admins (
        user_id,
        role_id,
        is_active
      )
      VALUES ($1, $2, TRUE)
      RETURNING *
      `,
      [userId, roleId]
    );

    return result.rows[0];
  },

  async updateAdminRole(adminId, roleId) {
    const result = await db.query(
      `
      UPDATE admins
      SET
        role_id = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [adminId, roleId]
    );

    return result.rows[0] || null;
  },

  async setAdminActive(adminId, isActive) {
    const result = await db.query(
      `
      UPDATE admins
      SET
        is_active = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [adminId, isActive]
    );

    return result.rows[0] || null;
  },

  async deleteAdmin(adminId) {
    const result = await db.query(
      `
      DELETE FROM admins
      WHERE id = $1
      RETURNING *
      `,
      [adminId]
    );

    return result.rows[0] || null;
  },

  async getPermissionsByUserId(userId) {
    const result = await db.query(
      `
      SELECT
        p.key,
        p.name,
        p.description,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = TRUE
          ) THEN TRUE
          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permissions aup
            WHERE aup.admin_id = a.id
              AND aup.permission_id = p.id
          ) THEN TRUE
          WHEN EXISTS (
            SELECT 1
            FROM admin_role_permissions arp
            WHERE arp.role_id = a.role_id
              AND arp.permission_id = p.id
          ) THEN TRUE
          ELSE FALSE
        END AS allowed
      FROM admins a
      LEFT JOIN admin_user_permission_overrides ov
        ON ov.admin_id = a.id
      LEFT JOIN admin_user_permissions aup
        ON aup.admin_id = a.id
      LEFT JOIN admin_role_permissions arp
        ON arp.role_id = a.role_id
      CROSS JOIN admin_permissions p
      WHERE a.user_id = $1
      GROUP BY
        a.id,
        a.role_id,
        p.id,
        p.key,
        p.name,
        p.description
      ORDER BY p.id ASC
      `,
      [userId]
    );

    return result.rows;
  },

  async hasPermission(userId, permissionKey) {
    const result = await db.query(
      `
      SELECT
        CASE
          WHEN ar.name = 'super_admin' THEN TRUE
          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permission_overrides ov
            WHERE ov.admin_id = a.id
              AND ov.permission_id = p.id
              AND ov.is_enabled = TRUE
          ) THEN TRUE
          WHEN EXISTS (
            SELECT 1
            FROM admin_user_permissions aup
            WHERE aup.admin_id = a.id
              AND aup.permission_id = p.id
          ) THEN TRUE
          WHEN EXISTS (
            SELECT 1
            FROM admin_role_permissions arp
            WHERE arp.role_id = a.role_id
              AND arp.permission_id = p.id
          ) THEN TRUE
          ELSE FALSE
        END AS allowed
      FROM admins a
      LEFT JOIN admin_roles ar
        ON ar.id = a.role_id
      CROSS JOIN admin_permissions p
      WHERE a.user_id = $1
        AND p.key = $2
        AND a.is_active = TRUE
      LIMIT 1
      `,
      [userId, permissionKey]
    );

    return result.rows[0]?.allowed === true;
  },

  async getAllPermissions() {
    const result = await db.query(
      `
      SELECT
        id,
        key,
        name,
        description
      FROM admin_permissions
      ORDER BY id ASC
      `
    );

    return result.rows;
  },

  async getPermissionByKey(permissionKey) {
    const result = await db.query(
      `
      SELECT
        id,
        key,
        name,
        description
      FROM admin_permissions
      WHERE key = $1
      LIMIT 1
      `,
      [permissionKey]
    );

    return result.rows[0] || null;
  },

  async addPermissionToAdmin(adminId, permissionId) {
    const result = await db.query(
      `
      INSERT INTO admin_user_permissions (
        admin_id,
        permission_id
      )
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [adminId, permissionId]
    );

    return result.rows[0] || null;
  },

  async removePermissionFromAdmin(adminId, permissionId) {
    const result = await db.query(
      `
      DELETE FROM admin_user_permissions
      WHERE admin_id = $1
        AND permission_id = $2
      RETURNING *
      `,
      [adminId, permissionId]
    );

    return result.rows[0] || null;
  },

  async getPermissionOverride(adminId, permissionId) {
    const result = await db.query(
      `
      SELECT
        id,
        admin_id,
        permission_id,
        is_enabled,
        created_at,
        updated_at
      FROM admin_user_permission_overrides
      WHERE admin_id = $1
        AND permission_id = $2
      LIMIT 1
      `,
      [adminId, permissionId]
    );

    return result.rows[0] || null;
  },

  async getPermissionOverrides(adminId) {
    const result = await db.query(
      `
      SELECT
        ov.id,
        ov.admin_id,
        ov.permission_id,
        ov.is_enabled,
        ov.created_at,
        ov.updated_at,
        p.key AS permission_key,
        p.name AS permission_name,
        p.description AS permission_description
      FROM admin_user_permission_overrides ov
      JOIN admin_permissions p
        ON p.id = ov.permission_id
      WHERE ov.admin_id = $1
      ORDER BY p.id ASC
      `,
      [adminId]
    );

    return result.rows;
  },

  async setPermissionOverride(adminId, permissionId, isEnabled) {
    const result = await db.query(
      `
      INSERT INTO admin_user_permission_overrides (
        admin_id,
        permission_id,
        is_enabled
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (admin_id, permission_id)
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING *
      `,
      [adminId, permissionId, isEnabled]
    );

    return result.rows[0];
  },

  async resetPermissionOverride(adminId, permissionId) {
    const result = await db.query(
      `
      DELETE FROM admin_user_permission_overrides
      WHERE admin_id = $1
        AND permission_id = $2
      RETURNING *
      `,
      [adminId, permissionId]
    );

    return result.rows[0] || null;
  },

  async resetAllPermissionOverrides(adminId) {
    const result = await db.query(
      `
      DELETE FROM admin_user_permission_overrides
      WHERE admin_id = $1
      RETURNING *
      `,
      [adminId]
    );

    return result.rows;
  },
};

module.exports = adminRepository;
